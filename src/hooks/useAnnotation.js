import { useState, useCallback, useEffect, useRef } from 'react';
import { annotationApi } from '../services/annotationApi';
import { AnnotationTypes } from '../models/Annotation';

const FIELD_TYPES = {
  EVENT: 'event',
  MAIN_ACTION: 'main_action',
  ARGUMENT: 'argument'
};

const createInitialEventState = () => ({
  'Background/Introduction': '',
  'Methods/Approach': '',
  'Results/Findings': '',
  'Conclusions/Implications': '',
  'Main Action': '',
  Arguments: {
    Agent: [],
    Context: [],
    Purpose: [],
    Method: [],
    Results: [],
    Analysis: [],
    Challenge: [],
    Ethical: [],
    Implications: [],
    Contradictions: [],
    Object: {
      'Base Object': [],
      'Base Modifier': [],
      'Attached Object': [],
      'Attached Modifier': []
    }
  }
});

class FileCache {
  constructor(ttl = 1000 * 60 * 30) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, answer) {
    this.cache.set(key, {
      answer,
      timestamp: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return item.answer;
  }

  delete(key) {
    this.cache.delete(key);
  }
}

const fileCache = new FileCache();

const safeStorage = {
  get: (key) => {
    try {
      const answer = localStorage.getItem(key);
      return answer ? JSON.parse(answer) : null;
    } catch (error) {
      console.error(`Error reading from localStorage: ${key}`, error);
      return null;
    }
  },
  set: (key, answer) => {
    try {
      localStorage.setItem(key, JSON.stringify(answer));
      return true;
    } catch (error) {
      console.error(`Error writing to localStorage: ${key}`, error);
      return false;
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing from localStorage: ${key}`, error);
      return false;
    }
  }
};

function useAnnotation(fileId, navigate, userId) {
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  const [state, setState] = useState({
    currentPosition: {
      paperIndex: 0,
      eventIndex: 0
    },
    fileData: fileCache.get(fileId) || null,
    loading: !fileCache.get(fileId),
    error: null,
    saving: false
  });

  const safeSetState = useCallback((updater) => {
    if (!mountedRef.current) return;
    setState(prev => {
      const newState = typeof updater === 'function' ? updater(prev) : updater;
      return JSON.stringify(prev) === JSON.stringify(newState) ? prev : newState;
    });
  }, []);

  const handleAnnotationSave = useCallback(async (field, answer, options = {}) => {
    if (!mountedRef.current) return;
    
    const { indices = null, isDelete = false, span = null } = options;
    const { paperIndex, eventIndex } = indices || state.currentPosition;
  
    try {
      safeSetState(prev => ({ ...prev, saving: true }));
  
      const numericPaperIndex = Number(paperIndex);
      const numericEventIndex = Number(eventIndex);
  
      if (isNaN(numericPaperIndex) || isNaN(numericEventIndex) || 
          numericPaperIndex < 0 || numericEventIndex < 0) {
        throw new Error('Invalid indices. Must be non-negative integers');
      }
  
      const currentEvent = state.fileData.papers[numericPaperIndex].events[numericEventIndex];
      let currentSpans = [];
      let processedField = field;
      
      if (field.startsWith('Object.')) {
        processedField = `Arguments.${field}`;
      }

      const isEventType = AnnotationTypes.EVENT_TYPE.includes(field);
      const isMainAction = field === AnnotationTypes.MAIN_ACTION;
      const isArgument = processedField.startsWith('Arguments.');

      let processedAnswer;

      if (isEventType || isMainAction) {
        if (typeof answer !== 'string') {
          throw new Error(`${field} must be a string`);
        }
        processedAnswer = answer.trim();
        
      } else if (isArgument) {
        if (processedField.startsWith('Arguments.Object.')) {
          const objectField = processedField.replace('Arguments.Object.', '');
          currentSpans = currentEvent.Arguments?.Object?.[objectField] || [];
        } else {
          const argField = processedField.replace('Arguments.', '');
          currentSpans = currentEvent.Arguments?.[argField] || [];
        }

        if (isDelete) {
          if (span) {
            processedAnswer = currentSpans.filter(s => 
              s.start !== span.start || s.end !== span.end || s.text !== span.text
            );
          } else {
            processedAnswer = [];
          }
        } else if (span) {
          processedAnswer = [...currentSpans, span]
            .sort((a, b) => a.start - b.start)
            .filter(s => s.text && typeof s.start === 'number' && typeof s.end === 'number');
        } else {
          processedAnswer = currentSpans;
        }
      }

      const result = await annotationApi.saveAnnotation({
        fileId,
        paperIndex: numericPaperIndex,
        eventIndex: numericEventIndex,
        fieldPath: processedField,
        answer: isDelete && !span ? null : processedAnswer,
        isDelete: isDelete && !span
      });
  
      safeSetState(prev => {
        const newFileData = JSON.parse(JSON.stringify(prev.fileData));
        const currentEvent = newFileData.papers[numericPaperIndex].events[numericEventIndex];
  
        if (!currentEvent.Arguments) currentEvent.Arguments = {};
        if (!currentEvent.Arguments.Object) currentEvent.Arguments.Object = {};
  
        if (isDelete && !span) {
          if (isEventType) {
            currentEvent[field] = '';
          } else if (isMainAction) {
            currentEvent['Main Action'] = '';
          } else if (processedField.startsWith('Arguments.Object.')) {
            const objectField = processedField.replace('Arguments.Object.', '');
            currentEvent.Arguments.Object[objectField] = [];
          } else if (processedField.startsWith('Arguments.')) {
            const argField = processedField.replace('Arguments.', '');
            currentEvent.Arguments[argField] = [];
          }
        } else {
          if (isEventType) {
            currentEvent[field] = processedAnswer;
          } else if (isMainAction) {
            currentEvent['Main Action'] = processedAnswer;
          } else if (processedField.startsWith('Arguments.Object.')) {
            const objectField = processedField.replace('Arguments.Object.', '');
            currentEvent.Arguments.Object[objectField] = processedAnswer;
          } else if (processedField.startsWith('Arguments.')) {
            const argField = processedField.replace('Arguments.', '');
            currentEvent.Arguments[argField] = processedAnswer;
          }
        }
  
        return { 
          ...prev, 
          fileData: newFileData,
          lastUpdate: Date.now()
        };
      });
  
      const storageKey = `annotation-${fileId}-${numericPaperIndex}-${numericEventIndex}-${processedField}`;
      if (isDelete && !span) {
        safeStorage.remove(storageKey);
      } else {
        safeStorage.set(storageKey, {
          answer: processedAnswer,
          timestamp: Date.now()
        });
      }
  
    } catch (error) {
      console.error('Error saving annotation:', error);
      throw error;
    } finally {
      safeSetState(prev => ({ ...prev, saving: false }));
    }
  }, [fileId, state.currentPosition, state.fileData, safeSetState]);

  const moveNext = useCallback(() => {
    if (!state.fileData?.papers) return;

    safeSetState(prev => {
      const { currentPosition, fileData } = prev;
      const { paperIndex, eventIndex } = currentPosition;
      const currentPaper = fileData.papers[paperIndex];

      if (eventIndex < currentPaper.events.length - 1) {
        return {
          ...prev,
          currentPosition: {
            ...currentPosition,
            eventIndex: eventIndex + 1
          }
        };
      }

      if (paperIndex < fileData.papers.length - 1) {
        return {
          ...prev,
          currentPosition: {
            paperIndex: paperIndex + 1,
            eventIndex: 0
          }
        };
      }

      return prev;
    });
  }, [state.fileData]);

  const movePrevious = useCallback(() => {
    if (!state.fileData?.papers) return;

    safeSetState(prev => {
      const { currentPosition, fileData } = prev;
      const { paperIndex, eventIndex } = currentPosition;

      if (eventIndex > 0) {
        return {
          ...prev,
          currentPosition: {
            ...currentPosition,
            eventIndex: eventIndex - 1
          }
        };
      }

      if (paperIndex > 0) {
        const prevPaper = fileData.papers[paperIndex - 1];
        return {
          ...prev,
          currentPosition: {
            paperIndex: paperIndex - 1,
            eventIndex: prevPaper.events.length - 1
          }
        };
      }

      return prev;
    });
  }, [state.fileData]);

  const loadFileData = useCallback(async () => {
    if (!fileId || loadingRef.current || !mountedRef.current || !userId) return;
  
    try {
      loadingRef.current = true;
      safeSetState(prev => ({ ...prev, loading: true, error: null }));
  
      let data = fileCache.get(fileId);
  
      if (!data) {
        console.log('Fetching file data from API...');
        const response = await annotationApi.getFileWithAnnotations(fileId);
        console.log('API Response:', response);
        data = {
          papers: response.papers.map(paper => ({
            ...paper,
            events: paper.events.map(event => ({
              ...event,
              'Main Action': event['Main Action'] || '',
              Arguments: event.Arguments || {
                Agent: [],
                Object: {
                  'Base Object': [],
                  'Base Modifier': [],
                  'Attached Object': [],
                  'Attached Modifier': []
                },
                Context: [],
                Purpose: [],
                Method: [],
                Results: [],
                Analysis: [],
                Challenge: [],
                Ethical: [],
                Implications: [],
                Contradictions: []
              }
            }))
          })),
          metadata: response.metadata
        };
  
        if (data?.papers) {
          console.log('Setting file data to cache...');
          fileCache.set(fileId, data);
        }
      }
  
      if (!mountedRef.current) return;
      if (!data?.papers) {
        throw new Error('Invalid file data received');
      }
  
      const lastPosition = safeStorage.get(`last-position-${fileId}`);
  
      safeSetState(prev => ({
        ...prev,
        fileData: data,
        currentPosition: lastPosition || { paperIndex: 0, eventIndex: 0 },
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('Error loading file data:', error);
      if (mountedRef.current) {
        safeSetState(prev => ({
          ...prev,
          loading: false,
          error: error.message || 'Failed to load file data'
        }));
      }
    } finally {
      loadingRef.current = false;
    }
  }, [fileId, userId, safeSetState]);

  const isFirstField = useCallback(() => {
    const { paperIndex, eventIndex } = state.currentPosition;
    return paperIndex === 0 && eventIndex === 0;
  }, [state.currentPosition]);

  const isLastField = useCallback(() => {
    if (!state.fileData) return false;

    const { papers } = state.fileData;
    const { paperIndex, eventIndex } = state.currentPosition;
    const lastPaperIndex = papers.length - 1;
    
    return paperIndex === lastPaperIndex && 
           eventIndex === papers[lastPaperIndex].events.length - 1;
  }, [state.fileData, state.currentPosition]);

  const getCurrentEvent = useCallback(() => {
    if (!state.fileData || !state.currentPosition) return null;
    const { paperIndex, eventIndex } = state.currentPosition;
    return state.fileData.papers[paperIndex]?.events[eventIndex] || null;
  }, [state.fileData, state.currentPosition]);

  const getCurrentPaper = useCallback(() => {
    if (!state.fileData || !state.currentPosition) return null;
    return state.fileData.papers[state.currentPosition.paperIndex] || null;
  }, [state.fileData, state.currentPosition]);

  useEffect(() => {
    mountedRef.current = true;
    if (userId) loadFileData();
    
    return () => {
      mountedRef.current = false;
    };
  }, [loadFileData, userId]);

  useEffect(() => {
    if (state.currentPosition) {
      safeStorage.set(`last-position-${fileId}`, state.currentPosition);
    }
  }, [fileId, state.currentPosition]);

  return {
    currentPosition: state.currentPosition,
    fileData: state.fileData,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    moveNext,
    movePrevious,
    loadFileData,
    handleAnnotationSave,
    isFirstField: isFirstField(),
    isLastField: isLastField(),
    getCurrentEvent,
    getCurrentPaper,
    ANNOTATION_FIELDS: AnnotationTypes,
    FIELD_TYPES
  };
}

export {
  useAnnotation as default,
  FIELD_TYPES,
  fileCache,
  safeStorage
};