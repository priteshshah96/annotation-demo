import React, { useEffect, useCallback, memo, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useAnnotation } from '../hooks/useAnnotation';
import { useAnnotationSync } from '../hooks/useAnnotationSync';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants/annotation';
import { fileApi } from '../services/fileApi';
import { annotationApi } from '../services/annotationApi';
import AnnotationHeader from '../components/annotation/AnnotationHeader';
import AnnotationMain from '../components/annotation/AnnotationMain';
import AnnotationFooter from '../components/annotation/AnnotationFooter';
import AbstractSection from '../components/annotation/AbstractSection';
import TutorialDialog from '../components/annotation/TutorialDialog';
import LoadingView from '../components/common/LoadingView';
import ErrorView from '../components/common/ErrorView';
import Toast from '../components/annotation/Toast';

const UserAnnotationDashboard = () => {
  // Router and Auth hooks
  const navigate = useNavigate();
  const { fileId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { isLoaded, isSignedIn } = useAuth();
  const mountedRef = useRef(true);

  // Mode handling
  const mode = searchParams.get('mode') || 'edit';
  const isViewMode = mode === 'view';

  // State
  const [toasts, setToasts] = useState([]);
  const [selectedText, setSelectedText] = useState(null);
  const [isAbstractOpen, setIsAbstractOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [summaryInput, setSummaryInput] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [localFileData, setLocalFileData] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [viewModePosition, setViewModePosition] = useState({ paperIndex: 0, eventIndex: 0 });

  // Custom Hooks
  const {
    currentPosition,
    fileData,
    loading,
    error,
    moveNext,
    movePrevious,
    getCurrentEvent,
    getCurrentPaper,
    isFirstField,
    isLastField,
    loadFileData,
    eventType,
    setCurrentPosition
  } = useAnnotation(fileId, navigate, user?.id);

  const { 
    syncStatus, 
    syncAnnotation, 
    finalizeSync,
    isOnline 
  } = useAnnotationSync(fileId, user?.id, loadFileData);

  // Toast handling
  const showToast = useCallback((message, type = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  }, []);

  const hideToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Event Handlers
  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleTextSelect = useCallback((selection) => {
    if (!selection) {
      setSelectedText(null);
      return;
    }
    if (selection.start === undefined || selection.end === undefined) {
      return;
    }
    setSelectedText({
      text: selection.text,
      start: selection.start,
      end: selection.end,
    });
  }, []);

  const validateAnnotation = useCallback((selection, eventText) => {
    if (!selection || !eventText) return false;

    const textContainerRef = document.createElement('div');
    textContainerRef.textContent = eventText;
    const range = document.createRange();
    const tempTextNode = textContainerRef.firstChild;
    
    if (!tempTextNode) return false;

    try {
      range.setStart(tempTextNode, selection.start);
      range.setEnd(tempTextNode, selection.end);
      const textAtPosition = eventText.substring(selection.start, selection.end);
      return textAtPosition === selection.text.trim();
    } catch (error) {
      console.error("Validation error:", error);
      return false;
    }
  }, []);

  const handleAnnotationSelect = useCallback(async (type, selection) => {
    if (!selection || !currentPosition || isViewMode) return;

    try {
      const currentEvent = getCurrentEvent();
      
      if (type === 'Main Action' && currentEvent['Main Action']?.trim?.()) {
        showToast(ERROR_MESSAGES.MAIN_ACTION_EXISTS, "error");
        return;
      }

      if (!validateAnnotation(selection, currentEvent?.Text)) {
        showToast(ERROR_MESSAGES.INVALID_SELECTION, "error");
        return;
      }

      const annotationData = {
        text: selection.text.trim(),
        span: {
          start: selection.start,
          end: selection.end
        }
      };

      let fieldPath = type;
      if (type.startsWith('Object.')) {
        fieldPath = `Arguments.Object.${type.slice(7)}`;
      } else if (!type.startsWith('Arguments.') && type !== 'Main Action') {
        fieldPath = `Arguments.${type}`;
      }

      // First update local state
      const updateState = (prev) => {
        if (!prev?.papers) return prev;
        const newData = JSON.parse(JSON.stringify(prev));
        const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
        
        const tempId = `temp-${Date.now()}`;
        const spanWithId = { 
          ...annotationData.span,
          annotationId: tempId
        };

        if (!currentEvent.Arguments) currentEvent.Arguments = {};
        if (!currentEvent.ArgumentPositions) currentEvent.ArgumentPositions = {};

        if (type === 'Main Action') {
          currentEvent['Main Action'] = annotationData.text;
          currentEvent.ArgumentPositions['Main Action'] = [spanWithId];
        } else {
          if (type.startsWith('Arguments.Object.')) {
            const objectType = type.split('.').pop();
            if (!currentEvent.Arguments.Object) {
              currentEvent.Arguments.Object = {};
            }
            if (!currentEvent.Arguments.Object[objectType]) {
              currentEvent.Arguments.Object[objectType] = [];
            }
            currentEvent.Arguments.Object[objectType].push(annotationData.text);
            
            if (!currentEvent.ArgumentPositions[fieldPath]) {
              currentEvent.ArgumentPositions[fieldPath] = [];
            }
            currentEvent.ArgumentPositions[fieldPath].push(spanWithId);
          } else {
            const argumentType = type.replace('Arguments.', '');
            if (!currentEvent.Arguments[argumentType]) {
              currentEvent.Arguments[argumentType] = [];
            }
            currentEvent.Arguments[argumentType].push(annotationData.text);
            
            if (!currentEvent.ArgumentPositions[fieldPath]) {
              currentEvent.ArgumentPositions[fieldPath] = [];
            }
            currentEvent.ArgumentPositions[fieldPath].push(spanWithId);
          }
        }

        return newData;
      };

      setLocalFileData(updateState);

      const response = await syncAnnotation({
        fieldPath,
        answer: annotationData,
        paperIndex: currentPosition.paperIndex,
        eventIndex: currentPosition.eventIndex
      });

      if (!response.success) throw new Error('Failed to save');

      setLocalFileData(prev => {
        if (!prev?.papers) return prev;
        const newData = JSON.parse(JSON.stringify(prev));
        const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
        
        const positions = currentEvent.ArgumentPositions[fieldPath];
        if (positions) {
          const tempIndex = positions.findIndex(p => p.annotationId.startsWith('temp-'));
          if (tempIndex !== -1) {
            positions[tempIndex].annotationId = response.data.annotationId;
          }
        }
        
        return newData;
      });

      setSelectedText(null);
      setLastSaved(new Date());
      showToast(SUCCESS_MESSAGES.ANNOTATION_SAVED, "success");

    } catch (error) {
      showToast(ERROR_MESSAGES.SAVE_FAILED, "error");
      if (fileData) {
        setLocalFileData(JSON.parse(JSON.stringify(fileData)));
      }
    }
  }, [currentPosition, syncAnnotation, showToast, validateAnnotation, getCurrentEvent, fileData, isViewMode]);

  const handleAnnotationDelete = useCallback(async (type, annotationId) => {
    if (!currentPosition || !annotationId || isViewMode) return;

    try {
      setLocalFileData(prev => {
        if (!prev?.papers) return prev;
        
        const newData = JSON.parse(JSON.stringify(prev));
        const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
        
        if (!currentEvent) return prev;

        if (type === 'Main Action') {
          currentEvent['Main Action'] = '';
          if (currentEvent.ArgumentPositions) {
            currentEvent.ArgumentPositions['Main Action'] = [];
          }
        } else {
          const fieldPath = type.startsWith('Object.') ? 
            `Arguments.Object.${type.slice(7)}` : 
            type.startsWith('Arguments.') ? type : `Arguments.${type}`;
          
          if (currentEvent.ArgumentPositions?.[fieldPath]) {
            const positions = currentEvent.ArgumentPositions[fieldPath];
            const posIndex = positions.findIndex(p => p.annotationId === annotationId);
            
            if (posIndex !== -1) {
              positions.splice(posIndex, 1);
              
              if (type.startsWith('Object.')) {
                const objectKey = type.split('.').pop();
                if (currentEvent.Arguments?.Object?.[objectKey]) {
                  currentEvent.Arguments.Object[objectKey].splice(posIndex, 1);
                  if (currentEvent.Arguments.Object[objectKey].length === 0) {
                    delete currentEvent.Arguments.Object[objectKey];
                  }
                }
              } else {
                const argType = type.replace('Arguments.', '');
                if (currentEvent.Arguments?.[argType]) {
                  currentEvent.Arguments[argType].splice(posIndex, 1);
                  if (currentEvent.Arguments[argType].length === 0) {
                    delete currentEvent.Arguments[argType];
                  }
                }
              }

              if (positions.length === 0) {
                delete currentEvent.ArgumentPositions[fieldPath];
              }
              if (Object.keys(currentEvent.ArgumentPositions).length === 0) {
                delete currentEvent.ArgumentPositions;
              }
              if (Object.keys(currentEvent.Arguments?.Object || {}).length === 0) {
                delete currentEvent.Arguments?.Object;
              }
              if (Object.keys(currentEvent.Arguments || {}).length === 0) {
                delete currentEvent.Arguments;
              }
            }
          }
        }

        return newData;
      });

      const fieldPath = type.startsWith('Object.') ? 
        `Arguments.Object.${type.slice(7)}` : 
        type.startsWith('Arguments.') ? type : type;

      const response = await syncAnnotation({
        fieldPath,
        answer: type === 'Main Action' ? { text: '' } : null,
        isDelete: true,
        paperIndex: currentPosition.paperIndex,
        eventIndex: currentPosition.eventIndex,
        annotationId
      });

      if (!response.success) throw new Error('Failed to delete annotation');

      setLastSaved(new Date());
      showToast(SUCCESS_MESSAGES.ANNOTATION_DELETED, "success");

    } catch (error) {
      showToast(ERROR_MESSAGES.DELETE_FAILED, "error");
      if (fileData) {
        setLocalFileData(JSON.parse(JSON.stringify(fileData)));
      }
    }
  }, [currentPosition, syncAnnotation, showToast, fileData, isViewMode]);

  const handleSummaryDelete = useCallback(async () => {
    if (!eventType || !currentPosition || isViewMode) return;

    try {
      const response = await syncAnnotation({
        fieldPath: eventType,
        answer: { text: '' },
        paperIndex: currentPosition.paperIndex,
        eventIndex: currentPosition.eventIndex,
        isDelete: true
      });

      if (!response.success) throw new Error('Failed to update');

      setLocalFileData(prev => {
        if (!prev?.papers) return prev;
        const newData = JSON.parse(JSON.stringify(prev));
        const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
        
        if (currentEvent) {
          currentEvent[eventType] = '';
          if (!currentEvent.ArgumentPositions) {
            currentEvent.ArgumentPositions = {};
          }
          currentEvent.ArgumentPositions[eventType] = [];
        }
        
        return newData;
      });

      setSummaryInput('');
      setLastSaved(new Date());
      showToast('Summary deleted successfully', 'success');
    } catch (error) {
      showToast(ERROR_MESSAGES.DELETE_FAILED, "error");
    }
  }, [eventType, currentPosition, isViewMode, syncAnnotation, showToast]);

  const handleSummaryChange = useCallback(async (newValue) => {
    if (!eventType || !currentPosition || isViewMode) return;
    
    try {
      const trimmedValue = typeof newValue === 'string' ? newValue.trim() : 
                          Array.isArray(newValue) ? newValue[0]?.trim() : '';

      const response = await syncAnnotation({
        fieldPath: eventType,
        answer: { text: trimmedValue },
        paperIndex: currentPosition.paperIndex,
        eventIndex: currentPosition.eventIndex
      });

      if (!response.success) throw new Error('Failed to save');

      setLocalFileData(prev => {
        if (!prev?.papers) return prev;
        const newData = JSON.parse(JSON.stringify(prev));
        const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
        
        if (currentEvent) {
          currentEvent[eventType] = trimmedValue;
          
          if (!currentEvent.ArgumentPositions) {
            currentEvent.ArgumentPositions = {};
          }
          
          if (trimmedValue) {
            currentEvent.ArgumentPositions[eventType] = [{
              annotationId: response.data.annotationId
            }];
          } else {
            currentEvent.ArgumentPositions[eventType] = [];
          }
        }
        
        return newData;
      });

      setLastSaved(new Date());
      showToast(
        trimmedValue ? SUCCESS_MESSAGES.SUMMARY_SAVED : SUCCESS_MESSAGES.SUMMARY_DELETED,
        "success"
      );
    } catch (error) {
      showToast('Failed to save summary', "error");
    }
  }, [eventType, currentPosition, isViewMode, syncAnnotation, showToast]);

  const handleCompletion = useCallback(async () => {
    if (!mountedRef.current || isCompleting || isViewMode) return;

    try {
      setIsCompleting(true);
      showToast('Finalizing annotations...', 'info');

      await fileApi.updateFileStatus(fileId, 'completed');
      const success = await finalizeSync();

      if (success && mountedRef.current) {
        await fileApi.updateFileProgress(fileId, { paperIndex: 0, eventIndex: 0 });
        showToast('Annotations completed successfully!', 'success');
        navigate('/', { replace: true });
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      if (mountedRef.current) {
        setIsCompleting(false);
        showToast(ERROR_MESSAGES.SAVE_FAILED, 'error');
      }
    }
  }, [fileId, finalizeSync, navigate, showToast, isCompleting, isViewMode]);

  const handleMoveNext = useCallback(async () => {
    if (isViewMode) {
      const nextPosition = { ...viewModePosition };
      const currentPaper = localFileData?.papers?.[viewModePosition.paperIndex];
      
      // Check if we've reached the end of current paper's events
      if (nextPosition.eventIndex + 1 >= (currentPaper?.events?.length || 0)) {
        // Check if there's another paper
        if (nextPosition.paperIndex + 1 < (localFileData?.papers?.length || 0)) {
          // Move to first event of next paper
          nextPosition.paperIndex += 1;
          nextPosition.eventIndex = 0;
        } else {
          showToast('No more events in this paper', 'info');
          return;
        }
      } else {
        // Move to next event in current paper
        nextPosition.eventIndex += 1;
      }
  
      setViewModePosition(nextPosition);
      setCurrentPosition(nextPosition);
      return;
    }
  
    // Edit mode
    if (hasUnsavedChanges) {
      showToast('Please save your changes before continuing', 'warning');
      return;
    }
  
    const nextPosition = { ...currentPosition };
    const currentPaper = fileData?.papers?.[currentPosition.paperIndex];
  
    if (nextPosition.eventIndex + 1 >= (currentPaper?.events?.length || 0)) {
      if (nextPosition.paperIndex + 1 < (fileData?.papers?.length || 0)) {
        nextPosition.paperIndex += 1;
        nextPosition.eventIndex = 0;
      } else {
        return; // Let the existing isLastField logic handle this case
      }
    } else {
      nextPosition.eventIndex += 1;
    }
  
    try {
      await fileApi.updateFileProgress(fileId, nextPosition);
      moveNext();
    } catch (error) {
      console.error('Error updating progress:', error);
      showToast('Failed to update progress', 'error');
    }
  }, [hasUnsavedChanges, moveNext, showToast, fileId, currentPosition, isViewMode, viewModePosition, localFileData, fileData, setCurrentPosition]);
  
  const handleMovePrevious = useCallback(async () => {
    if (isViewMode) {
      const prevPosition = { ...viewModePosition };
  
      // Check if we're at the first event of current paper
      if (prevPosition.eventIndex <= 0) {
        // Check if there's a previous paper
        if (prevPosition.paperIndex > 0) {
          // Move to last event of previous paper
          prevPosition.paperIndex -= 1;
          const previousPaper = localFileData?.papers?.[prevPosition.paperIndex];
          prevPosition.eventIndex = (previousPaper?.events?.length || 1) - 1;
        } else {
          showToast('Already at the first event', 'info');
          return;
        }
      } else {
        // Move to previous event in current paper
        prevPosition.eventIndex -= 1;
      }
  
      setViewModePosition(prevPosition);
      setCurrentPosition(prevPosition);
      return;
    }
  
    // Edit mode
    if (hasUnsavedChanges) {
      showToast('Please save your changes before continuing', 'warning');
      return;
    }
  
    const prevPosition = { ...currentPosition };
  
    if (prevPosition.eventIndex <= 0) {
      if (prevPosition.paperIndex > 0) {
        prevPosition.paperIndex -= 1;
        const previousPaper = fileData?.papers?.[prevPosition.paperIndex];
        prevPosition.eventIndex = (previousPaper?.events?.length || 1) - 1;
      } else {
        return; // Let the existing isFirstField logic handle this case
      }
    } else {
      prevPosition.eventIndex -= 1;
    }
  
    try {
      await fileApi.updateFileProgress(fileId, prevPosition);
      movePrevious();
    } catch (error) {
      console.error('Error updating progress:', error);
      showToast('Failed to update progress', 'error');
    }
  }, [hasUnsavedChanges, movePrevious, showToast, fileId, currentPosition, isViewMode, viewModePosition, localFileData, fileData, setCurrentPosition]);

  // Process event data for display
  const { cleanedEvent, displayAnnotations } = useMemo(() => {
    if (!localFileData?.papers) {
      return { cleanedEvent: null, displayAnnotations: [] };
    }

    const currentPaper = localFileData.papers[currentPosition.paperIndex];
    const currentEvent = currentPaper?.events[currentPosition.eventIndex];

    if (!currentEvent || !eventType) {
      return { cleanedEvent: null, displayAnnotations: [] };
    }

    const cleaned = {
      Text: currentEvent.Text || '',
      [eventType]: currentEvent[eventType] || '',
      'Main Action': currentEvent['Main Action'] || '',
      Arguments: {
        Agent: [],
        Object: {
          'Primary Object': [],
          'Primary Modifier': [],
          'Secondary Object': [],
          'Secondary Modifier': []
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
      },
      ArgumentPositions: currentEvent.ArgumentPositions || {}
    };

    const annotations = [];

    if (currentEvent['Main Action'] && currentEvent.ArgumentPositions?.['Main Action']) {
      currentEvent.ArgumentPositions['Main Action'].forEach((position, idx) => {
        if (position) {
          annotations.push({
            text: currentEvent['Main Action'],
            type: 'Main Action',
            start: position.start,
            end: position.end,
            id: `main-action-${idx}`,
            annotationId: position.annotationId
          });
        }
      });
    }

    if (currentEvent.Arguments) {
      Object.entries(currentEvent.Arguments).forEach(([key, value]) => {
        if (!value) return;

        if (key === 'Object') {
          Object.entries(value).forEach(([objKey, objValue]) => {
            if (!objValue) return;
            const values = Array.isArray(objValue) ? objValue : [objValue];
            cleaned.Arguments.Object[objKey] = values;

            const positions = currentEvent.ArgumentPositions?.[`Arguments.Object.${objKey}`] || [];
            values.forEach((v, idx) => {
              const position = positions[idx];
              if (position) {
                annotations.push({
                  text: typeof v === 'object' ? v.text : v,
                  type: `Arguments.Object.${objKey}`,
                  start: position.start,
                  end: position.end,
                  id: `object-${objKey}-${idx}`,
                  annotationId: position.annotationId
                });
              }
            });
          });
        } else {
          const values = Array.isArray(value) ? value : [value];
          cleaned.Arguments[key] = values;

          const positions = currentEvent.ArgumentPositions?.[`Arguments.${key}`] || [];
          values.forEach((v, idx) => {
            const position = positions[idx];
            if (position) {
              annotations.push({
                text: typeof v === 'object' ? v.text : v,
                type: `Arguments.${key}`,
                start: position.start,
                end: position.end,
                id: `${key.toLowerCase()}-${idx}`,
                annotationId: position.annotationId
              });
            }
          });
        }
      });
    }

    return {
      cleanedEvent: cleaned,
      displayAnnotations: annotations.sort((a, b) => a.start - b.start)
    };
  }, [localFileData, currentPosition, eventType]);

  // Effects


  
  useEffect(() => {
    if (isViewMode) {
      setViewModePosition({ paperIndex: 0, eventIndex: 0 });
      setCurrentPosition({ paperIndex: 0, eventIndex: 0 });
    }
  }, [isViewMode, setCurrentPosition]);

  useEffect(() => {
    if (fileData) {
      setLocalFileData(fileData);
    }
  }, [fileData]);

  useEffect(() => {
    if (!isViewMode) {
      const fetchProgress = async () => {
        try {
          const file = await fileApi.getFile(fileId);
          if (file?.progress) {
            setCurrentPosition(file.progress);
          }
        } catch (error) {
          console.error('Error fetching progress:', error);
        }
      };
      fetchProgress();
    }
  }, [fileId, setCurrentPosition, isViewMode]);

  useEffect(() => {
    if (cleanedEvent && eventType) {
      setSummaryInput(cleanedEvent[eventType] || '');
    }
  }, [cleanedEvent, eventType]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isLoaded, isSignedIn, navigate]);

  

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const updateFileStatus = async () => {
      if (fileId && isSignedIn && !isViewMode) {
        try {
          await fileApi.updateFileStatus(fileId, 'started');
        } catch (error) {
          console.error('Error updating file status:', error);
        }
      }
    };
    updateFileStatus();
  }, [fileId, isSignedIn, isViewMode]);

  // Early returns
  if (!isLoaded || !user) return <LoadingView />;
  if (!isSignedIn) return null;
  if (loading) return <LoadingView />;
  if (error) return <ErrorView error={error} onBack={handleBack} />;
  if (!getCurrentEvent() || !getCurrentPaper()) {
    return <ErrorView error={ERROR_MESSAGES.NO_DATA} onBack={handleBack} />;
  }

  const currentPaper = getCurrentPaper();

  return (
    <div className="min-h-screen bg-gray-50">
      <TutorialDialog 
        isOpen={showTutorial} 
        onClose={() => setShowTutorial(false)} 
      />
      
      <AnnotationHeader
        currentPaper={currentPaper}
        currentPosition={currentPosition}
        fileData={fileData}
        syncStatus={syncStatus.status}
        lastSaved={lastSaved}
        onBack={handleBack}
        onOpenGuide={() => window.open('/docs/annotation_guide.pdf', '_blank')}
        onShowTutorial={() => setShowTutorial(true)}
      />

      <main className="pt-24 pb-20 px-4">
        <div className="max-w-[95%] mx-auto space-y-6">
          <AbstractSection
            abstract={currentPaper?.abstract}
            isOpen={isAbstractOpen}
            onToggle={() => setIsAbstractOpen(!isAbstractOpen)}
          />

          <AnnotationMain
            eventType={eventType}
            cleanedEvent={cleanedEvent}
            displayAnnotations={displayAnnotations}
            selectedText={selectedText}
            onTextSelect={handleTextSelect}
            onAnnotationSelect={handleAnnotationSelect}
            onAnnotationDelete={handleAnnotationDelete}
            summaryInput={summaryInput}
            onSummaryChange={handleSummaryChange}
            onSummaryDelete={handleSummaryDelete}
            fileData={fileData}
            localFileData={localFileData}  
            isViewMode={isViewMode}
            onHasUnsavedChanges={setHasUnsavedChanges}
            showToast={showToast}
          />
        </div>
      </main>

      <AnnotationFooter
        onPrevious={handleMovePrevious}
        onNext={isViewMode ? 
          (isLastField ? handleBack : handleMoveNext) : 
          (isLastField ? handleCompletion : handleMoveNext)}
        isFirstField={isFirstField}
        isLastField={isLastField}
        isCompleting={isCompleting}
        isOnline={isOnline}
        hasUnsavedChanges={hasUnsavedChanges}
        isViewMode={isViewMode}
      />

      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => hideToast(toast.id)}
          index={index}
        />
      ))}
    </div>
  );
};

export default memo(UserAnnotationDashboard);