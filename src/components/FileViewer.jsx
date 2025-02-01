import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useAnnotation } from '../hooks/useAnnotation';
import { useAnnotationSync } from '../hooks/useAnnotationSync';
import AnnotationHeader from '../components/annotation/AnnotationHeader';
import AnnotationMain from '../components/annotation/AnnotationMain';
import AnnotationFooter from '../components/annotation/AnnotationFooter';
import AbstractSection from '../components/annotation/AbstractSection';
import LoadingView from '../components/common/LoadingView';
import ErrorView from '../components/common/ErrorView';

const FileViewer = () => {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { isLoaded, isSignedIn } = useAuth();
  const [isAbstractOpen, setIsAbstractOpen] = useState(false);
  const [localFileData, setLocalFileData] = useState(null);

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

  const { 
    syncStatus, 
    isOnline 
  } = useAnnotationSync(fileId, user?.id, loadFileData);

  // Effect to update localFileData when fileData changes
  useEffect(() => {
    if (fileData) {
      setLocalFileData(fileData);
    }
  }, [fileData]);

  // Auth check effect
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isLoaded, isSignedIn, navigate]);

  // Early returns
  if (!isLoaded || !user) {
    return <LoadingView />;
  }

  if (!isSignedIn) {
    return null;
  }

  if (loading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView error={error} onBack={() => navigate('/')} />;
  }

  const currentPaper = getCurrentPaper();
  const currentEvent = getCurrentEvent();

  if (!currentEvent || !currentPaper) {
    return <ErrorView error="No data found" onBack={() => navigate('/')} />;
  }

  // Process annotations for display
  const displayAnnotations = currentEvent?.ArgumentPositions 
    ? Object.entries(currentEvent.ArgumentPositions).flatMap(([type, positions]) => 
        positions.map((position, idx) => ({
          text: type === 'Main Action' ? currentEvent['Main Action'] :
               type.startsWith('Arguments.Object.') ? currentEvent.Arguments.Object[type.split('.').pop()][idx] :
               currentEvent.Arguments[type.replace('Arguments.', '')][idx],
          type: type.replace('Arguments.', ''),
          start: position.start,
          end: position.end,
          id: `${type.toLowerCase()}-${idx}`,
          annotationId: position.annotationId
        }))
      ).sort((a, b) => a.start - b.start)
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <AnnotationHeader
        currentPaper={currentPaper}
        currentPosition={currentPosition}
        fileData={fileData}
        syncStatus={syncStatus.status}
        onBack={() => navigate('/')}
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
            cleanedEvent={currentEvent}
            displayAnnotations={displayAnnotations}
            selectedText={null}
            onTextSelect={() => {}}
            onAnnotationSelect={() => {}}
            onAnnotationDelete={() => {}}
            summaryInput={currentEvent[eventType] || ''}
            onSummaryChange={() => {}}
            onSummaryDelete={() => {}}
            fileData={fileData}
            isViewMode={true}
          />
        </div>
      </main>

      <AnnotationFooter
        onPrevious={movePrevious}
        onNext={moveNext}
        isFirstField={isFirstField}
        isLastField={isLastField}
        isCompleting={false}
        isOnline={isOnline}
      />
    </div>
  );
};

export default FileViewer;