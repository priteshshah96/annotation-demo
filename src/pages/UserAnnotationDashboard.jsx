import React, { useEffect, useCallback, memo, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { ChevronDown, ChevronUp, HelpCircle, Info, Save } from 'lucide-react';
import TutorialDialog from '../components/annotation/TutorialDialog';
import useAnnotation from '../hooks/useAnnotation';
import { AnnotationTypes } from '../models/Annotation';
import { useAnnotationSync } from '../hooks/useAnnotationSync';
import { useSnackbar } from '../hooks/useSnackbar';
import JsonViewer from '../components/annotation/JsonViewer';
import TextAnnotationPanel from '../components/annotation/TextAnnotationPanel';
import SummaryInput from '../components/annotation/SummaryInput';

// Memoized components
const LoadingView = memo(() => (
  <div className="flex justify-center items-center h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
  </div>
));

const ErrorView = memo(({ error, onBack }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-red-600 text-lg font-semibold mb-4">{error}</h2>
      <button
        onClick={onBack}
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Return to Dashboard
      </button>
    </div>
  </div>
));

const UserAnnotationDashboard = ({ mode }) => {
  // Refs and routing
  const mountedRef = useRef(true);
  const navigate = useNavigate();
  const { fileId } = useParams();
  
  // Auth and user state
  const { user } = useUser();
  const { isLoaded, isSignedIn } = useAuth();
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Component state
  const [state, setState] = useState({
    selectedText: null,
    isAbstractOpen: false,
    isCompleting: false,
    summaryInput: '',
    showTutorial: false,
    lastSaved: null,
    annotations: [],
    displayData: null
  });

  // Destructure state for convenience
  const {
    selectedText,
    isAbstractOpen,
    isCompleting,
    summaryInput,
    showTutorial,
    lastSaved,
    annotations,
    displayData
  } = state;

  // Custom hooks
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
  } = useAnnotation(fileId, navigate, user?.id);

  const { syncAnnotation, finalizeSync } = useAnnotationSync(fileId, user?.id);

  // Process and update event data
  const processAndUpdateState = useCallback((event) => {
    if (!event) return;
    
    // Find active event type
    const activeType = AnnotationTypes.EVENT_TYPE.find(
      (type) => event[type] && event[type].trim() !== ''
    ) || AnnotationTypes.EVENT_TYPE.find(
      (type) => type in event && event[type] !== undefined
    );

    if (!activeType) return;

    // Process event data
    const cleaned = {
      Text: event.Text || '',
      [activeType]: event[activeType] || '',
      'Main Action': event['Main Action'] || '',
      Arguments: {
        Agent: event.Arguments?.Agent || [],
        Object: {
          'Base Object': event.Arguments?.Object?.['Base Object'] || [],
          'Base Modifier': event.Arguments?.Object?.['Base Modifier'] || [],
          'Attached Object': event.Arguments?.Object?.['Attached Object'] || [],
          'Attached Modifier': event.Arguments?.Object?.['Attached Modifier'] || [],
        },
        Context: event.Arguments?.Context || [],
        Purpose: event.Arguments?.Purpose || [],
        Method: event.Arguments?.Method || [],
        Results: event.Arguments?.Results || [],
        Analysis: event.Arguments?.Analysis || [],
        Challenge: event.Arguments?.Challenge || [],
        Ethical: event.Arguments?.Ethical || [],
        Implications: event.Arguments?.Implications || [],
        Contradictions: event.Arguments?.Contradictions || [],
      },
    };

    // Process annotations
    const newAnnotations = [];

    // Handle Main Action
    if (event['Main Action']) {
      newAnnotations.push({
        text: event['Main Action'],
        type: 'Main Action',
        start: 0,
        end: event['Main Action'].length,
      });
    }

    // Handle Arguments
    if (event.Arguments) {
      // Process Object arguments
      Object.entries(event.Arguments.Object || {}).forEach(([objKey, spans]) => {
        if (Array.isArray(spans)) {
          spans.forEach((span, index) => {
            newAnnotations.push({
              ...span,
              type: `Arguments.Object.${objKey}`,
              index,
            });
          });
        }
      });

      // Process other arguments
      Object.entries(event.Arguments).forEach(([key, value]) => {
        if (key !== 'Object' && Array.isArray(value)) {
          value.forEach((span, index) => {
            newAnnotations.push({
              ...span,
              type: `Arguments.${key}`,
              index,
            });
          });
        }
      });
    }

    setState(prev => ({
      ...prev,
      displayData: cleaned,
      annotations: newAnnotations.sort((a, b) => a.start - b.start)
    }));
  }, []);

  // Callbacks
  const handleStateUpdate = useCallback((updates) => {
    if (mountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const handleTextSelect = useCallback((selection) => {
    handleStateUpdate({ selectedText: selection ? {
      text: selection.text,
      start: selection.start,
      end: selection.end,
    } : null });
  }, [handleStateUpdate]);

  const handleAnnotationSaveWrapper = useCallback(async (type, payload, options) => {
    try {
      const currentEvent = getCurrentEvent();
      if (!currentEvent) return;

      // Prepare optimistic updates
      const updatedDisplayData = JSON.parse(JSON.stringify(displayData));
      let newAnnotations = [...annotations];

      if (type === 'Main Action') {
        newAnnotations = newAnnotations.filter(a => a.type !== 'Main Action');
        if (payload) {
          newAnnotations.push({
            text: payload,
            type: 'Main Action',
            start: 0,
            end: payload.length,
          });
        }
        updatedDisplayData['Main Action'] = payload || '';
      } else if (type.startsWith('Arguments.')) {
        const annotationType = type;
        newAnnotations = newAnnotations.filter(a => a.type !== annotationType);
        
        if (Array.isArray(payload)) {
          payload.forEach((item, index) => {
            newAnnotations.push({
              ...item,
              type: annotationType,
              index,
            });
          });
          
          const path = type.split('.');
          let target = updatedDisplayData;
          for (let i = 0; i < path.length - 1; i++) {
            if (!target[path[i]]) {
              target[path[i]] = {};
            }
            target = target[path[i]];
          }
          target[path[path.length - 1]] = payload.map(p => p.text);
        }
      }

      // Apply optimistic updates
      handleStateUpdate({
        annotations: newAnnotations.sort((a, b) => a.start - b.start),
        displayData: updatedDisplayData
      });

      // Sync with backend
      await syncAnnotation({
        paperIndex: options.paperIndex,
        eventIndex: options.eventIndex,
        fieldPath: type,
        value: payload,
        isDelete: options.isDelete,
        span: !Array.isArray(payload) && payload?.text ? {
          text: payload.text,
          start: payload.start,
          end: payload.end
        } : undefined,
        spans: Array.isArray(payload) ? payload : undefined
      });

      handleStateUpdate({
        lastSaved: new Date()
      });
      showSnackbar('Annotation saved successfully', 'success');
    } catch (error) {
      console.error('Error saving annotation:', error);
      showSnackbar('Failed to save annotation', 'error');
      
      // Revert optimistic update on error
      const currentEvent = getCurrentEvent();
      if (currentEvent) {
        processAndUpdateState(currentEvent);
      }
    }
  }, [displayData, annotations, getCurrentEvent, syncAnnotation, handleStateUpdate, showSnackbar, processAndUpdateState]);

  const handleAnnotationSelect = useCallback(async (type, answer) => {
    if (!selectedText || !currentPosition) return;

    try {
      const indices = {
        paperIndex: Number(currentPosition.paperIndex),
        eventIndex: Number(currentPosition.eventIndex),
      };

      const payload = type === 'Main Action' 
        ? answer?.text || answer 
        : (type.startsWith('Arguments.') || type.startsWith('Object.'))
          ? Array.isArray(answer) ? answer : [answer]
          : answer;

      await handleAnnotationSaveWrapper(type, payload, indices);
      handleStateUpdate({ selectedText: null });
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('Error in handleAnnotationSelect:', error);
      showSnackbar('Failed to save annotation', 'error');
    }
  }, [selectedText, currentPosition, handleAnnotationSaveWrapper, handleStateUpdate, showSnackbar]);

  const handleAnnotationDelete = useCallback(async (type, index) => {
    if (!currentPosition) return;

    try {
      // Optimistic update
      const updatedDisplayData = JSON.parse(JSON.stringify(displayData));
      let newAnnotations = annotations.filter((a, i) => 
        !(a.type === type && (index === undefined || i === index))
      );

      if (type === 'Main Action') {
        updatedDisplayData['Main Action'] = '';
      } else if (type.startsWith('Arguments.')) {
        const path = type.split('.');
        let target = updatedDisplayData;
        for (let i = 0; i < path.length - 1; i++) {
          if (!target[path[i]]) {
            target[path[i]] = {};
          }
          target = target[path[i]];
        }
        if (index !== undefined) {
          target[path[path.length - 1]] = target[path[path.length - 1]]
            .filter((_, i) => i !== index);
        } else {
          target[path[path.length - 1]] = [];
        }
      }

      handleStateUpdate({
        annotations: newAnnotations,
        displayData: updatedDisplayData
      });

      await syncAnnotation({
        paperIndex: Number(currentPosition.paperIndex),
        eventIndex: Number(currentPosition.eventIndex),
        fieldPath: type,
        isDelete: true,
        index
      });

      handleStateUpdate({ lastSaved: new Date() });
      showSnackbar('Annotation deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting annotation:', error);
      showSnackbar('Failed to delete annotation', 'error');
      
      const currentEvent = getCurrentEvent();
      if (currentEvent) {
        processAndUpdateState(currentEvent);
      }
    }
  }, [currentPosition, annotations, displayData, syncAnnotation, getCurrentEvent, handleStateUpdate, showSnackbar, processAndUpdateState]);

  const handleSummaryChange = useCallback(async (newValue) => {
    if (!displayData || !currentPosition || mode === 'view') return;

    try {
      const eventType = Object.keys(displayData).find(key => 
        key !== 'Text' && key !== 'Main Action' && key !== 'Arguments'
      );

      if (!eventType) return;

      const isDelete = !newValue || newValue.trim() === '';
      
      // Optimistic update
      handleStateUpdate({
        displayData: {
          ...displayData,
          [eventType]: isDelete ? '' : newValue
        },
        summaryInput: newValue
      });

      await syncAnnotation({
        paperIndex: Number(currentPosition.paperIndex),
        eventIndex: Number(currentPosition.eventIndex),
        fieldPath: eventType,
        value: isDelete ? '' : newValue,
        isDelete
      });

      handleStateUpdate({ lastSaved: new Date() });
      showSnackbar('Summary saved successfully', 'success');
    } catch (error) {
      console.error('Error saving summary:', error);
      showSnackbar('Failed to save summary', 'error');
      
      const currentEvent = getCurrentEvent();
      if (currentEvent) {
        processAndUpdateState(currentEvent);
      }
    }
  }, [displayData, currentPosition, mode, syncAnnotation, handleStateUpdate, showSnackbar, getCurrentEvent, processAndUpdateState]);

  const handleCompletion = useCallback(async () => {
    if (!mountedRef.current || isCompleting) return;

    try {
      handleStateUpdate({ isCompleting: true });
      showSnackbar('Finalizing annotations...', 'info');

      const success = await finalizeSync();

      if (!success || !mountedRef.current) return;

      showSnackbar('Annotations completed!', 'success');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (mountedRef.current) {
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Completion error:', error);
      if (mountedRef.current) {
        handleStateUpdate({ isCompleting: false });
        showSnackbar('Error completing annotations. Please try again.', 'error');
      }
    }
  }, [finalizeSync, navigate, showSnackbar, isCompleting, handleStateUpdate]);

  const handleBack = useCallback(() => {
    if (!isCompleting) {
      navigate('/', { replace: true });
    }
  }, [navigate, isCompleting]);

  // Effects
  const currentPaper = useMemo(() => getCurrentPaper(), [getCurrentPaper]);

  useEffect(() => {
    const currentEvent = getCurrentEvent();
    if (currentEvent) {
      processAndUpdateState(currentEvent);
    }
  }, [getCurrentEvent, processAndUpdateState]);

  useEffect(() => {
    if (displayData) {
      const eventType = Object.keys(displayData).find(key => 
        key !== 'Text' && key !== 'Main Action' && key !== 'Arguments'
      );
      handleStateUpdate({
        summaryInput: displayData[eventType] || ''
      });
    }
  }, [displayData, handleStateUpdate]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isLoaded, isSignedIn, navigate]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedText) {
          handleStateUpdate({ selectedText: null });
        }
        if (showTutorial) {
          handleStateUpdate({ showTutorial: false });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedText, showTutorial, handleStateUpdate]);

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
  if (!displayData || !currentPaper) {
    return <ErrorView error="No data available for annotation." onBack={handleBack} />;
  }

  // Derived state
  const isViewMode = mode === 'view';
  const eventType = Object.keys(displayData).find(key => 
    key !== 'Text' && key !== 'Main Action' && key !== 'Arguments'
  );
  const progress = ((currentPosition.paperIndex * currentPaper.events.length + currentPosition.eventIndex) /
    (fileData.papers.length * currentPaper.events.length)) * 100;

  // Render
  return (
    <div className="min-h-screen bg-gray-50">
      <TutorialDialog 
        isOpen={showTutorial} 
        onClose={() => handleStateUpdate({ showTutorial: false })} 
      />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-20">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex justify-between items-center mb-2">
            {/* Left section */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                {currentPaper.paper_code}
              </h1>
              {lastSaved && (
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <Save className="w-4 h-4" />
                  Last saved: {new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    minute: 'numeric',
                  }).format(lastSaved)}
                </span>
              )}
            </div>

            {/* Right section */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 mr-4">
                <button
                  onClick={() => window.open('/docs/annotation_guide.pdf', '_blank')}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="View annotation guide"
                >
                  <Info className="w-5 h-5 text-blue-600" />
                </button>
                <button
                  onClick={() => handleStateUpdate({ showTutorial: true })}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="View tutorial"
                >
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                </button>
              </div>
              <span className="text-sm font-medium text-gray-600">
                Paper {currentPosition.paperIndex + 1} of {fileData.papers.length}
              </span>
              <span className="text-lg font-bold text-blue-600">
                Event {currentPosition.eventIndex + 1} of {currentPaper.events.length}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-[95%] mx-auto space-y-6">
          {/* Abstract section */}
          {currentPaper?.abstract && (
            <div className="w-full bg-white rounded-xl shadow-lg">
              <button
                onClick={() => handleStateUpdate({ isAbstractOpen: !isAbstractOpen })}
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
              <div
                className={`transition-all duration-300 ${
                  isAbstractOpen ? 'max-h-96 overflow-y-auto' : 'max-h-0 overflow-hidden'
                }`}
              >
                <div className="p-6 border-t border-gray-100">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {currentPaper.abstract}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main grid layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left column - Text annotation */}
            <div className="col-span-1">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Event Type: <span className="text-blue-600">{eventType}</span>
                  </h2>
                </div>
                <TextAnnotationPanel
                  key={`${currentPosition.paperIndex}-${currentPosition.eventIndex}`}
                  text={displayData?.Text}
                  annotations={annotations}
                  onTextSelect={isViewMode ? null : handleTextSelect}
                  selectedText={selectedText}
                  onAnnotationSelect={isViewMode ? null : handleAnnotationSelect}
                  onAnnotationDelete={isViewMode ? null : handleAnnotationDelete}
                  eventType={eventType}
                  readOnly={isViewMode}
                />
              </div>
            </div>

            {/* Right column - Summary and JSON viewer */}
            <div className="col-span-1 space-y-4">
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
              <div className="flex-1">
                <JsonViewer
                  data={displayData}
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
              Previous
            </button>
            <button
              onClick={isLastField ? handleCompletion : moveNext}
              disabled={isCompleting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        disabled:opacity-50 flex items-center gap-2"
            >
              {isCompleting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white" />
              ) : isLastField ? (
                'Complete'
              ) : (
                'Next'
              )}
            </button>
          </div>
        </footer>
      )}

      {/* Snackbar notifications */}
      {SnackbarComponent}
    </div>
  );
};

export default memo(UserAnnotationDashboard);