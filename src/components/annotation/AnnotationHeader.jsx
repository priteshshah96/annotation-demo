import React, { memo } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Info, Save } from 'lucide-react';
import { SYNC_STATUS_STYLES, SYNC_STATUS_MESSAGES } from '../../constants/annotation';

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

const SyncStatus = memo(({ status, lastSaved }) => {
  const message = lastSaved && status === 'SAVED' 
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
          <button onClick={onBack} className="text-gray-600 hover:text-gray-900">
            ← Back to Dashboard
          </button>
          <h1 className="text-xl font-bold text-gray-900">{currentPaper?.paper_code}</h1>
          <SyncStatus status={syncStatus} lastSaved={lastSaved} />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 mr-4">
            <HelpButton icon={Info} label="View Annotation Guide" onClick={onOpenGuide} />
            <HelpButton icon={HelpCircle} label="View Tutorial" onClick={onShowTutorial} />
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
          style={{ width: `${Math.max(0, ((currentPosition.paperIndex * currentPaper?.events?.length + currentPosition.eventIndex + 1) / (fileData?.papers?.length * currentPaper?.events?.length)) * 100)}%` }}          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  </header>
);

export default memo(AnnotationHeader);