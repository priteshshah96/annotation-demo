import { useState, useCallback, useEffect, useRef } from 'react';
import { annotationApi } from '../services/annotationApi';
import { AnnotationTypes } from '../models/Annotation';

export const FIELD_TYPES = {
  EVENT: 'event',
  MAIN_ACTION: 'main_action',
  ARGUMENT: 'argument'
};

const EVENT_TYPES = [
  'Background/Introduction',
  'Methods/Approach', 
  'Results/Findings',
  'Conclusions/Implications'
];

export function useAnnotation(fileId, navigate, userId) {
  console.log('useAnnotation initialized with:', { fileId, userId });
  
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  const [state, setState] = useState({
    currentPosition: { paperIndex: 0, eventIndex: 0 },
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

  const loadFileData = useCallback(async (force = false) => {
    if ((!fileId || loadingRef.current || !mountedRef.current || !userId) && !force) {
      console.log('Skipping loadFileData:', { fileId, loading: loadingRef.current, mounted: mountedRef.current, userId });
      return;
    }
  
    try {
      loadingRef.current = true;
      safeSetState(prev => ({ ...prev, loading: true, error: null }));
  
      const response = await annotationApi.getFileWithAnnotations(fileId);
      console.log('Server Response:', JSON.stringify(response, null, 2));
      
      if (!mountedRef.current) return;
      
      if (!response?.file) {
        throw new Error('Invalid response format - missing file data');
      }
  
      const data = {
        papers: response.file.papers || [],
        metadata: response.file.metadata || {},
        uploadDate: response.file.uploadDate,
        name: response.file.name,
        _id: response.file._id
      };
  
      safeSetState(prev => ({
        ...prev,
        fileData: data,
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
    if (!paper?.events) return false;
    
    return eventIndex >= 0 && eventIndex < paper.events.length;
  }, [state.fileData]);

  const moveNext = useCallback(() => {
    if (!mountedRef.current || !state.fileData?.papers) return;
    
    safeSetState(prev => {
      const currentPaper = state.fileData.papers[prev.currentPosition.paperIndex];
      if (!currentPaper?.events) return prev;

      const totalEvents = currentPaper.events.length;
      
      if (prev.currentPosition.eventIndex < totalEvents - 1) {
        return {
          ...prev,
          currentPosition: {
            ...prev.currentPosition,
            eventIndex: prev.currentPosition.eventIndex + 1
          }
        };
      }
      
      if (prev.currentPosition.paperIndex < state.fileData.papers.length - 1) {
        return {
          ...prev,
          currentPosition: {
            paperIndex: prev.currentPosition.paperIndex + 1,
            eventIndex: 0
          }
        };
      }
      
      return prev;
    });
  }, [state.fileData, safeSetState]);

  const movePrevious = useCallback(() => {
    if (!mountedRef.current || !state.fileData?.papers) return;
    
    safeSetState(prev => {
      if (prev.currentPosition.eventIndex > 0) {
        return {
          ...prev,
          currentPosition: {
            ...prev.currentPosition,
            eventIndex: prev.currentPosition.eventIndex - 1
          }
        };
      }
      
      if (prev.currentPosition.paperIndex > 0) {
        const previousPaper = state.fileData.papers[prev.currentPosition.paperIndex - 1];
        if (!previousPaper?.events) return prev;

        return {
          ...prev,
          currentPosition: {
            paperIndex: prev.currentPosition.paperIndex - 1,
            eventIndex: previousPaper.events.length - 1
          }
        };
      }
      
      return prev;
    });
  }, [state.fileData, safeSetState]);

  const getCurrentEvent = useCallback(() => {
    if (!state.fileData?.papers) return null;
    const { paperIndex, eventIndex } = state.currentPosition;
    return state.fileData.papers[paperIndex]?.events?.[eventIndex] || null;
  }, [state.fileData, state.currentPosition]);

  const getCurrentEventType = useCallback(() => {
    const currentEvent = getCurrentEvent();
    if (!currentEvent) {
      return null;
    }
    
    // Simply find which event type exists in the current event
    return EVENT_TYPES.find(type => Object.hasOwn(currentEvent, type)) || null;
  }, [getCurrentEvent]);

  const getCurrentPaper = useCallback(() => {
    if (!state.fileData?.papers) return null;
    return state.fileData.papers[state.currentPosition.paperIndex] || null;
  }, [state.fileData, state.currentPosition]);

  const handleAnnotationSave = useCallback(async (field, answer, options = {}) => {
    if (!mountedRef.current) return;
    
    const { indices = null, isDelete = false, annotationId } = options;
    const { paperIndex, eventIndex } = indices || state.currentPosition;
  
    try {
      safeSetState(prev => ({ ...prev, saving: true }));
      
      let processedField = field.startsWith('Object.') ? 
        `Arguments.Object.${field.replace('Object.', '')}` :
        !field.startsWith('Arguments.') && 
        !AnnotationTypes.EVENT_TYPE.includes(field) && 
        field !== AnnotationTypes.MAIN_ACTION ? 
          `Arguments.${field}` : field;
  
      const response = await annotationApi.saveAnnotation({
        fileId,
        paperIndex: Number(paperIndex),
        eventIndex: Number(eventIndex),
        fieldPath: processedField,
        answer: isDelete ? null : answer,
        isDelete,
        annotationId
      });
  
      safeSetState(prev => {
        const newFileData = JSON.parse(JSON.stringify(prev.fileData));
        const currentEvent = newFileData.papers[paperIndex]?.events?.[eventIndex];
        
        if (!currentEvent) return prev;
  
        if (isDelete) {
          if (processedField === 'Main Action') {
            currentEvent['Main Action'] = null;
            delete currentEvent.ArgumentPositions?.['Main Action'];
          } else {
            const positions = currentEvent.ArgumentPositions?.[processedField] || [];
            const existingIndex = positions.findIndex(p => p.annotationId === annotationId);
  
            if (existingIndex > -1) {
              positions.splice(existingIndex, 1);
              if (Array.isArray(currentEvent[processedField])) {
                currentEvent[processedField].splice(existingIndex, 1);
              }
            }
          }
        } else {
          const textContent = answer?.text || answer;
          const span = { ...answer?.span, annotationId: response.annotationId };
  
          if (processedField === 'Main Action') {
            currentEvent['Main Action'] = textContent;
            if (!currentEvent.ArgumentPositions) {
              currentEvent.ArgumentPositions = {};
            }
            currentEvent.ArgumentPositions['Main Action'] = [span];
          } else {
            if (!currentEvent.ArgumentPositions) {
              currentEvent.ArgumentPositions = {};
            }
            const currPositions = currentEvent.ArgumentPositions[processedField] || [];
            currentEvent.ArgumentPositions[processedField] = [...currPositions, span];
  
            if (Array.isArray(currentEvent[processedField])) {
              currentEvent[processedField].push(textContent);
            } else {
              currentEvent[processedField] = [textContent];
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
  }, [fileId, state.currentPosition, safeSetState]);

  const hasUnsavedChanges = useCallback(() => {
    return state.saving;
  }, [state.saving]);

  const resetPosition = useCallback(() => {
    safeSetState(prev => ({
      ...prev,
      currentPosition: { paperIndex: 0, eventIndex: 0 }
    }));
  }, [safeSetState]);

  const getIsLastField = useCallback(() => {
    if (!state.fileData?.papers?.length) return false;
    
    const { paperIndex, eventIndex } = state.currentPosition;
    const currentPaper = state.fileData.papers[paperIndex];
    if (!currentPaper?.events?.length) return false;
    
    return paperIndex === state.fileData.papers.length - 1 && 
           eventIndex === currentPaper.events.length - 1;
  }, [state.fileData, state.currentPosition]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      console.log('Cleaning up useAnnotation');
      mountedRef.current = false;
    };
  }, []);

  // Load data effect
  useEffect(() => {
    console.log('Loading data effect triggered');
    mountedRef.current = true;
    if (userId) {
      loadFileData();
    }
  }, [loadFileData, userId]);

  // Navigation effect - handle navigation errors
  useEffect(() => {
    if (state.error && navigate) {
      console.log('Error detected, navigating to error page');
      navigate('/error', { state: { error: state.error } });
    }
  }, [state.error, navigate]);

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
    eventType: getCurrentEventType(),
    isFirstField: state.currentPosition.paperIndex === 0 && state.currentPosition.eventIndex === 0,
    isLastField: getIsLastField()
  };
}