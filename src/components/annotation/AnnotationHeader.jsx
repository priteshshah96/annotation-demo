import React, { memo, useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Info, Save } from 'lucide-react';

const SYNC_STATUS_STYLES = {
  initializing: 'text-gray-600',
  saving: 'text-yellow-600',
  saved: 'text-green-600',
  error: 'text-red-600',
  offline: 'text-gray-400'
};

const SYNC_STATUS_MESSAGES = {
  initializing: 'Initializing...',
  saving: 'Saving changes...',
  saved: 'All changes saved',
  error: 'Error saving changes',
  offline: 'Working offline'
};

const HelpButton = memo(({ icon: Icon, label, onClick }) => (
  <div className="relative">
    <button
      onClick={onClick}
      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
      aria-label={label}
    >
      <Icon className="w-5 h-5 text-blue-600" />
    </button>
    <div className="absolute left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none
                  opacity-0 group-hover:opacity-100 transition-opacity duration-200
                  px-2 py-1 bg-gray-900 text-white text-sm rounded whitespace-nowrap z-50
                  mb-2 top-0">
      {label}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 
                    border-4 border-transparent border-t-gray-900"/>
    </div>
  </div>
));

const SyncStatus = memo(({ status: initialStatus, lastSaved }) => {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    // If we're initializing, transition to saved after a delay
    if (initialStatus === 'initializing') {
      const timer = setTimeout(() => {
        setStatus('saved');
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      // For all other status changes, update immediately
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  const message = lastSaved && status === 'saved'
    ? `Last saved at ${new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric'
      }).format(lastSaved)}`
    : SYNC_STATUS_MESSAGES[status];

  return (
    <div className="flex items-center gap-2">
      <Save className={`w-4 h-4 ${SYNC_STATUS_STYLES[status]}`} />
      <span className={`text-sm ${SYNC_STATUS_STYLES[status]}`}>{message}</span>
    </div>
  );
});

const AnnotationHeader = ({
  currentPaper,
  currentPosition,
  fileData,
  onBack,
  onOpenGuide,
  onShowTutorial,
  syncStatus,
  lastSaved,
  progress
}) => {
  // Calculate the total events for this paper
  const currentPaperTotalEvents = currentPaper?.events?.length || 0;
  
  // Calculate progress
  const calculatedProgress = fileData?.papers?.length 
    ? Math.max(
        0,
        ((currentPosition.paperIndex * currentPaperTotalEvents + currentPosition.eventIndex + 1) /
          (fileData.papers.length * currentPaperTotalEvents)) *
          100
      )
    : 0;

  // Use provided progress if available, otherwise use calculated progress
  const displayProgress = typeof progress === 'number' ? progress : calculatedProgress;

  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-20">
      <div className="max-w-[95%] mx-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-gray-600 hover:text-gray-900">
              ← Back to Dashboard
            </button>
            <h1 className="text-xl font-bold text-gray-900">{currentPaper?.paper_code}</h1>
            <SyncStatus status={syncStatus} lastSaved={lastSaved} />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 mr-4">
              <div className="group">
                <HelpButton icon={Info} label="View Annotation Guide" onClick={onOpenGuide} />
              </div>
              <div className="group">
                <HelpButton icon={HelpCircle} label="View Tutorial" onClick={onShowTutorial} />
              </div>
            </div>

            <span className="text-sm font-medium text-gray-600">
              Paper {currentPosition.paperIndex + 1} of {fileData?.papers?.length}
            </span>
            <span className="text-lg font-bold text-blue-600">
              Event {currentPosition.eventIndex + 1} of {currentPaperTotalEvents}
            </span>
          </div>
        </div>

        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${displayProgress}%` }}
            aria-valuenow={displayProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    </header>
  );
};

export default memo(AnnotationHeader);