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
  const mountedRef = useRef(true);
  const navigate = useNavigate();
  const { fileId } = useParams();
  const { user } = useUser();
  const { isLoaded, isSignedIn } = useAuth();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  
  // Component state
  const [selectedText, setSelectedText] = useState(null);
  const [isAbstractOpen, setIsAbstractOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [summaryInput, setSummaryInput] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

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
    isLastField
  } = useAnnotation(fileId, navigate, user?.id);

  const { finalizeSync } = useAnnotationSync(fileId, user?.id);

  // Get current event and paper
  const currentEvent = useMemo(() => getCurrentEvent(), [getCurrentEvent]);
  const currentPaper = useMemo(() => getCurrentPaper(), [getCurrentPaper]);
  
  // Fixed event type detection to match MongoDB structure
  const eventType = useMemo(() => {
    if (!currentEvent) return null;
    
    // First find if any event type already has content
    let activeType = AnnotationTypes.EVENT_TYPE.find(type => 
      currentEvent[type] && currentEvent[type].trim() !== ''
    );
  
    // If no event type has content yet, find which one exists in the event
    if (!activeType) {
      activeType = AnnotationTypes.EVENT_TYPE.find(type => 
        type in currentEvent && currentEvent[type] !== undefined
      );
    }
  
    return activeType;
  }, [currentEvent]);

  // Process event data
  const { cleanedEvent, displayAnnotations } = useMemo(() => {
    if (!currentEvent || !eventType) {
      return { cleanedEvent: null, displayAnnotations: [] };
    }
  
    // Initialize cleaned event with the correct structure
    const cleaned = {
      Text: currentEvent.Text || '',
      [eventType]: currentEvent[eventType] || '',
      'Main Action': currentEvent['Main Action'] || '',
      Arguments: {
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
    };
  
    // Fill in existing annotations
    if (currentEvent.Arguments) {
      // Handle Object arguments
      Object.entries(currentEvent.Arguments.Object || {}).forEach(([key, value]) => {
        if (value?.spans) {
          cleaned.Arguments.Object[key].spans = value.spans;
        }
      });
  
      // Handle other arguments
      Object.entries(currentEvent.Arguments).forEach(([key, value]) => {
        if (key !== 'Object' && value?.spans) {
          cleaned.Arguments[key].spans = value.spans;
        }
      });
    }
  
    // Build display annotations array
    const annotations = [];
  
    // Add Main Action annotation
    if (currentEvent['Main Action']) {
      annotations.push({
        text: currentEvent['Main Action'],
        type: 'Main Action',
        start: 0,
        end: currentEvent['Main Action'].length
      });
    }
  
    // Add Arguments annotations
    if (currentEvent.Arguments) {
      // Process Object arguments
      Object.entries(currentEvent.Arguments.Object || {}).forEach(([objKey, value]) => {
        if (value?.spans) {
          value.spans.forEach((span, index) => {
            if (span.text && typeof span.start === 'number' && typeof span.end === 'number') {
              annotations.push({
                ...span,
                type: `Arguments.Object.${objKey}`,
                index
              });
            }
          });
        }
      });
  
      // Process other arguments
      Object.entries(currentEvent.Arguments).forEach(([key, value]) => {
        if (key !== 'Object' && value?.spans) {
          value.spans.forEach((span, index) => {
            if (span.text && typeof span.start === 'number' && typeof span.end === 'number') {
              annotations.push({
                ...span,
                type: `Arguments.${key}`,
                index
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
  }, [currentEvent, eventType]);

  // Callbacks
  const openAnnotationGuide = useCallback(() => {
    window.open('/docs/annotation_guide.pdf', '_blank');
  }, []);

  const handleTextSelect = useCallback((selection) => {
    if (!selection) {
      setSelectedText(null);
      return;
    }
    setSelectedText({
      text: selection.text,
      start: selection.start,
      end: selection.end
    });
  }, []);

  const handleAnnotationSelect = useCallback(async (type, answer) => {
    if (!selectedText || !currentPosition) return;
  
    try {
      const indices = {
        paperIndex: Number(currentPosition.paperIndex),
        eventIndex: Number(currentPosition.eventIndex)
      };
  
      let payload;
      if (type === 'Main Action') {
        // For Main Action
        payload = selectedText.text;
      } else if (type.startsWith('Arguments.') || type.startsWith('Object.')) {
        // For Arguments - send answer as spans with proper structure
        payload = {
          spans: [{
            text: selectedText.text,
            start: selectedText.start,
            end: selectedText.end
          }]
        };
      } else {
        // For event types (Background/Introduction etc)
        payload = selectedText.text;
      }
  
      await handleAnnotationSave(type, payload, { indices });
      setSelectedText(null);
      setLastSaved(new Date());
      showSnackbar('Annotation saved successfully', 'success');
    } catch (error) {
      console.error('Error saving annotation:', error);
      showSnackbar('Failed to save annotation', 'error');
    }
  }, [selectedText, currentPosition, handleAnnotationSave, showSnackbar]);

  const handleAnnotationDelete = useCallback(async (type, index) => {
    if (!currentPosition) return;
  
    try {
      // For Arguments, send proper delete structure
      const isArgument = type.startsWith('Arguments.') || type.startsWith('Object.');
      const payload = isArgument ? { spans: [] } : '';
      
      await handleAnnotationSave(type, payload, {
        paperIndex: Number(currentPosition.paperIndex),
        eventIndex: Number(currentPosition.eventIndex),
        isDelete: true,
        index
      });
  
      setLastSaved(new Date());
      showSnackbar('Annotation deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting annotation:', error);
      showSnackbar('Failed to delete annotation', 'error');
    }
  }, [currentPosition, handleAnnotationSave, showSnackbar]);


  const handleBack = useCallback(() => {
    if (isCompleting) return;
    navigate('/', { replace: true });
  }, [navigate, isCompleting]);

  // In handleSummaryChange
  const handleSummaryChange = useCallback(async (newValue) => {
    if (!eventType || !currentPosition || mode === 'view') return;
    
    try {
      // Only save if there's actual content
      const trimmedValue = newValue?.trim();
      if (!trimmedValue) {
        return;
      }
  
      await handleAnnotationSave(eventType, trimmedValue, {
        paperIndex: Number(currentPosition.paperIndex),
        eventIndex: Number(currentPosition.eventIndex)
      });
      setLastSaved(new Date());
      showSnackbar('Summary saved successfully', 'success');
    } catch (error) {
      console.error('Error saving summary:', error);
      showSnackbar('Failed to save summary', 'error');
    }
  }, [eventType, currentPosition, mode, handleAnnotationSave, showSnackbar]);

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
        if (selectedText) {
          setSelectedText(null);
        }
        if (showTutorial) {
          setShowTutorial(false);
        }
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

  // Early returns for various states
  if (!isLoaded || !user) return <LoadingView />;
  if (!isSignedIn) return null;
  if (loading) return <LoadingView />;
  if (error) return <ErrorView error={error} onBack={handleBack} />; // Now handleBack is defined
  if (!currentEvent || !currentPaper) {
    return <ErrorView error="No data available for annotation." onBack={handleBack} />;
  }

  const isViewMode = mode === 'view';
  const progress = ((currentPosition.paperIndex * currentPaper.events.length + currentPosition.eventIndex) /
    (fileData.papers.length * currentPaper.events.length)) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <TutorialDialog isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-20">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex justify-between items-center mb-2">
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
            
            <div className="flex items-center gap-4">
              {/* Help Icons */}
              <div className="flex items-center gap-3 mr-4">
                <button
                  onClick={openAnnotationGuide}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="View annotation guide"
                >
                  <Info className="w-5 h-5 text-blue-600" />
                </button>
                <button
                  onClick={() => setShowTutorial(true)}
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
                                  onRemoveAnnotation={(field, index) => {
                                    if (!currentPosition) return;
                                    
                                    let payload = null;
                                    const isEventType = AnnotationTypes.EVENT_TYPE.includes(field);
                                    
                                    if (field === 'Main Action' || isEventType) {
                                      payload = '';  // Empty string for Main Action and Event Types
                                    } else if (field.startsWith('Arguments.') || field.startsWith('Object.')) {
                                      payload = [];  // Empty array for arguments
                                    }

                                    handleAnnotationSave(field, payload, {
                                      paperIndex: Number(currentPosition.paperIndex),
                                      eventIndex: Number(currentPosition.eventIndex),
                                      isDelete: true,
                                      index
                                    });
                                    setLastSaved(new Date());
                                  }}
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
                                ) : (
                                  isLastField ? 'Complete' : 'Next'
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