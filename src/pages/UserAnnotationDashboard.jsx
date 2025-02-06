import React, { useEffect, useCallback, memo, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
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
import Toast from '../components/annotation/Toast';



const UserAnnotationDashboard = ({ mode = 'edit' }) => {
  console.log('Dashboard initializing with mode:', mode);

  const mountedRef = useRef(true);
  const navigate = useNavigate();


  const { fileId } = useParams();
  console.log('FileId from params:', fileId);
  
  const { user } = useUser();
  const { isLoaded, isSignedIn } = useAuth();
  const [toasts, setToasts] = useState([]);
  // State
  const [selectedText, setSelectedText] = useState(null);
  const [isAbstractOpen, setIsAbstractOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [summaryInput, setSummaryInput] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [localFileData, setLocalFileData] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const showToast = useCallback((message, type = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  }, []);


  const hideToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);


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

  // In UserAnnotationDashboard.jsx
  const handleAnnotationSelect = useCallback(async (type, selection) => {
    console.log('Annotation select:', { type, selection });
    if (!selection || !currentPosition) {
      console.log('Missing selection or position');
      return;
    }
  
    try {
      const currentEvent = getCurrentEvent();
      console.log('Current event:', currentEvent);
  
      // Modified Main Action check to handle empty strings
      if (type === 'Main Action' && currentEvent['Main Action']?.trim?.()) {
        console.log('Main action already exists');
        showToast(ERROR_MESSAGES.MAIN_ACTION_EXISTS, "error");
        return;
      }
  
      if (!validateAnnotation(selection, currentEvent?.Text)) {
        console.log('Invalid annotation');
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
  
      // First update local state for immediate feedback
      const updateState = (prev) => {
        if (!prev?.papers) return prev;
        const newData = JSON.parse(JSON.stringify(prev));
        const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
        
        // Generate a temporary ID for immediate UI update
        const tempId = `temp-${Date.now()}`;
        const spanWithId = { 
          ...annotationData.span,
          annotationId: tempId
        };
  
        if (!currentEvent.Arguments) currentEvent.Arguments = {};
        if (!currentEvent.ArgumentPositions) currentEvent.ArgumentPositions = {};
  
        if (type === 'Main Action') {
          // Initialize Main Action even if it didn't exist before
          currentEvent['Main Action'] = annotationData.text;
          currentEvent.ArgumentPositions['Main Action'] = [spanWithId];
        } else {
          // Rest of the code stays the same for other annotations
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
  
      // Update local state immediately
      setLocalFileData(updateState);
  
      // Then sync with server
      const response = await syncAnnotation({
        fieldPath,
        answer: annotationData,
        paperIndex: currentPosition.paperIndex,
        eventIndex: currentPosition.eventIndex
      });
  
      if (!response.success) throw new Error('Failed to save');
  
      // Update the temporary ID with the real one
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
      console.error("Save error:", error);
      showToast(ERROR_MESSAGES.SAVE_FAILED, "error");
      
      // Rollback on error
      if (fileData) {
        setLocalFileData(JSON.parse(JSON.stringify(fileData)));
      }
    }
  }, [currentPosition, syncAnnotation, showToast, validateAnnotation, getCurrentEvent, fileData]);

const handleAnnotationDelete = useCallback(async (type, annotationId) => {
  console.log('Deleting annotation:', { type, annotationId });
  if (!currentPosition || !annotationId) {
    console.warn('Missing required data for deletion:', { currentPosition, annotationId });
    return;
  }

  try {
    // Update local state immediately for UI feedback
    setLocalFileData(prev => {
      if (!prev?.papers) return prev;
      
      const newData = JSON.parse(JSON.stringify(prev));
      const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
      
      if (!currentEvent) return prev;

      if (type === 'Main Action') {
        // Set to empty instead of deleting for Main Action
        currentEvent['Main Action'] = '';
        if (currentEvent.ArgumentPositions) {
          currentEvent.ArgumentPositions['Main Action'] = [];
        }
      } else {
        // Handle Arguments deletion - keep this part as is
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

            // Keep cleanup logic for arguments
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

    // Sync with server
    const fieldPath = type.startsWith('Object.') ? 
      `Arguments.Object.${type.slice(7)}` : 
      type.startsWith('Arguments.') ? type : type;

    const response = await syncAnnotation({
      fieldPath,
      answer: type === 'Main Action' ? { text: '' } : null,  // Empty string for Main Action
      isDelete: true,
      paperIndex: currentPosition.paperIndex,
      eventIndex: currentPosition.eventIndex,
      annotationId
    });

    if (!response.success) throw new Error('Failed to delete annotation');

    setLastSaved(new Date());
    showToast(SUCCESS_MESSAGES.ANNOTATION_DELETED, "success");

  } catch (error) {
    console.error('Delete error:', error);
    showToast(ERROR_MESSAGES.DELETE_FAILED, "error");
    
    // Rollback on error by reloading from fileData
    if (fileData) {
      setLocalFileData(JSON.parse(JSON.stringify(fileData)));
    }
  }
}, [currentPosition, syncAnnotation, showToast, fileData]);

// In UserAnnotationDashboard.jsx
const handleSummaryDelete = useCallback(async () => {
  console.log('Summary delete triggered');
  if (!eventType || !currentPosition || mode === 'view') return;

  try {
    const currentEvent = getCurrentEvent();
    console.log('Current event before deletion:', currentEvent);
    
    // Send update request with empty string instead of delete
    const response = await syncAnnotation({
      fieldPath: eventType,
      answer: { text: '' },
      paperIndex: currentPosition.paperIndex,
      eventIndex: currentPosition.eventIndex,
      isDelete: true  // Changed back to true for proper deletion
    });

    if (!response.success) throw new Error('Failed to update');

    setLocalFileData(prev => {
      if (!prev?.papers) return prev;
      const newData = JSON.parse(JSON.stringify(prev));
      const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
      
      if (currentEvent) {
        // Set empty string instead of deleting
        currentEvent[eventType] = '';
        
        // Clear annotations but maintain the structure
        if (!currentEvent.ArgumentPositions) {
          currentEvent.ArgumentPositions = {};
        }
        currentEvent.ArgumentPositions[eventType] = [];
      }
      
      return newData;
    });

    setSummaryInput('');  // Clear the input
    setLastSaved(new Date());
    showToast('Summary deleted successfully', 'success');
    console.log('Summary cleared successfully');
  } catch (error) {
    console.error('Error clearing summary:', error);
    showToast(ERROR_MESSAGES.DELETE_FAILED, "error");
  }
}, [eventType, currentPosition, mode, syncAnnotation, showToast, getCurrentEvent]);

const handleSummaryChange = useCallback(async (newValue) => {
  console.log('Summary change triggered with:', { newValue, eventType, currentPosition });
  if (!eventType || !currentPosition || mode === 'view') return;
  
  try {
    const trimmedValue = typeof newValue === 'string' ? newValue.trim() : 
                        Array.isArray(newValue) ? newValue[0]?.trim() : '';

    // Always send an update, even for empty strings
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
          // If there's a value, set the annotation ID
          currentEvent.ArgumentPositions[eventType] = [{
            annotationId: response.data.annotationId
          }];
        } else {
          // If empty, clear annotations but maintain structure
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
    console.error('Error saving summary:', error);
    showToast('Failed to save summary', "error");
  }
}, [eventType, currentPosition, mode, syncAnnotation, showToast]);
  

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
      showToast('Finalizing annotations...', 'info');
      
      console.log('Calling finalizeSync...');
      const success = await finalizeSync();
      console.log('FinalizeSync result:', success);
      
      if (success && mountedRef.current) {
        console.log('Success, dispatching update and navigating');
        window.dispatchEvent(new Event('annotationUpdate'));
        showToast('Annotations completed successfully!', 'success');
        navigate('/', { replace: true });
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Completion error:', error);
      if (mountedRef.current) {
        setIsCompleting(false);
        showToast(ERROR_MESSAGES.SAVE_FAILED, 'error');
      }
    }
  }, [finalizeSync, navigate, showToast, isCompleting, isOnline]);


  // Add these handlers for navigation
const handleMoveNext = useCallback(() => {
  if (hasUnsavedChanges) {
    showToast('Please save your changes before continuing', 'warning');
    return;
  }
  moveNext();
}, [hasUnsavedChanges, moveNext, showToast]);

const handleMovePrevious = useCallback(() => {
  if (hasUnsavedChanges) {
    showToast('Please save your changes before continuing', 'warning');
    return;
  }
  movePrevious();
}, [hasUnsavedChanges, movePrevious, showToast]);

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
          //console.log('Processing regular argument:', { key, values });

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
  }, [localFileData, currentPosition, eventType, lastSaved]);

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
            localFileData={localFileData}  
            isViewMode={isViewMode}
            onHasUnsavedChanges={setHasUnsavedChanges} // Add this line
            showToast={showToast}
          />
        </div>
      </main>

      {/* Modified footer condition to show in both edit and view modes */}
      <AnnotationFooter
        onPrevious={handleMovePrevious} // Use new handler
        onNext={isViewMode ? 
          (isLastField ? handleBack : handleMoveNext) : // Use new handler
          (isLastField ? handleCompletion : handleMoveNext)} // Use new handler
        isFirstField={isFirstField}
        isLastField={isLastField}
        isCompleting={isCompleting}
        isOnline={isOnline}
        hasUnsavedChanges={hasUnsavedChanges}
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
