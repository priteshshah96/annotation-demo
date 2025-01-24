import React, { useEffect, useCallback, memo, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { 
  ChevronDown, 
  ChevronUp, 
  HelpCircle, 
  Info, 
  Save,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

import TutorialDialog from '../components/annotation/TutorialDialog';
import useAnnotation from '../hooks/useAnnotation';
import { AnnotationTypes } from '../models/Annotation';
import { useAnnotationSync, SYNC_STATES } from '../hooks/useAnnotationSync';
import { useSnackbar } from '../hooks/useSnackbar';
import JsonViewer from '../components/annotation/JsonViewer';
import TextAnnotationPanel from '../components/annotation/TextAnnotationPanel';
import SummaryInput from '../components/annotation/SummaryInput';

// Reusable Help Button Component with Tooltip
const HelpButton = memo(({ icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="p-2 hover:bg-gray-100 rounded-full transition-colors relative group"
    aria-label={label}
  >
    <Icon className="w-5 h-5 text-blue-600" />
    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 hidden group-hover:block 
                  bg-gray-900 text-white text-sm rounded px-2 py-1 whitespace-nowrap z-50">
      {label}
    </div>
  </button>
));

// Loading Component
const LoadingView = memo(() => (
  <div className="flex justify-center items-center h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
  </div>
));

// Error Component
const ErrorView = memo(({ error, onBack }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <X className="w-8 h-8 text-red-500" />
        <h2 className="text-red-600 text-xl font-bold">Error Occurred</h2>
      </div>
      <p className="text-gray-700 mb-6">{error}</p>
      <button
        onClick={onBack}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 
                 transition-colors duration-200 flex items-center justify-center gap-2"
      >
        <span>Try Again</span>
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  </div>
));

// Sync Status Component
const SyncStatus = memo(({ status, lastSaved }) => {
  const statusStyles = {
    [SYNC_STATES.SAVED]: 'text-green-600',
    [SYNC_STATES.SAVING]: 'text-blue-600',
    [SYNC_STATES.ERROR]: 'text-red-600',
    [SYNC_STATES.OFFLINE]: 'text-orange-600'
  };

  const statusMessages = {
    [SYNC_STATES.SAVED]: lastSaved 
      ? `Last saved at ${new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: 'numeric'
        }).format(lastSaved)}`
      : 'All changes saved',
    [SYNC_STATES.SAVING]: 'Saving changes...',
    [SYNC_STATES.ERROR]: 'Error saving changes',
    [SYNC_STATES.OFFLINE]: 'Working offline'
  };

  return (
    <div className="flex items-center gap-2">
      <Save className={`w-4 h-4 ${statusStyles[status]}`} />
      <span className={`text-sm ${statusStyles[status]}`}>
        {statusMessages[status]}
      </span>
    </div>
  );
});

// Header Component
const Header = memo(({ 
  currentPaper, 
  currentPosition, 
  fileData, 
  syncStatus, 
  lastSaved, 
  onBack, 
  onOpenGuide, 
  onShowTutorial,
  progress 
}) => (
  <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-20">
    <div className="max-w-[95%] mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {currentPaper?.paper_code}
          </h1>
          <SyncStatus status={syncStatus} lastSaved={lastSaved} />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 mr-4">
            <HelpButton
              icon={Info}
              label="View Annotation Guide"
              onClick={onOpenGuide}
            />
            <HelpButton
              icon={HelpCircle}
              label="View Tutorial"
              onClick={onShowTutorial}
            />
          </div>

          <span className="text-sm font-medium text-gray-600">
            Paper {currentPosition.paperIndex + 1} of {fileData?.papers?.length}
          </span>
          <span className="text-lg font-bold text-blue-600">
            Event {currentPosition.eventIndex + 1} of {currentPaper?.events?.length}
          </span>
        </div>
      </div>

      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  </header>
));

const UserAnnotationDashboard = ({ mode = 'edit' }) => {
  // First, initialize all the basic hooks
  const mountedRef = useRef(true);
  const navigate = useNavigate();
  const { fileId } = useParams();
  const { user } = useUser();
  const { isLoaded, isSignedIn } = useAuth();
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Initialize all state first
  const [selectedText, setSelectedText] = useState(null);
  const [isAbstractOpen, setIsAbstractOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [summaryInput, setSummaryInput] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [localFileData, setLocalFileData] = useState(null);

  // Initialize all custom hooks
  const {
    currentPosition,
    fileData,
    loading,
    error,
    moveNext,
    movePrevious,
    handleAnnotationSave,
    getCurrentEvent,
    getCurrentPaper,
    isFirstField,
    isLastField,
    loadFileData
  } = useAnnotation(fileId, navigate, user?.id);

  const { 
    syncStatus, 
    syncAnnotation, 
    finalizeSync,
    isOnline 
  } = useAnnotationSync(fileId, user?.id, loadFileData);

  // Update localFileData when fileData changes
  useEffect(() => {
    if (fileData) {
      setLocalFileData(fileData);
    }
  }, [fileData]);

  // handleBack callback
  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Then compute derived values
  const currentEvent = useMemo(() => getCurrentEvent(), [getCurrentEvent]);
  const currentPaper = useMemo(() => getCurrentPaper(), [getCurrentPaper]);
  
  const eventType = useMemo(() => {
    if (!currentEvent) return null;
    return AnnotationTypes.EVENT_TYPE.find(type => 
      currentEvent[type]?.trim() || type in currentEvent
    );
  }, [currentEvent]);

  const progress = useMemo(() => {
    if (!fileData?.papers) return 0;
    const totalEvents = fileData.papers.reduce((sum, paper) => sum + paper.events.length, 0);
    const currentTotal = (currentPosition.paperIndex * fileData.papers[currentPosition.paperIndex].events.length) 
                        + currentPosition.eventIndex;
    return Math.min(((currentTotal + 1) / totalEvents) * 100, 100);
  }, [fileData, currentPosition]);

  // Helper function to ensure array type
  const ensureArray = useCallback((value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, []);

  // Process event data for display
const { cleanedEvent, displayAnnotations } = useMemo(() => {
  // Use localFileData instead of directly using currentEvent
  if (!localFileData?.papers) {
    return { cleanedEvent: null, displayAnnotations: [] };
  }

  const currentPaper = localFileData.papers[currentPosition.paperIndex];
  const currentEvent = currentPaper?.events[currentPosition.eventIndex];

  if (!currentEvent || !eventType) {
    return { cleanedEvent: null, displayAnnotations: [] };
  }

  // Initialize the cleaned structure
  const cleaned = {
    Text: currentEvent.Text || '',
    [eventType]: currentEvent[eventType] || '',
    'Main Action': null,
    Arguments: {
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
  };

  const annotations = [];

  // Process Main Action annotation with positions
  const mainAction = currentEvent['Main Action'];
  if (mainAction) {
    cleaned['Main Action'] = mainAction;
    
    // Get position from ArgumentPositions
    const mainActionPositions = currentEvent.ArgumentPositions?.['Main Action'] || [];
    mainActionPositions.forEach((pos, idx) => {
      if (pos) {
        annotations.push({
          text: mainAction,
          type: 'Main Action',
          start: pos.start,
          end: pos.end,
          id: `main-action-${idx}`
        });
      }
    });
  }

  // Process all Arguments including Objects
  if (currentEvent.Arguments) {
    Object.entries(currentEvent.Arguments).forEach(([key, value]) => {
      if (!value) return;

      if (key === 'Object') {
        // Handle Object type annotations
        Object.entries(value).forEach(([objKey, objValue]) => {
          if (!objValue) return;

          // Ensure values are always arrays
          const values = Array.isArray(objValue) ? objValue : [objValue];
          
          // Update cleaned structure
          cleaned.Arguments.Object[objKey] = values.map(v => 
            typeof v === 'object' ? v.text || v : v
          );

          // Get positions for this object type
          const positions = currentEvent.ArgumentPositions?.[`Arguments.Object.${objKey}`] || [];
          
          // Create annotations with positions
          values.forEach((v, idx) => {
            const position = positions[idx];
            if (position) {
              annotations.push({
                text: typeof v === 'object' ? v.text : v,
                type: `Arguments.Object.${objKey}`,
                start: position.start,
                end: position.end,
                id: `object-${objKey}-${idx}`
              });
            }
          });
        });
      } else {
        // Handle regular arguments
        const values = Array.isArray(value) ? value : [value];
        
        // Update cleaned structure
        cleaned.Arguments[key] = values.map(v => 
          typeof v === 'object' ? v.text || v : v
        );

        // Get positions for this argument type
        const positions = currentEvent.ArgumentPositions?.[`Arguments.${key}`] || [];
        
        // Create annotations with positions
        values.forEach((v, idx) => {
          const position = positions[idx];
          if (position) {
            annotations.push({
              text: typeof v === 'object' ? v.text : v,
              type: `Arguments.${key}`,
              start: position.start,
              end: position.end,
              id: `${key.toLowerCase()}-${idx}`
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
  // Handlers
  const openAnnotationGuide = useCallback(() => {
    window.open('/docs/annotation_guide.pdf', '_blank');
  }, []);

  const handleTextSelect = useCallback((selection) => {
    if (!selection) {
      console.log("handleTextSelect: No selection provided");
      setSelectedText(null);
      return;
    }
  
    // Ensure that start and end are defined
    if (selection.start === undefined || selection.end === undefined) {
      console.error("handleTextSelect: Invalid selection - start or end is undefined", selection);
      return;
    }
  
    console.log("handleTextSelect: Selection received", {
      text: selection.text,
      start: selection.start,
      end: selection.end,
    });
  
    setSelectedText({
      text: selection.text,
      start: selection.start,
      end: selection.end,
    });
  }, []);

  const validateAnnotation = useCallback((selection, eventText) => {
    if (!selection || !eventText) {
      console.log("validateAnnotation: Missing selection or event text");
      return false;
    }
  
    const textContainerRef = document.createElement('div');
    textContainerRef.textContent = eventText;
  
    // Recreate the selection range
    const range = document.createRange();
    const tempTextNode = textContainerRef.firstChild;
    
    if (!tempTextNode) {
      console.log("validateAnnotation: Could not create text node");
      return false;
    }
  
    try {
      range.setStart(tempTextNode, selection.start);
      range.setEnd(tempTextNode, selection.end);
      
      // Get text content using the same method as TextAnnotationPanel
      let startPos = 0;
      let textNode = range.startContainer;
      
      while (textNode && textNode !== textContainerRef) {
        if (textNode.previousSibling) {
          textNode = textNode.previousSibling;
          startPos += textNode.textContent.length;
        } else {
          textNode = textNode.parentNode;
        }
      }
      
      startPos += range.startOffset;
      const endPos = startPos + range.toString().length;
  
      // Get the text at calculated positions
      const textAtPosition = eventText.substring(startPos, endPos);
      const trimmedSelectedText = selection.text.trim();
      
      console.log("validateAnnotation: Position comparison", {
        calculatedStart: startPos,
        calculatedEnd: endPos,
        originalStart: selection.start,
        originalEnd: selection.end,
        textAtPosition,
        selectedText: trimmedSelectedText,
        matches: textAtPosition === trimmedSelectedText
      });
  
      // Compare the texts
      return textAtPosition === trimmedSelectedText;
    } catch (error) {
      console.error("validateAnnotation: Range error", error);
      return false;
    }
  }, []);
  
  
  const handleAnnotationSelect = useCallback(async (type, selection) => {
    if (!selection || !currentPosition) return;
  
    try {
      const indices = {
        paperIndex: Number(currentPosition.paperIndex),
        eventIndex: Number(currentPosition.eventIndex),
      };
  
      if (type === 'Main Action' && currentEvent['Main Action']) {
        showSnackbar("Main Action already exists", "error");
        return;
      }
  
      if (!validateAnnotation(selection, currentEvent?.Text)) {
        showSnackbar("Invalid selection", "error");
        return;
      }

      const annotationData = {
        text: selection.text.trim(),
        span: {
          start: selection.start,
          end: selection.end
        }
      };

      // Save to DB first
      const response = await syncAnnotation({
        fieldPath: type,
        answer: annotationData,
        paperIndex: indices.paperIndex,
        eventIndex: indices.eventIndex
      });

      if (!response.success) {
        throw new Error('Failed to save to database');
      }

      // Update local state only after successful DB save
      setLocalFileData(prev => {
        if (!prev?.papers) return prev;
        const newData = JSON.parse(JSON.stringify(prev));
        const currentEvent = newData.papers[indices.paperIndex].events[indices.eventIndex];
        
        if (!currentEvent.Arguments) currentEvent.Arguments = {};
        if (!currentEvent.ArgumentPositions) currentEvent.ArgumentPositions = {};

        if (type === 'Main Action') {
          currentEvent['Main Action'] = annotationData.text;
          currentEvent.ArgumentPositions['Main Action'] = [annotationData.span];
        } else if (type.startsWith('Arguments.Object.')) {
          const [, , objectType] = type.split('.');
          if (!currentEvent.Arguments.Object) currentEvent.Arguments.Object = {};
          if (!currentEvent.Arguments.Object[objectType]) currentEvent.Arguments.Object[objectType] = [];
          
          currentEvent.Arguments.Object[objectType].push(annotationData.text);
          currentEvent.ArgumentPositions[`Arguments.Object.${objectType}`] = 
            currentEvent.ArgumentPositions[`Arguments.Object.${objectType}`] || [];
          currentEvent.ArgumentPositions[`Arguments.Object.${objectType}`].push(annotationData.span);
          
        } else if (type.startsWith('Arguments.')) {
          const argumentType = type.replace('Arguments.', '');
          if (!currentEvent.Arguments[argumentType]) currentEvent.Arguments[argumentType] = [];
          
          currentEvent.Arguments[argumentType].push(annotationData.text);
          currentEvent.ArgumentPositions[type] = currentEvent.ArgumentPositions[type] || [];
          currentEvent.ArgumentPositions[type].push(annotationData.span);
        }

        return newData;
      });

      setSelectedText(null);
      setLastSaved(new Date());
      showSnackbar("Annotation saved", "success");

    } catch (error) {
      console.error("Failed to save:", error);
      showSnackbar("Save failed", "error");
      // No need to revert state since we update after DB save
    }
}, [currentPosition, currentEvent, syncAnnotation, showSnackbar, validateAnnotation]);

const handleAnnotationDelete = useCallback(async (type, index) => {
  if (!currentPosition) return;

  try {
    // Find exact annotation
    const targetIndex = parseInt(index);
    const targetAnnotation = displayAnnotations.find(ann => 
      ann.type === type && parseInt(ann.id.split('-')[1]) === targetIndex
    );

    if (!targetAnnotation) {
      showSnackbar('Annotation not found', 'error');
      return;
    }

    // Delete from backend first
    await syncAnnotation({
      fieldPath: type,
      answer: null,
      isDelete: true,
      arrayIndex: targetIndex,
      paperIndex: currentPosition.paperIndex,
      eventIndex: currentPosition.eventIndex
    });

    // Update local state
    setLocalFileData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];

      if (type === 'Main Action') {
        currentEvent['Main Action'] = null;
        currentEvent.ArgumentPositions['Main Action'] = [];
      } else if (type.startsWith('Arguments.Object.')) {
        const [, , objectType] = type.split('.');
        currentEvent.Arguments.Object[objectType].splice(targetIndex, 1);
        currentEvent.ArgumentPositions[`Arguments.Object.${objectType}`].splice(targetIndex, 1);
      } else if (type.startsWith('Arguments.')) {
        const argumentType = type.replace('Arguments.', '');
        currentEvent.Arguments[argumentType].splice(targetIndex, 1);
        currentEvent.ArgumentPositions[type].splice(targetIndex, 1);
      }

      return newData;
    });

    setSelectedText(null);
    showSnackbar('Annotation deleted successfully', 'success');

  } catch (error) {
    console.error('Error deleting annotation:', error);
    showSnackbar('Failed to delete annotation', 'error');
    setLocalFileData(fileData);
  }
}, [currentPosition, displayAnnotations, syncAnnotation, showSnackbar, fileData]);

  const handleSummaryChange = useCallback(async (newValue) => {
    if (!eventType || !currentPosition || mode === 'view') return;
    
    try {
      const trimmedValue = newValue?.trim();
      if (!trimmedValue) return;
  
      await handleAnnotationSave(eventType, trimmedValue, {
        paperIndex: Number(currentPosition.paperIndex),
        eventIndex: Number(currentPosition.eventIndex)
      });

      await syncAnnotation({
        type: eventType,
        value: trimmedValue,
        paperIndex: currentPosition.paperIndex,
        eventIndex: currentPosition.eventIndex
      });

      setLastSaved(new Date());
      showSnackbar('Summary saved successfully', 'success');
    } catch (error) {
      console.error('Error saving summary:', error);
      showSnackbar('Failed to save summary', 'error');
    }
  }, [eventType, currentPosition, mode, handleAnnotationSave, syncAnnotation, showSnackbar]);

  const handleCompletion = useCallback(async () => {
    if (!mountedRef.current || isCompleting) return;
    
    try {
      setIsCompleting(true);
      showSnackbar('Finalizing annotations...', 'info');
      
      const success = await finalizeSync();
      
      if (!success || !mountedRef.current) return;
      
      showSnackbar('Annotations completed!', 'success');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (mountedRef.current) {
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Completion error:', error);
      if (mountedRef.current) {
        setIsCompleting(false);
        showSnackbar('Error completing annotations. Please try again.', 'error');
      }
    }
  }, [finalizeSync, navigate, showSnackbar, isCompleting]);

  // Effects
  useEffect(() => {
    setSummaryInput(currentEvent?.[eventType] || '');
  }, [currentEvent, eventType]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isLoaded, isSignedIn, navigate]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedText) setSelectedText(null);
        if (showTutorial) setShowTutorial(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedText, showTutorial]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Early returns
  if (!isLoaded || !user) return <LoadingView />;
  if (!isSignedIn) return null;
  if (loading) return <LoadingView />;
  if (error) return <ErrorView error={error} onBack={handleBack} />;
  if (!currentEvent || !currentPaper) {
    return <ErrorView error="No data available for annotation." onBack={handleBack} />;
  }

  const isViewMode = mode === 'view';

  return (
    <div className="min-h-screen bg-gray-50">
      <TutorialDialog isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      
      <Header
        currentPaper={currentPaper}
        currentPosition={currentPosition}
        fileData={fileData}
        syncStatus={syncStatus.status}
        lastSaved={lastSaved}
        onBack={handleBack}
        onOpenGuide={openAnnotationGuide}
        onShowTutorial={() => setShowTutorial(true)}
        progress={progress}
      />

      <main className="pt-24 pb-20 px-4">
        <div className="max-w-[95%] mx-auto space-y-6">
          {/* Abstract section */}
          {currentPaper?.abstract && (
            <div className="w-full bg-white rounded-xl shadow-lg">
              <button
                onClick={() => setIsAbstractOpen(!isAbstractOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 
                          transition-colors rounded-t-xl"
                aria-expanded={isAbstractOpen}
              >
                <h2 className="text-xl font-semibold text-gray-900">Abstract</h2>
                {isAbstractOpen ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              
              <div className={`transition-all duration-300 ${
                isAbstractOpen ? 'max-h-96 overflow-y-auto' : 'max-h-0 overflow-hidden'
              }`}>
                <div className="p-6 border-t border-gray-100">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {currentPaper.abstract}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left column: Text and Annotations */}
            <div className="col-span-1">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Event Type: <span className="text-blue-600">{eventType}</span>
                  </h2>
                </div>
                
                <TextAnnotationPanel
                  text={cleanedEvent?.Text}
                  annotations={displayAnnotations}
                  onTextSelect={isViewMode ? null : handleTextSelect}
                  selectedText={selectedText}
                  onAnnotationSelect={isViewMode ? null : handleAnnotationSelect}
                  onAnnotationDelete={isViewMode ? null : handleAnnotationDelete}
                  eventType={eventType}
                  readOnly={isViewMode}
                />
              </div>
            </div>

            {/* Right column: Summary and JSON Viewer */}
            <div className="col-span-1 space-y-4">
              {/* Summarization Input */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <SummaryInput 
                  value={summaryInput}
                  onChange={handleSummaryChange}
                  eventType={eventType}
                  disabled={isViewMode}
                  maxLength={100}
                  placeholder="Add a brief summary..."
                />
              </div>

              {/* JSON Viewer */}
              <div className="flex-1">
                <JsonViewer 
                  data={cleanedEvent}
                  onRemoveAnnotation={isViewMode ? null : handleAnnotationDelete}
                  readOnly={isViewMode}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer navigation */}
      {!isViewMode && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg py-4">
          <div className="max-w-7xl mx-auto flex justify-center gap-4">
            <button
              onClick={movePrevious}
              disabled={isFirstField || isCompleting}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 
                       disabled:opacity-50 flex items-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>
            
            <button
              onClick={isLastField ? handleCompletion : moveNext}
              disabled={isCompleting || !isOnline}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       disabled:opacity-50 flex items-center gap-2"
            >
              {isCompleting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white" />
              ) : (
                <>
                  {isLastField ? 'Complete' : 'Next'}
                  {!isLastField && <ChevronRight className="w-5 h-5" />}
                </>
              )}
            </button>
          </div>
        </footer>
      )}

      {/* Toast notifications */}
      {SnackbarComponent}
    </div>
  );
};

export default memo(UserAnnotationDashboard);