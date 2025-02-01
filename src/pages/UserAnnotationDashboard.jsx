import React, { useEffect, useCallback, memo, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useSnackbar } from '../hooks/useSnackbar';
import { useAnnotation } from '../hooks/useAnnotation';
import { useAnnotationSync } from '../hooks/useAnnotationSync';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants/annotation';

import AnnotationHeader from '../components/annotation/AnnotationHeader';
import AnnotationMain from '../components/annotation/AnnotationMain';
import AnnotationFooter from '../components/annotation/AnnotationFooter';
import AbstractSection from '../components/annotation/AbstractSection';
import TutorialDialog from '../components/annotation/TutorialDialog';
import LoadingView from '../components/common/LoadingView';
import ErrorView from '../components/common/ErrorView';



const UserAnnotationDashboard = ({ mode = 'edit' }) => {
  console.log('Dashboard initializing with mode:', mode);

  const mountedRef = useRef(true);
  const navigate = useNavigate();


  const { fileId } = useParams();
  console.log('FileId from params:', fileId);
  
  const { user } = useUser();
  const { isLoaded, isSignedIn } = useAuth();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  // State
  const [selectedText, setSelectedText] = useState(null);
  const [isAbstractOpen, setIsAbstractOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [summaryInput, setSummaryInput] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [localFileData, setLocalFileData] = useState(null);

  console.log('State initialized:', {
    hasSelectedText: !!selectedText,
    isAbstractOpen,
    isCompleting,
    hasSummaryInput: !!summaryInput,
    showTutorial,
    lastSaved,
    hasLocalFileData: !!localFileData
  });

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
    progress
  } = useAnnotation(fileId, navigate, user?.id);

  console.log('useAnnotation hook result:', {
    currentPosition,
    hasFileData: !!fileData,
    loading,
    error,
    eventType,
    progress,
    isFirstField,
    isLastField
  });

  const { 
    syncStatus, 
    syncAnnotation, 
    finalizeSync,
    isOnline 
  } = useAnnotationSync(fileId, user?.id, loadFileData);

  console.log('Sync status:', syncStatus);

  // Event Handlers
  const handleBack = useCallback(() => {
    console.log('Navigating back to dashboard');
    navigate('/');
  }, [navigate]);

  const handleTextSelect = useCallback((selection) => {
    console.log('Text selection:', selection);
    if (!selection) {
      console.log('Clearing text selection');
      setSelectedText(null);
      return;
    }
    if (selection.start === undefined || selection.end === undefined) {
      console.log('Invalid selection bounds');
      return;
    }
    setSelectedText({
      text: selection.text,
      start: selection.start,
      end: selection.end,
    });
    console.log('Text selection set:', selection);
  }, []);

  const validateAnnotation = useCallback((selection, eventText) => {
    console.log('Validating annotation:', { selection, eventText });
    if (!selection || !eventText) {
      console.log('Missing selection or event text');
      return false;
    }

    const textContainerRef = document.createElement('div');
    textContainerRef.textContent = eventText;
    const range = document.createRange();
    const tempTextNode = textContainerRef.firstChild;
    
    if (!tempTextNode) {
      console.log('No text node found');
      return false;
    }

    try {
      range.setStart(tempTextNode, selection.start);
      range.setEnd(tempTextNode, selection.end);
      const textAtPosition = eventText.substring(selection.start, selection.end);
      const isValid = textAtPosition === selection.text.trim();
      console.log('Validation result:', isValid);
      return isValid;
    } catch (error) {
      console.error("Validation error:", error);
      return false;
    }
  }, []);

  const handleAnnotationSelect = useCallback(async (type, selection) => {
    console.log('Annotation select:', { type, selection });
    if (!selection || !currentPosition) {
      console.log('Missing selection or position');
      return;
    }
  
    try {
      const currentEvent = getCurrentEvent();
      console.log('Current event:', currentEvent);

      if (type === 'Main Action' && currentEvent['Main Action']) {
        console.log('Main action already exists');
        showSnackbar(ERROR_MESSAGES.MAIN_ACTION_EXISTS, "error");
        return;
      }
  
      if (!validateAnnotation(selection, currentEvent?.Text)) {
        console.log('Invalid annotation');
        showSnackbar(ERROR_MESSAGES.INVALID_SELECTION, "error");
        return;
      }
  
      const annotationData = {
        text: selection.text.trim(),
        span: {
          start: selection.start,
          end: selection.end
        }
      };
      console.log('Annotation data:', annotationData);
  
      let fieldPath = type;
      if (type.startsWith('Object.')) {
        fieldPath = `Arguments.Object.${type.slice(7)}`;
      } else if (!type.startsWith('Arguments.') && type !== 'Main Action') {
        fieldPath = `Arguments.${type}`;
      }
      console.log('Field path:', fieldPath);
  
      const response = await syncAnnotation({
        fieldPath,
        answer: annotationData,
        paperIndex: currentPosition.paperIndex,
        eventIndex: currentPosition.eventIndex
      });
      console.log('Sync response:', response);
  
      if (!response.success) throw new Error('Failed to save');
  
      setLocalFileData(prev => {
        console.log('Updating local file data');
        if (!prev?.papers) return prev;
        const newData = JSON.parse(JSON.stringify(prev));
        const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
        
        const spanWithId = { 
          ...annotationData.span,
          annotationId: response.data.annotationId
        };
  
        if (!currentEvent.Arguments) currentEvent.Arguments = {};
        if (!currentEvent.ArgumentPositions) currentEvent.ArgumentPositions = {};
  
        if (type === 'Main Action') {
          currentEvent['Main Action'] = annotationData.text;
          currentEvent.ArgumentPositions['Main Action'] = [spanWithId];
        } else if (type.startsWith('Arguments.Object.')) {
          const [, , objectType] = type.split('.');
          if (!currentEvent.Arguments.Object) currentEvent.Arguments.Object = {};
          if (!currentEvent.Arguments.Object[objectType]) currentEvent.Arguments.Object[objectType] = [];
          
          currentEvent.Arguments.Object[objectType].push(annotationData.text);
          currentEvent.ArgumentPositions[`Arguments.Object.${objectType}`] = 
            currentEvent.ArgumentPositions[`Arguments.Object.${objectType}`] || [];
          currentEvent.ArgumentPositions[`Arguments.Object.${objectType}`].push(spanWithId);
        } else {
          const argumentType = type.replace('Arguments.', '');
          if (!currentEvent.Arguments[argumentType]) currentEvent.Arguments[argumentType] = [];
          
          currentEvent.Arguments[argumentType].push(annotationData.text);
          currentEvent.ArgumentPositions[fieldPath] = currentEvent.ArgumentPositions[fieldPath] || [];
          currentEvent.ArgumentPositions[fieldPath].push(spanWithId);
        }
        
        console.log('Updated event:', currentEvent);
        return newData;
      });
  
      setSelectedText(null);
      setLastSaved(new Date());
      showSnackbar(SUCCESS_MESSAGES.ANNOTATION_SAVED, "success");
      console.log('Annotation saved successfully');
  
    } catch (error) {
      console.error("Save error:", error);
      showSnackbar(ERROR_MESSAGES.SAVE_FAILED, "error");
    }
  }, [currentPosition, syncAnnotation, showSnackbar, validateAnnotation, getCurrentEvent]);

  const handleAnnotationDelete = useCallback(async (type, annotationId) => {
    console.log('Deleting annotation:', { type, annotationId });
    if (!currentPosition) return;

    try {
      const fieldPath = type.startsWith('Object.') ? 
        `Arguments.Object.${type.slice(7)}` : 
        type.startsWith('Arguments.') ? type : type;
      console.log('Field path for deletion:', fieldPath);

      const response = await syncAnnotation({
        fieldPath,
        answer: null,
        isDelete: true,
        paperIndex: currentPosition.paperIndex,
        eventIndex: currentPosition.eventIndex,
        annotationId
      });
      console.log('Delete response:', response);

      if (!response.success) throw new Error('Failed to delete');

      setLocalFileData(prev => {
        console.log('Updating local data after deletion');
        if (!prev?.papers) return prev;
        const newData = JSON.parse(JSON.stringify(prev));
        const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
        
        if (!currentEvent) return prev;

        if (type === 'Main Action') {
          currentEvent['Main Action'] = '';
          delete currentEvent.ArgumentPositions?.['Main Action'];
        } else {
          const positions = currentEvent.ArgumentPositions?.[fieldPath] || [];
          const posIndex = positions.findIndex(p => p.annotationId === annotationId);

          if (posIndex > -1) {
            positions.splice(posIndex, 1);
            
            if (type.startsWith('Arguments.Object.')) {
              const objectKey = type.split('.').pop();
              currentEvent.Arguments.Object[objectKey].splice(posIndex, 1);
              if (currentEvent.Arguments.Object[objectKey].length === 0) {
                delete currentEvent.Arguments.Object[objectKey];
              }
            } else {
              const argType = type.replace('Arguments.', '');
              currentEvent.Arguments[argType].splice(posIndex, 1);
              if (currentEvent.Arguments[argType].length === 0) {
                delete currentEvent.Arguments[argType];
              }
            }
          }
        }

        console.log('Updated event after deletion:', currentEvent);
        return newData;
      });

      setLastSaved(new Date());
      showSnackbar(SUCCESS_MESSAGES.ANNOTATION_DELETED, "success");
      console.log('Annotation deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      showSnackbar(ERROR_MESSAGES.DELETE_FAILED, "error");
    }
  }, [currentPosition, syncAnnotation, showSnackbar]);

  const handleSummaryDelete = useCallback(async () => {
    console.log('Summary delete triggered');
    if (!eventType || !currentPosition || mode === 'view') return;
  
    try {
      const currentEvent = getCurrentEvent();
      console.log('Current event before deletion:', currentEvent);
      
      // Send explicit delete request
      const response = await syncAnnotation({
        fieldPath: eventType,
        answer: null,
        paperIndex: currentPosition.paperIndex,
        eventIndex: currentPosition.eventIndex,
        isDelete: true  // Changed to true for explicit deletion
      });
  
      if (!response.success) throw new Error('Failed to delete');
  
      setLocalFileData(prev => {
        if (!prev?.papers) return prev;
        const newData = JSON.parse(JSON.stringify(prev));
        const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
        
        if (currentEvent) {
          // Completely remove the event type field
          delete currentEvent[eventType];
          
          // Remove from ArgumentPositions if it exists
          if (currentEvent.ArgumentPositions?.[eventType]) {
            delete currentEvent.ArgumentPositions[eventType];
          }
        }
        
        return newData;
      });
  
      setSummaryInput('');  // Clear the input
      setLastSaved(new Date());
      showSnackbar(SUCCESS_MESSAGES.SUMMARY_DELETED, "success");
      console.log('Summary deleted successfully');
    } catch (error) {
      console.error('Error deleting summary:', error);
      showSnackbar(ERROR_MESSAGES.DELETE_FAILED, "error");
    }
  }, [eventType, currentPosition, mode, syncAnnotation, showSnackbar, getCurrentEvent]);
  
  const handleSummaryChange = useCallback(async (newValue) => {
    console.log('Summary change triggered with:', { newValue, eventType, currentPosition });
    if (!eventType || !currentPosition || mode === 'view') return;
    
    try {
      // Handle null, undefined, or empty string cases
      if (newValue === null || newValue === undefined || newValue === '') {
        console.log('Empty value detected, triggering delete');
        await handleSummaryDelete();
        return;
      }
  
      const trimmedValue = typeof newValue === 'string' ? newValue.trim() : 
                          Array.isArray(newValue) ? newValue[0]?.trim() : '';
  
      // If trimmed to empty, trigger delete
      if (!trimmedValue) {
        console.log('Trimmed to empty, triggering delete');
        await handleSummaryDelete();
        return;
      }
  
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
          currentEvent.ArgumentPositions[eventType] = [{
            annotationId: response.data.annotationId
          }];
        }
        
        return newData;
      });
  
      setLastSaved(new Date());
      showSnackbar(SUCCESS_MESSAGES.SUMMARY_SAVED, "success");
    } catch (error) {
      console.error('Error saving summary:', error);
      showSnackbar('Failed to save summary', "error");
    }
  }, [eventType, currentPosition, mode, syncAnnotation, handleSummaryDelete, showSnackbar]);
  
  

  const handleCompletion = useCallback(async () => {
    console.log('Starting completion process:', {
      isMounted: mountedRef.current,
      isCompleting,
      isOnline
    });
    
    if (!mountedRef.current || isCompleting) {
      console.log('Early return due to:', {
        notMounted: !mountedRef.current,
        isCompleting
      });
      return;
    }
    
    try {
      setIsCompleting(true);
      showSnackbar('Finalizing annotations...', 'info');
      
      console.log('Calling finalizeSync...');
      const success = await finalizeSync();
      console.log('FinalizeSync result:', success);
      
      if (success && mountedRef.current) {
        console.log('Success, dispatching update and navigating');
        window.dispatchEvent(new Event('annotationUpdate'));
        showSnackbar('Annotations completed successfully!', 'success');
        navigate('/', { replace: true });
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Completion error:', error);
      if (mountedRef.current) {
        setIsCompleting(false);
        showSnackbar(ERROR_MESSAGES.SAVE_FAILED, 'error');
      }
    }
  }, [finalizeSync, navigate, showSnackbar, isCompleting, isOnline]);

  // Process event data for display
  const { cleanedEvent, displayAnnotations } = useMemo(() => {
    console.log('Processing event data:', {
      hasLocalFileData: !!localFileData,
      currentPosition,
      eventType
    });
  
    if (!localFileData?.papers) {
      console.log('No papers in local file data');
      return { cleanedEvent: null, displayAnnotations: [] };
    }
  
    const currentPaper = localFileData.papers[currentPosition.paperIndex];
    const currentEvent = currentPaper?.events[currentPosition.eventIndex];
    console.log('Current event:', currentEvent);
  
    if (!currentEvent || !eventType) {
      console.log('Missing current event or event type');
      return { cleanedEvent: null, displayAnnotations: [] };
    }
  
    const cleaned = {
      Text: currentEvent.Text || '',
      // Ensure event type field is initialized
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
            console.log('Processing object argument:', { objKey, values });

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
          console.log('Processing regular argument:', { key, values });

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

    console.log('Finished processing event data:', {
      cleanedEventSize: Object.keys(cleaned).length,
      annotationsCount: annotations.length
    });

    return {
      cleanedEvent: cleaned,
      displayAnnotations: annotations.sort((a, b) => a.start - b.start)
    };
  }, [localFileData, currentPosition, eventType]);

  // Effects
  useEffect(() => {
    console.log('fileData effect triggered:', fileData);
    if (fileData) {
      console.log('Setting localFileData from fileData');
      setLocalFileData(fileData);
    }
  }, [fileData]);

  useEffect(() => {
    if (cleanedEvent && eventType) {
      const currentSummary = cleanedEvent[eventType] || '';
      console.log('Setting summary input from cleanedEvent:', { eventType, currentSummary });
      setSummaryInput(currentSummary);
    }
  }, [cleanedEvent, eventType]);

  useEffect(() => {
    console.log('Auth state changed:', { isLoaded, isSignedIn });
    if (isLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isLoaded, isSignedIn, navigate]);

  useEffect(() => {
    mountedRef.current = true;
    console.log('Component mounted, setting mountedRef to true');
    
    return () => {
      console.log('Component actually unmounting');
      mountedRef.current = false;
    };
  }, []);

  // Early returns
  if (!isLoaded || !user) {
    console.log('Early return: Not loaded or no user');
    return <LoadingView />;
  }
  if (!isSignedIn) {
    console.log('Early return: Not signed in');
    return null;
  }
  if (loading) {
    console.log('Early return: Loading');
    return <LoadingView />;
  }
  if (error) {
    console.log('Early return: Error', error);
    return <ErrorView error={error} onBack={handleBack} />;
  }
  if (!getCurrentEvent() || !getCurrentPaper()) {
    console.log('Early return: No current event or paper');
    return <ErrorView error={ERROR_MESSAGES.NO_DATA} onBack={handleBack} />;
  }

  const currentPaper = getCurrentPaper();
  const isViewMode = mode === 'view';

  console.log('Preparing final render:', {
    hasCurrentPaper: !!currentPaper,
    isViewMode,
    hasCleanedEvent: !!cleanedEvent,
    annotationsCount: displayAnnotations.length
  });

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
        progress={progress}
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
            isViewMode={isViewMode}
          />
        </div>
      </main>

      {/* Modified footer condition to show in both edit and view modes */}
      <AnnotationFooter
        onPrevious={movePrevious}
        onNext={isViewMode ? (isLastField ? handleBack : moveNext) : (isLastField ? handleCompletion : moveNext)}
        isFirstField={isFirstField}
        isLastField={isLastField}
        isCompleting={isCompleting}
        isOnline={isOnline}
      />

      {SnackbarComponent}
    </div>
  );
};

export default memo(UserAnnotationDashboard);
