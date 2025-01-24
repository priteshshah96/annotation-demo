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

  const loadFileData = useCallback(async () => {
    if (!fileId || loadingRef.current || !mountedRef.current || !userId) return;
  
    try {
      loadingRef.current = true;
      safeSetState(prev => ({ ...prev, loading: true, error: null }));
  
      const response = await annotationApi.getFileWithAnnotations(fileId);
      console.log('Server Response:', JSON.stringify(response, null, 2));
      
      if (!mountedRef.current) return;
      
      const data = {
        papers: response.papers,
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
  }, [fileId, userId, safeSetState]);

  const validatePosition = useCallback((paperIndex, eventIndex) => {
    if (!state.fileData?.papers) return false;
    
    const paper = state.fileData.papers[paperIndex];
    if (!paper) return false;
    
    return eventIndex >= 0 && eventIndex < paper.events.length;
  }, [state.fileData]);

  const moveNext = useCallback(() => {
    if (!mountedRef.current || !state.fileData?.papers) return;
    
    safeSetState(prev => {
      const currentPaper = state.fileData.papers[prev.currentPosition.paperIndex];
      if (!currentPaper) return prev;

      const totalEvents = currentPaper.events.length;
      
      // Move to next event in current paper
      if (prev.currentPosition.eventIndex < totalEvents - 1) {
        return {
          ...prev,
          currentPosition: {
            ...prev.currentPosition,
            eventIndex: prev.currentPosition.eventIndex + 1
          }
        };
      }
      
      // Move to first event of next paper
      if (prev.currentPosition.paperIndex < state.fileData.papers.length - 1) {
        return {
          ...prev,
          currentPosition: {
            paperIndex: prev.currentPosition.paperIndex + 1,
            eventIndex: 0
          }
        };
      }
      
      return prev; // Stay at current position if at end
    });
  }, [state.fileData, safeSetState]);

  const movePrevious = useCallback(() => {
    if (!mountedRef.current || !state.fileData?.papers) return;
    
    safeSetState(prev => {
      // Move to previous event in current paper
      if (prev.currentPosition.eventIndex > 0) {
        return {
          ...prev,
          currentPosition: {
            ...prev.currentPosition,
            eventIndex: prev.currentPosition.eventIndex - 1
          }
        };
      }
      
      // Move to last event of previous paper
      if (prev.currentPosition.paperIndex > 0) {
        const previousPaper = state.fileData.papers[prev.currentPosition.paperIndex - 1];
        if (!previousPaper) return prev;

        return {
          ...prev,
          currentPosition: {
            paperIndex: prev.currentPosition.paperIndex - 1,
            eventIndex: previousPaper.events.length - 1
          }
        };
      }
      
      return prev; // Stay at current position if at start
    });
  }, [state.fileData, safeSetState]);

  const getCurrentEvent = useCallback(() => {
    if (!state.fileData?.papers) return null;
    const { paperIndex, eventIndex } = state.currentPosition;
    return state.fileData.papers[paperIndex]?.events[eventIndex] || null;
  }, [state.fileData, state.currentPosition]);

  const getCurrentPaper = useCallback(() => {
    if (!state.fileData?.papers) return null;
    return state.fileData.papers[state.currentPosition.paperIndex] || null;
  }, [state.fileData, state.currentPosition]);

  const handleAnnotationSave = useCallback(async (field, answer, options = {}) => {
    if (!mountedRef.current) return;
    
    const { indices = null, isDelete = false } = options;
    const { paperIndex, eventIndex } = indices || state.currentPosition;
  
    try {
      safeSetState(prev => ({ ...prev, saving: true }));
      const numericPaperIndex = Number(paperIndex);
      const numericEventIndex = Number(eventIndex);
  
      let processedField = field;
      if (field.startsWith('Object.')) {
        processedField = `Arguments.Object.${field.replace('Object.', '')}`;
      } else if (!field.startsWith('Arguments.') && 
                 !AnnotationTypes.EVENT_TYPE.includes(field) && 
                 field !== AnnotationTypes.MAIN_ACTION) {
        processedField = `Arguments.${field}`;
      }
  
      const currentEvent = state.fileData?.papers[numericPaperIndex]?.events[numericEventIndex];
      const currentAnnotations = currentEvent?.ArgumentPositions?.[processedField] || [];
      const arrayIndex = options.index ?? currentAnnotations.length;
  
      // Save to API first
      const response = await annotationApi.saveAnnotation({
        fileId,
        paperIndex: numericPaperIndex,
        eventIndex: numericEventIndex,
        fieldPath: processedField,
        answer: isDelete ? null : answer,
        isDelete,
        arrayIndex: isDelete ? options.index : arrayIndex
      });
  
      // Then update local state only if API call succeeds
      safeSetState(prev => {
        const newFileData = JSON.parse(JSON.stringify(prev.fileData));
        const currentEvent = newFileData.papers[numericPaperIndex]?.events[numericEventIndex];
        
        if (!currentEvent) return prev;
  
        if (isDelete) {
          if (Array.isArray(currentEvent[processedField])) {
            currentEvent[processedField].splice(options.index, 1);
            if (currentEvent.ArgumentPositions?.[processedField]) {
              currentEvent.ArgumentPositions[processedField].splice(options.index, 1);
            }
          } else {
            currentEvent[processedField] = null;
            delete currentEvent.ArgumentPositions?.[processedField];
          }
        } else {
          const textContent = answer?.text || answer;
          const span = answer?.span;
  
          if (currentEvent[processedField] && Array.isArray(currentEvent[processedField])) {
            if (arrayIndex < currentEvent[processedField].length) {
              currentEvent[processedField][arrayIndex] = textContent;
            } else {
              currentEvent[processedField].push(textContent);
            }
          } else {
            currentEvent[processedField] = textContent;
          }
  
          if (span) {
            currentEvent.ArgumentPositions = currentEvent.ArgumentPositions || {};
            if (Array.isArray(currentEvent.ArgumentPositions[processedField])) {
              currentEvent.ArgumentPositions[processedField][arrayIndex] = span;
            } else {
              currentEvent.ArgumentPositions[processedField] = [span];
            }
          }
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
  }, [fileId, state.currentPosition, state.fileData, safeSetState]);

  const hasUnsavedChanges = useCallback(() => {
    return state.saving;
  }, [state.saving]);

  const resetPosition = useCallback(() => {
    safeSetState(prev => ({
      ...prev,
      currentPosition: { paperIndex: 0, eventIndex: 0 }
    }));
  }, [safeSetState]);

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
    getCurrentEvent,
    getCurrentPaper,
    validatePosition,
    hasUnsavedChanges,
    resetPosition,
    isFirstField: state.currentPosition.paperIndex === 0 && state.currentPosition.eventIndex === 0,
    isLastField: state.fileData ? 
      (state.currentPosition.paperIndex === state.fileData.papers.length - 1 && 
       state.currentPosition.eventIndex === state.fileData.papers[state.currentPosition.paperIndex].events.length - 1) : false
  };
}

export { useAnnotation as default, FIELD_TYPES };