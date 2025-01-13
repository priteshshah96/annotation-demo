import { useState, useCallback, useEffect, useRef } from 'react';
import { annotationApi } from '../services/annotationApi';

// Constants matching MongoDB schema
const FIELD_TYPES = {
  EVENT: 'event',
  MAIN_ACTION: 'main_action',
  ARGUMENT: 'argument',
  OBJECT: 'object'
};

const ANNOTATION_FIELDS = {
  EVENT_TYPES: [
    'Background/Introduction',
    'Methods/Approach',
    'Results/Findings',
    'Conclusions/Implications'
  ],
  MAIN_ACTION: 'Main Action',
  ARGUMENTS: {
    AGENT: 'Agent',
    CONTEXT: 'Context',
    PURPOSE: 'Purpose',
    METHOD: 'Method',
    RESULTS: 'Results',
    ANALYSIS: 'Analysis',
    CHALLENGE: 'Challenge',
    ETHICAL: 'Ethical',
    IMPLICATIONS: 'Implications',
    CONTRADICTIONS: 'Contradictions'
  },
  OBJECT: {
    BASE_OBJECT: 'Base Object',
    BASE_MODIFIER: 'Base Modifier',
    ATTACHED_OBJECT: 'Attached Object',
    ATTACHED_MODIFIER: 'Attached Modifier'
  }
};

class FileCache {
  constructor(ttl = 1000 * 60 * 30) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
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
    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
  }
}

const fileCache = new FileCache();

const safeStorage = {
  get: (key) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Error reading from localStorage: ${key}`, error);
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
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
  const progressDebounceRef = useRef(null);

  const [state, setState] = useState({
    currentPosition: {
      paperIndex: 0,
      eventIndex: 0
    },
    fileData: fileCache.get(fileId) || null,
    progress: 0,
    loading: !fileCache.get(fileId),
    error: null,
    saving: false,
    isComplete: false
  });

  const safeSetState = useCallback((updater) => {
    if (!mountedRef.current) return;
    setState(prev => {
      const newState = typeof updater === 'function' ? updater(prev) : updater;
      return JSON.stringify(prev) === JSON.stringify(newState) ? prev : newState;
    });
  }, []);

  const calculateProgress = useCallback(() => {
    if (!state.fileData) return Promise.resolve(0);

    return new Promise(resolve => {
      if (progressDebounceRef.current) {
        clearTimeout(progressDebounceRef.current);
      }

      progressDebounceRef.current = setTimeout(() => {
        if (!mountedRef.current) return;

        let completedFields = 0;
        let totalFields = 0;

        state.fileData.papers.forEach(paper => {
          paper.events.forEach(event => {
            // Count event type field
            ANNOTATION_FIELDS.EVENT_TYPES.forEach(type => {
              totalFields++;
              if (event[type]) completedFields++;
            });

            // Count Main Action
            totalFields++;
            if (event['Main Action']) completedFields++;

            // Count Arguments
            if (event.Arguments) {
              Object.entries(ANNOTATION_FIELDS.ARGUMENTS).forEach(([key]) => {
                totalFields++;
                if (event.Arguments[key]) completedFields++;
              });

              // Count Object fields
              if (event.Arguments.Object) {
                Object.entries(ANNOTATION_FIELDS.OBJECT).forEach(([key]) => {
                  totalFields++;
                  if (event.Arguments.Object[key]) completedFields++;
                });
              }
            }
          });
        });

        const progress = totalFields > 0 ? (completedFields / totalFields) * 100 : 0;
        resolve(Math.min(100, progress));
      }, 100);
    });
  }, [state.fileData]);

  const handleAnnotationSave = useCallback(async (field, value, indices = null) => {
    if (!mountedRef.current) return;
    console.log("Starting annotation save:", { field, value, indices });
  
    // Validate value
    if (!value || typeof value !== 'string') {
      throw new Error('Invalid value for annotation. Value must be a non-empty string.');
    }
  
    try {
      safeSetState(prev => ({ ...prev, saving: true }));
  
      // Use provided indices or current position, ensuring they're numbers
      const { paperIndex, eventIndex } = indices || state.currentPosition;
      const numericPaperIndex = Number(paperIndex);
      const numericEventIndex = Number(eventIndex);
  
      // Validate indices
      if (isNaN(numericPaperIndex) || isNaN(numericEventIndex) || 
          numericPaperIndex < 0 || numericEventIndex < 0) {
        throw new Error('Invalid indices. Must be non-negative integers');
      }
  
      // Save to server
      const result = await annotationApi.saveAnnotation({
        fileId,
        paperIndex: numericPaperIndex,
        eventIndex: numericEventIndex,
        fieldPath: field,
        answer: value.trim(), // Ensure the value is trimmed and not empty
        userId
      });
  
      console.log('Save result:', result);
  
      // Update local state with deep cloning
      safeSetState(prev => {
        const newFileData = JSON.parse(JSON.stringify(prev.fileData)); // Deep clone
        const currentEvent = newFileData.papers[numericPaperIndex].events[numericEventIndex];
  
        // Ensure required objects exist
        if (!currentEvent.Arguments) {
          currentEvent.Arguments = {};
        }
        if (!currentEvent.Arguments.Object) {
          currentEvent.Arguments.Object = {};
        }
  
        // Update appropriate field
        if (field === 'Main Action') {
          currentEvent['Main Action'] = value;
        } else if (field.startsWith('Arguments.Object.')) {
          const objectField = field.replace('Arguments.Object.', '');
          currentEvent.Arguments.Object[objectField] = value;
        } else if (field.startsWith('Arguments.')) {
          const argField = field.replace('Arguments.', '');
          currentEvent.Arguments[argField] = value;
        } else if (ANNOTATION_FIELDS.EVENT_TYPES.includes(field)) {
          currentEvent[field] = value;
        }
  
        // Force re-render by creating new object
        return { 
          ...prev, 
          fileData: newFileData,
          lastUpdate: Date.now() // Add this to force re-render
        };
      });
  
      // Add console log to track state updates
      console.log('State updated after save');
  
      // Store in localStorage
      const storageKey = `annotation-${fileId}-${numericPaperIndex}-${numericEventIndex}-${field}`;
      safeStorage.set(storageKey, {
        value,
        timestamp: Date.now()
      });
  
      // Update progress
      const progress = await calculateProgress();
      safeSetState(prev => ({ 
        ...prev, 
        progress,
        saving: false,
        isComplete: progress === 100
      }));
  
    } catch (error) {
      console.error('Error saving annotation:', error);
      if (mountedRef.current) {
        safeSetState(prev => ({ ...prev, saving: false }));
      }
      throw error;
    }
  }, [fileId, state.currentPosition, calculateProgress, safeSetState, userId]);

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
        console.log('Fetching fresh data from API...');
        const response = await annotationApi.getFileWithAnnotations(fileId, userId);
        console.log('Raw API Response:', response);
        
        // Initialize the base data structure with papers
        data = {
          papers: response.papers
        };
  
        // Merge annotations if they exist
        if (response.annotations?.length > 0) {
          console.log(`Processing ${response.annotations.length} annotations...`);
          
          response.annotations.forEach(annotation => {
            const { paperIndex, eventIndex, fieldPath, answer } = annotation;
            
            // Ensure the paper and event exist
            if (data.papers[paperIndex]?.events[eventIndex]) {
              const event = data.papers[paperIndex].events[eventIndex];
              
              // Handle different types of annotations
              if (fieldPath === 'Main Action') {
                event['Main Action'] = answer;
              } else if (fieldPath.startsWith('Arguments.')) {
                // Initialize Arguments object if it doesn't exist
                if (!event.Arguments) {
                  event.Arguments = {};
                }
                
                // Handle Object-type arguments
                if (fieldPath.startsWith('Arguments.Object.')) {
                  if (!event.Arguments.Object) {
                    event.Arguments.Object = {};
                  }
                  const objectField = fieldPath.replace('Arguments.Object.', '');
                  event.Arguments.Object[objectField] = answer;
                } else {
                  // Handle regular arguments
                  const argField = fieldPath.replace('Arguments.', '');
                  event.Arguments[argField] = answer;
                }
              } else if (ANNOTATION_FIELDS.EVENT_TYPES.includes(fieldPath)) {
                event[fieldPath] = answer;
              }
            }
          });
  
          console.log('Merged annotations into papers data');
        }
  
        if (data?.papers) {
          fileCache.set(fileId, data);
          console.log('Data saved to cache');
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
  
      const progress = await calculateProgress();
      if (mountedRef.current) {
        safeSetState(prev => ({ 
          ...prev, 
          progress,
          isComplete: progress === 100
        }));
      }
  
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
  }, [fileId, userId, calculateProgress, safeSetState, ANNOTATION_FIELDS.EVENT_TYPES]);

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
      if (progressDebounceRef.current) {
        clearTimeout(progressDebounceRef.current);
      }
    };
  }, [loadFileData, userId]);

  useEffect(() => {
    if (state.currentPosition && !state.isComplete) {
      safeStorage.set(`last-position-${fileId}`, state.currentPosition);
    }
  }, [fileId, state.currentPosition, state.isComplete]);

  return {
    currentPosition: state.currentPosition,
    fileData: state.fileData,
    progress: state.progress,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    isComplete: state.isComplete,
    moveNext,
    movePrevious,
    loadFileData,
    handleAnnotationSave,
    isFirstField: isFirstField(),
    isLastField: isLastField(),
    getCurrentEvent,
    getCurrentPaper,
    ANNOTATION_FIELDS,
    FIELD_TYPES
  };
}

export {
  useAnnotation as default,
  FIELD_TYPES,
  ANNOTATION_FIELDS,
  fileCache,
  safeStorage
};