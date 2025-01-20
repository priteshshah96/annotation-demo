// useAnnotation.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { annotationApi } from '../services/annotationApi';
import { AnnotationTypes } from '../models/Annotation';

const FIELD_TYPES = {
  EVENT: 'event',
  MAIN_ACTION: 'main_action',
  ARGUMENT: 'argument'
};

function useAnnotation(fileId, navigate, userId) {
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  const [state, setState] = useState({
    currentPosition: {
      paperIndex: 0,
      eventIndex: 0
    },
    fileData: null,
    loading: true,
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
    
    const { indices = null, isDelete = false } = options;
    const { paperIndex, eventIndex } = indices || state.currentPosition;
  
    try {
      safeSetState(prev => ({ ...prev, saving: true }));
  
      const numericPaperIndex = Number(paperIndex);
      const numericEventIndex = Number(eventIndex);
  
      if (isNaN(numericPaperIndex) || isNaN(numericEventIndex) || 
          numericPaperIndex < 0 || numericEventIndex < 0) {
        throw new Error('Invalid indices');
      }
  
      let processedField = field.startsWith('Object.') ? `Arguments.${field}` : field;
      const isEventType = AnnotationTypes.EVENT_TYPE.includes(field);
      const isMainAction = field === AnnotationTypes.MAIN_ACTION;
      const isArgument = processedField.startsWith('Arguments.');
  
      // Format the answer based on type
      let processedAnswer;
      if (isEventType || isMainAction) {
        // For event types and main action
        processedAnswer = {
          text: typeof answer === 'string' ? answer.trim() : answer.text,
          spans: [{
            text: typeof answer === 'string' ? answer.trim() : answer.text,
            start: answer.start || 0,
            end: answer.end || (typeof answer === 'string' ? answer.length : answer.text.length)
          }]
        };
      } else if (isArgument) {
        if (isDelete) {
          processedAnswer = {
            text: '',
            spans: []
          };
        } else {
          // Ensure we always have the proper spans structure
          const spans = answer.spans || [{
            text: answer.text,
            start: answer.start,
            end: answer.end
          }];
  
          processedAnswer = {
            text: spans.map(span => span.text).join(' '),
            spans: spans
          };
        }
      }
  
      // Make the API call
      const response = await annotationApi.saveAnnotation({
        fileId,
        paperIndex: numericPaperIndex,
        eventIndex: numericEventIndex,
        fieldPath: processedField,
        answer: processedAnswer,
        isDelete
      });
  
      // Update local state
      safeSetState(prev => {
        const newFileData = JSON.parse(JSON.stringify(prev.fileData));
        const currentEvent = newFileData.papers[numericPaperIndex].events[numericEventIndex];
  
        // Initialize Arguments structure if needed
        if (!currentEvent.Arguments) {
          currentEvent.Arguments = {
            Agent: { spans: [] },
            Object: {
              'Base Object': { spans: [] },
              'Base Modifier': { spans: [] },
              'Attached Object': { spans: [] },
              'Attached Modifier': { spans: [] }
            },
            Context: { spans: [] },
            Purpose: { spans: [] },
            Method: { spans: [] },
            Results: { spans: [] },
            Analysis: { spans: [] },
            Challenge: { spans: [] },
            Ethical: { spans: [] },
            Implications: { spans: [] },
            Contradictions: { spans: [] }
          };
        }
  
        // Update the appropriate field
        if (isEventType) {
          currentEvent[field] = processedAnswer.text;
        } else if (isMainAction) {
          currentEvent['Main Action'] = processedAnswer.text;
        } else if (processedField.startsWith('Arguments.Object.')) {
          const objectField = processedField.replace('Arguments.Object.', '');
          currentEvent.Arguments.Object[objectField] = processedAnswer;
        } else if (processedField.startsWith('Arguments.')) {
          const argField = processedField.replace('Arguments.', '');
          currentEvent.Arguments[argField] = processedAnswer;
        }
  
        return { ...prev, fileData: newFileData };
      });
  
      return response;
    } catch (error) {
      console.error('Error saving annotation:', error);
      throw error;
    } finally {
      safeSetState(prev => ({ ...prev, saving: false }));
    }
  }, [fileId, state.currentPosition]);

  const moveNext = useCallback(() => {
    if (!state.fileData?.papers) return;

    safeSetState(prev => {
      const { currentPosition, fileData } = prev;
      const { paperIndex, eventIndex } = currentPosition;
      const currentPaper = fileData.papers[paperIndex];

      if (eventIndex < currentPaper.events.length - 1) {
        return {
          ...prev,
          currentPosition: { ...currentPosition, eventIndex: eventIndex + 1 }
        };
      }

      if (paperIndex < fileData.papers.length - 1) {
        return {
          ...prev,
          currentPosition: { paperIndex: paperIndex + 1, eventIndex: 0 }
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
          currentPosition: { ...currentPosition, eventIndex: eventIndex - 1 }
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
  
      const response = await annotationApi.getFileWithAnnotations(fileId);
      
      if (!mountedRef.current) return;
      
      const data = {
        papers: response.papers.map(paper => ({
          ...paper,
          events: paper.events.map(event => ({
            ...event,
            'Main Action': event['Main Action'] || '',
            Arguments: event.Arguments || {
              Agent: { spans: [] },
              Object: {
                'Base Object': { spans: [] },
                'Base Modifier': { spans: [] },
                'Attached Object': { spans: [] },
                'Attached Modifier': { spans: [] }
              },
              Context: { spans: [] },
              Purpose: { spans: [] },
              Method: { spans: [] },
              Results: { spans: [] },
              Analysis: { spans: [] },
              Challenge: { spans: [] },
              Ethical: { spans: [] },
              Implications: { spans: [] },
              Contradictions: { spans: [] }
            }
          }))
        })),
        metadata: response.metadata
      };

      safeSetState(prev => ({
        ...prev,
        fileData: data,
        currentPosition: { paperIndex: 0, eventIndex: 0 },
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
  }, [fileId, userId]);

  useEffect(() => {
    mountedRef.current = true;
    if (userId) loadFileData();
    
    return () => {
      mountedRef.current = false;
    };
  }, [loadFileData, userId]);

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
    isFirstField: state.currentPosition.paperIndex === 0 && state.currentPosition.eventIndex === 0,
    isLastField: state.fileData ? 
      (state.currentPosition.paperIndex === state.fileData.papers.length - 1 && 
       state.currentPosition.eventIndex === state.fileData.papers[state.currentPosition.paperIndex].events.length - 1) : false,
    getCurrentEvent: () => state.fileData?.papers[state.currentPosition.paperIndex]?.events[state.currentPosition.eventIndex] || null,
    getCurrentPaper: () => state.fileData?.papers[state.currentPosition.paperIndex] || null
  };
}

export { useAnnotation as default, FIELD_TYPES };