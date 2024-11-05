import { useState, useCallback, useEffect, useRef } from 'react';
import { annotationApi } from '../services/annotationApi';


// Separate cache for file data
const fileCache = new Map();


export function useAnnotation(fileId, navigate) {
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const initialLoadRef = useRef(true);
  const progressCalculationRef = useRef(null);

  // Initial state with loading flags
  const [state, setState] = useState({
    currentPosition: {
      abstractIndex: 0,
      sentenceIndex: 0,
      entityIndex: -1
    },
    selections: {
      sentenceAnswer: '',
      entityAnswer: ''
    },
    fileData: fileCache.get(fileId) || null,
    progress: 0,
    expandAbstract: true,
    loading: !fileCache.has(fileId),
    initialLoad: true,
    error: null,
    saving: false,
    isComplete: false
  });

  // Safe state update helper
  const safeSetState = useCallback((updater) => {
    if (!mountedRef.current) return;
    setState(prev => {
      const newState = typeof updater === 'function' ? updater(prev) : updater;
      return JSON.stringify(prev) === JSON.stringify(newState) ? prev : newState;
    });
  }, []);

  // Progress calculation with debounce
  const calculateProgress = useCallback(() => {
    if (!state.fileData) return 0;
  
    if (progressCalculationRef.current) {
      clearTimeout(progressCalculationRef.current);
    }
  
    return new Promise(resolve => {
      progressCalculationRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
  
        let totalSteps = 0;
        let completedSteps = 0;
  
        state.fileData.abstracts.forEach((abstract, abstractIndex) => {
          abstract.sentences.forEach((sentence, sentenceIndex) => {
            totalSteps += sentence.scientific_entities.length + 1;
            
            // Check if sentence has valid answer
            const sentenceKey = `annotation-${fileId}-${abstractIndex}-${sentenceIndex}--1`;
            const sentenceData = localStorage.getItem(sentenceKey);
            if (sentenceData) {
              const { answer } = JSON.parse(sentenceData);
              if (answer) completedSteps++;
            }
  
            // Check each entity
            sentence.scientific_entities.forEach((_, entityIndex) => {
              const entityKey = `annotation-${fileId}-${abstractIndex}-${sentenceIndex}-${entityIndex}`;
              const entityData = localStorage.getItem(entityKey);
              if (entityData) {
                const { answer } = JSON.parse(entityData);
                if (answer) completedSteps++;
              }
            });
          });
        });
  
        const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 1000) / 10 : 0;
        resolve(progress);
      }, 100);
    });
  }, [state.fileData, fileId]);

  // Check if current position is at the start
  const isFirstQuestion = useCallback(() => {
    if (!state.fileData) return true;
    
    return state.currentPosition.abstractIndex === 0 &&
           state.currentPosition.sentenceIndex === 0 &&
           state.currentPosition.entityIndex === -1;
  }, [state.fileData, state.currentPosition]);

  // Check if current position is at the end
  const isLastQuestion = useCallback(() => {
    if (!state.fileData) return false;

    const lastAbstractIndex = state.fileData.abstracts.length - 1;
    const lastAbstract = state.fileData.abstracts[lastAbstractIndex];
    const lastSentenceIndex = lastAbstract.sentences.length - 1;
    const lastSentence = lastAbstract.sentences[lastSentenceIndex];
    const lastEntityIndex = lastSentence.scientific_entities.length - 1;

    return state.currentPosition.abstractIndex === lastAbstractIndex &&
           state.currentPosition.sentenceIndex === lastSentenceIndex &&
           state.currentPosition.entityIndex === lastEntityIndex;
  }, [state.fileData, state.currentPosition]);

  // Check if current item is the last one
  const isLastItem = useCallback(() => {
    if (!state.fileData) return false;
    
    const lastAbstractIndex = state.fileData.abstracts.length - 1;
    const currentAbstract = state.fileData.abstracts[state.currentPosition.abstractIndex];
    const lastSentenceIndex = currentAbstract.sentences.length - 1;
    const currentSentence = currentAbstract.sentences[state.currentPosition.sentenceIndex];
    const lastEntityIndex = currentSentence.scientific_entities.length - 1;

    return state.currentPosition.abstractIndex === lastAbstractIndex &&
           state.currentPosition.sentenceIndex === lastSentenceIndex &&
           state.currentPosition.entityIndex === lastEntityIndex;
  }, [state.fileData, state.currentPosition]);

  // Load current annotation
  const loadCurrentAnnotation = useCallback(() => {
    if (!state.currentPosition) return;

    const { abstractIndex, sentenceIndex, entityIndex } = state.currentPosition;
    const key = `annotation-${fileId}-${abstractIndex}-${sentenceIndex}-${entityIndex === -1 ? '--1' : entityIndex}`;
    
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const { answer } = JSON.parse(saved);
        safeSetState(prev => ({
          ...prev,
          selections: {
            ...prev.selections,
            [entityIndex === -1 ? 'sentenceAnswer' : 'entityAnswer']: answer
          }
        }));
      } else {
        safeSetState(prev => ({
          ...prev,
          selections: {
            ...prev.selections,
            [entityIndex === -1 ? 'sentenceAnswer' : 'entityAnswer']: ''
          }
        }));
      }
    } catch (error) {
      console.error('Error loading annotation:', error);
    }
  }, [fileId, state.currentPosition, safeSetState]);

  // Load file data
  const loadFileData = useCallback(async () => {
    if (!fileId || loadingRef.current || !mountedRef.current) return;
    
    try {
      loadingRef.current = true;
      safeSetState(prev => ({ ...prev, loading: true, error: null }));

      let data = fileCache.get(fileId);
      
      if (!data) {
        data = await annotationApi.getFileWithAnnotations(fileId);
        if (data?.abstracts) {
          fileCache.set(fileId, data);
        }
      }

      if (!mountedRef.current) return;

      if (!data?.abstracts) {
        throw new Error('Invalid file data received');
      }

      const lastPosition = localStorage.getItem(`last-position-${fileId}`);
      const position = lastPosition ? JSON.parse(lastPosition) : {
        abstractIndex: 0,
        sentenceIndex: 0,
        entityIndex: -1
      };

      safeSetState(prev => ({
        ...prev,
        fileData: data,
        currentPosition: position,
        loading: false,
        initialLoad: false,
        error: null
      }));

      const progress = await calculateProgress();
      if (mountedRef.current) {
        safeSetState(prev => ({ 
          ...prev, 
          progress,
          isComplete: progress >= 100 && isLastItem()
        }));
      }

    } catch (error) {
      if (mountedRef.current) {
        safeSetState(prev => ({
          ...prev,
          loading: false,
          initialLoad: false,
          error: error.message || 'Failed to load file data'
        }));
      }
    } finally {
      loadingRef.current = false;
    }
  }, [fileId, calculateProgress, safeSetState, isLastItem]);


  const checkCompletion = useCallback(async () => {
    if (!state.fileData) return;
    
    console.log('Checking completion status...');
    const progress = await calculateProgress();
    console.log('Current progress:', progress);
    
    if (progress >= 100 && isLastItem()) {
      console.log('Conditions met for completion');
      // Clear local storage position
      localStorage.removeItem(`last-position-${fileId}`);
      
      // Clear file cache
      fileCache.delete(fileId);
      
      // Redirect to dashboard
      if (navigate) {
        console.log('Attempting navigation to dashboard');
        navigate('/', { 
          replace: true,
          state: { completed: true } 
        });
      } else {
        console.warn('Navigation function not available');
      }
    }
  }, [state.fileData, calculateProgress, fileId, navigate, isLastItem]);

 
  // Navigation functions
  const moveNext = useCallback(() => {
    if (!state.fileData || isLastQuestion()) return;

    safeSetState(prev => {
      const { currentPosition, fileData } = prev;
      const currentAbstract = fileData.abstracts[currentPosition.abstractIndex];
      const currentSentence = currentAbstract.sentences[currentPosition.sentenceIndex];

      let newPosition;

      // Move to first entity if available
      if (currentPosition.entityIndex === -1 && currentSentence.scientific_entities.length > 0) {
        newPosition = { ...currentPosition, entityIndex: 0 };
      }
      // Move to next entity
      else if (currentPosition.entityIndex >= 0 && 
               currentPosition.entityIndex < currentSentence.scientific_entities.length - 1) {
        newPosition = { ...currentPosition, entityIndex: currentPosition.entityIndex + 1 };
      }
      // Move to next sentence
      else if (currentPosition.sentenceIndex < currentAbstract.sentences.length - 1) {
        newPosition = {
          ...currentPosition,
          sentenceIndex: currentPosition.sentenceIndex + 1,
          entityIndex: -1
        };
      }
      // Move to next abstract
      else if (currentPosition.abstractIndex < fileData.abstracts.length - 1) {
        newPosition = {
          abstractIndex: currentPosition.abstractIndex + 1,
          sentenceIndex: 0,
          entityIndex: -1
        };
      }
      else {
        newPosition = currentPosition;
      }

      return {
        ...prev,
        currentPosition: newPosition,
        selections: {
          sentenceAnswer: '',
          entityAnswer: ''
        }
      };
    });
  }, [state.fileData, isLastQuestion]);

  const movePrevious = useCallback(() => {
    if (!state.fileData || isFirstQuestion()) return;

    safeSetState(prev => {
      const { currentPosition, fileData } = prev;
      let newPosition;

      // Previous entity
      if (currentPosition.entityIndex > 0) {
        newPosition = { ...currentPosition, entityIndex: currentPosition.entityIndex - 1 };
      }
      // Move to sentence level
      else if (currentPosition.entityIndex === 0) {
        newPosition = { ...currentPosition, entityIndex: -1 };
      }
      // Previous abstract's last sentence
      else if (currentPosition.sentenceIndex === 0 && currentPosition.abstractIndex > 0) {
        const previousAbstract = fileData.abstracts[currentPosition.abstractIndex - 1];
        const lastSentence = previousAbstract.sentences[previousAbstract.sentences.length - 1];
        
        newPosition = {
          abstractIndex: currentPosition.abstractIndex - 1,
          sentenceIndex: previousAbstract.sentences.length - 1,
          entityIndex: lastSentence.scientific_entities.length > 0 
            ? lastSentence.scientific_entities.length - 1 
            : -1
        };
      }
      // Previous sentence
      else if (currentPosition.sentenceIndex > 0) {
        const previousSentence = fileData.abstracts[currentPosition.abstractIndex]
          .sentences[currentPosition.sentenceIndex - 1];
        
        newPosition = {
          ...currentPosition,
          sentenceIndex: currentPosition.sentenceIndex - 1,
          entityIndex: previousSentence.scientific_entities.length > 0 
            ? previousSentence.scientific_entities.length - 1 
            : -1
        };
      }
      else {
        newPosition = currentPosition;
      }

      return {
        ...prev,
        currentPosition: newPosition,
        selections: {
          sentenceAnswer: '',
          entityAnswer: ''
        }
      };
    });
  }, [state.fileData, isFirstQuestion]);

// Navigation functions
  const handleAnswerSelect = useCallback(async (answer) => {
    if (!mountedRef.current) return;
  
    try {
      safeSetState(prev => ({ ...prev, saving: true }));
      
      const { currentPosition } = state;
      const { abstractIndex, sentenceIndex, entityIndex } = currentPosition;
      
      const answerValue = typeof answer === 'string' ? answer : answer.entity;
      
      // Save to local storage
      const key = `annotation-${fileId}-${abstractIndex}-${sentenceIndex}-${entityIndex === -1 ? '--1' : entityIndex}`;
      const annotationData = {
        answer: answerValue,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(key, JSON.stringify(annotationData));
  
      // Update state
      safeSetState(prev => ({
        ...prev,
        selections: {
          ...prev.selections,
          [entityIndex === -1 ? 'sentenceAnswer' : 'entityAnswer']: answerValue
        }
      }));
  
      // Save to server
      await annotationApi.saveAnnotation({
        fileId,
        abstractIndex,
        sentenceIndex,
        entityIndex,
        answer: answerValue
      });
  
      if (!mountedRef.current) return;
  
      // Update progress
      const progress = await calculateProgress();
      const currentIsLastItem = isLastItem();
      
      safeSetState(prev => ({ 
        ...prev, 
        progress,
        saving: false,
        isComplete: currentIsLastItem && progress >= 100
      }));
  
      // Check if this is the last item and all annotations are complete
      if (currentIsLastItem && progress >= 100) {
        console.log('Completing annotation process...');
        // Clear local storage position
        localStorage.removeItem(`last-position-${fileId}`);
        
        // Clear file cache
        fileCache.delete(fileId);
        
        // Navigate to dashboard
        if (navigate) {
          console.log('Navigating to dashboard...');
          navigate('/', { 
            replace: true,
            state: { completed: true } 
          });
        }
      } else if (!currentIsLastItem) {
        moveNext();
      }
  
    } catch (error) {
      console.error('Error saving annotation:', error);
      if (mountedRef.current) {
        safeSetState(prev => ({ ...prev, saving: false }));
      }
    }
  }, [fileId, state.currentPosition, moveNext, calculateProgress, safeSetState, isLastItem, navigate]);

  // Effects
  useEffect(() => {
    mountedRef.current = true;
    
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      loadFileData();
    }
    
    return () => {
      mountedRef.current = false;
      if (progressCalculationRef.current) {
        clearTimeout(progressCalculationRef.current);
      }
    };
  }, [loadFileData]);

  useEffect(() => {
    if (state.currentPosition && mountedRef.current) {
      localStorage.setItem(`last-position-${fileId}`, JSON.stringify(state.currentPosition));
      loadCurrentAnnotation();
    }
  }, [state.currentPosition, fileId, loadCurrentAnnotation]);


  useEffect(() => {
    if (!state.loading && state.fileData) {
      checkCompletion();
    }
  }, [state.loading, state.fileData, checkCompletion, state.progress]);
  
  // Position validation effect
  useEffect(() => {
    if (state.fileData && !state.loading) {
      safeSetState(prev => {
        const { currentPosition, fileData } = prev;
        let newPosition = { ...currentPosition };
        let needsUpdate = false;

        // Validate indices
        const maxAbstractIndex = fileData.abstracts.length - 1;
        if (currentPosition.abstractIndex > maxAbstractIndex) {
          newPosition = { abstractIndex: 0, sentenceIndex: 0, entityIndex: -1 };
          needsUpdate = true;
        } else {
          const currentAbstract = fileData.abstracts[currentPosition.abstractIndex];
          const maxSentenceIndex = currentAbstract.sentences.length - 1;
          
          if (currentPosition.sentenceIndex > maxSentenceIndex) {
            newPosition = { ...newPosition, sentenceIndex: 0, entityIndex: -1 };
            needsUpdate = true;
          } else {
            const currentSentence = currentAbstract.sentences[currentPosition.sentenceIndex];
            const maxEntityIndex = currentSentence.scientific_entities.length - 1;
            
            if (currentPosition.entityIndex > maxEntityIndex && currentPosition.entityIndex !== -1) {
              newPosition = { ...newPosition, entityIndex: -1 };
              needsUpdate = true;
            }
          }
        }

        return needsUpdate ? { ...prev, currentPosition: newPosition } : prev;
      });
    }
  }, [state.fileData, state.loading, safeSetState]);

  // Check completion status on progress update
  useEffect(() => {
    if (state.progress >= 100 && isLastItem()) {
      safeSetState(prev => ({ ...prev, isComplete: true }));
    }
  }, [state.progress, isLastItem, safeSetState]);

  // Return all necessary values and functions
  return {
    // Current state
    currentPosition: state.currentPosition,
    selections: state.selections,
    fileData: state.fileData,
    progress: state.progress,
    expandAbstract: state.expandAbstract,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    isComplete: state.isComplete,

    // Functions
    setExpandAbstract: useCallback((value) => 
      safeSetState(prev => ({ ...prev, expandAbstract: value })), [safeSetState]),
    moveNext,
    movePrevious,
    loadFileData,
    handleAnswerSelect,

    // Derived state
    isFirstQuestion: isFirstQuestion(),
    isLastQuestion: isLastQuestion(),
    isLastItem: isLastItem()
  };
}

export default useAnnotation;