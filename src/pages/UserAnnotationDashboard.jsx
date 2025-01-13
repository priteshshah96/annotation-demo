import React, { useEffect, useCallback, memo, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import useAnnotation, { ANNOTATION_FIELDS } from '../hooks/useAnnotation';  // Add ANNOTATION_FIELDS import
import { useAnnotationSync } from '../hooks/useAnnotationSync';
import { useSnackbar } from '../hooks/useSnackbar';
import JsonViewer from '../components/annotation/JsonViewer';
import TextAnnotationPanel from '../components/annotation/TextAnnotationPanel';

const LoadingView = memo(() => (
  <div className="flex justify-center items-center h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
  </div>
));

// Error Component 
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

const AnnotationDashboard = ({ mode }) => {
  const mountedRef = useRef(true);
  const navigate = useNavigate();
  const { fileId } = useParams();
  const { user } = useUser();
  const { isLoaded, isSignedIn } = useAuth();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const [selectedText, setSelectedText] = useState(null);
  const [isAbstractOpen, setIsAbstractOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  const {
    currentPosition,
    fileData,
    progress,
    loading,
    error,
    moveNext,
    movePrevious,
    handleAnnotationSave,
    getCurrentEvent,
    getCurrentPaper,
    isFirstField,
    isLastField,
    ANNOTATION_FIELDS
  } = useAnnotation(fileId, navigate, user?.id);

  const { syncStatus, syncAnnotation, finalizeSync } = useAnnotationSync(fileId, user?.id);

  // Memoized values
  const currentEvent = useMemo(() => getCurrentEvent(), [getCurrentEvent]);
  const currentPaper = useMemo(() => getCurrentPaper(), [getCurrentPaper]);
  const eventType = useMemo(() => {
    if (!currentEvent) return null;
    return ANNOTATION_FIELDS.EVENT_TYPES.find(type => currentEvent[type] !== undefined);
  }, [currentEvent, ANNOTATION_FIELDS.EVENT_TYPES]);

  // Process event data for display
  const { cleanedEvent, displayAnnotations } = useMemo(() => {
    if (!currentEvent) return { cleanedEvent: null, displayAnnotations: [] };

    // Create cleaned event with only relevant fields
    const cleaned = {
      Text: currentEvent.Text,
      [eventType]: currentEvent[eventType] || '',
      'Main Action': currentEvent['Main Action'] || '',
      Arguments: currentEvent.Arguments || {}
    };

    // Process annotations for text highlighting
    const annotations = [];
    const text = currentEvent.Text || '';

    // Process Main Action
    if (currentEvent['Main Action']) {
      const start = text.indexOf(currentEvent['Main Action']);
      if (start !== -1) {
        annotations.push({
          start,
          end: start + currentEvent['Main Action'].length,
          text: currentEvent['Main Action'],
          type: 'Main_Action'
        });
      }
    }

    // Process Arguments
    if (currentEvent.Arguments) {
      Object.entries(currentEvent.Arguments).forEach(([key, value]) => {
        if (!value) return;

        if (key === 'Object') {
          Object.entries(value).forEach(([objKey, objValue]) => {
            if (!objValue) return;
            const start = text.indexOf(objValue);
            if (start !== -1) {
              annotations.push({
                start,
                end: start + objValue.length,
                text: objValue,
                type: `Object.${objKey.replace(' ', '_')}`
              });
            }
          });
        } else if (value) {
          const start = text.indexOf(value);
          if (start !== -1) {
            annotations.push({
              start,
              end: start + value.length,
              text: value,
              type: key
            });
          }
        }
      });
    }

    return {
      cleanedEvent: cleaned,
      displayAnnotations: annotations.sort((a, b) => a.start - b.start)
    };
  }, [currentEvent, eventType]);

  // Authentication check
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isLoaded, isSignedIn, navigate]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleBack = useCallback(() => {
    if (isCompleting) return;
    navigate('/', { replace: true });
  }, [navigate, isCompleting]);

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

  const handleTextSelect = useCallback((selection) => {
    setSelectedText(selection);
  }, []);

  const handleAnnotationSelect = useCallback((annotationType) => {
    if (!selectedText || !currentPosition) return;
    
    let field;
    let value = selectedText.text;

    if (annotationType.startsWith('Object.')) {
      field = `Arguments.Object.${annotationType.split('.')[1]}`;
    } else if (annotationType === 'Main_Action') {
      field = 'Main Action';
    } else {
      field = `Arguments.${annotationType}`;
    }

    handleAnnotationSave(field, value, {
      paperIndex: Number(currentPosition.paperIndex),
      eventIndex: Number(currentPosition.eventIndex)
    });
    
    setSelectedText(null);
  }, [selectedText, currentPosition, handleAnnotationSave]);

  const handleSummaryChange = useCallback((e) => {
    if (!eventType || !currentPosition) return;
    
    handleAnnotationSave(eventType, e.target.value, {
      paperIndex: Number(currentPosition.paperIndex),
      eventIndex: Number(currentPosition.eventIndex)
    });
  }, [eventType, currentPosition, handleAnnotationSave]);

  // Early returns
  if (!isLoaded || !user) return <LoadingView />;
  if (!isSignedIn) return null;
  if (loading) return <LoadingView />;
  if (error) return <ErrorView error={error} onBack={handleBack} />;
  if (!currentEvent || !currentPaper) {
    return <ErrorView error="No data available for annotation." onBack={handleBack} />;
  }

  // Disable editing if in view mode
  const isViewMode = mode === 'view';

  return (
    <div className="min-h-screen bg-gray-50">
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
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-600">
                Paper {currentPosition.paperIndex + 1} of {fileData.papers.length}
              </span>
              <span className="text-lg font-bold text-blue-600">
                Event {currentPosition.eventIndex + 1} of {currentPaper.events.length}
              </span>
            </div>
          </div>

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
          {/* Abstract Section */}
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

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Text Annotation */}
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
                  readOnly={isViewMode}
                />
              </div>
            </div>

            {/* Right Column: Summary + JSON */}
            <div className="col-span-1 space-y-4">
              {/* Summarization Input */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold mb-2">Summarization</h3>
                <textarea
                  className="w-full p-2 border border-gray-300 rounded-lg h-12 
                           resize-none text-sm"
                  placeholder="Add a brief summary (max 10 words)..."
                  value={cleanedEvent?.[eventType] || ''}
                  onChange={handleSummaryChange}
                  maxLength={100}
                  disabled={isViewMode}
                />
              </div>

              {/* JSON Viewer */}
              <div className="flex-1">
                <JsonViewer 
                  data={cleanedEvent}
                  onRemoveAnnotation={isViewMode ? null : handleAnnotationSave}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Navigation Footer */}
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

      {SnackbarComponent}
    </div>
  );
};

export default memo(AnnotationDashboard);