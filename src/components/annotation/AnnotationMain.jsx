// AnnotationMain.jsx
import React, { memo, useState, useEffect } from 'react';
import TextAnnotationPanel from './TextAnnotationPanel';
import JsonViewer from './JsonViewer';
import SummaryInput from './SummaryInput';

const AnnotationMain = ({
  eventType,
  cleanedEvent,
  displayAnnotations,
  selectedText,
  onTextSelect,
  onAnnotationSelect,
  onAnnotationDelete,
  summaryInput,
  onSummaryChange,
  onSummaryDelete, 
  fileData,
  localFileData,
  isViewMode,
  onHasUnsavedChanges,
  showToast // Add this prop
}) => {
  const [summaryStatus, setSummaryStatus] = useState('idle');
  const shouldDisableDownload = summaryStatus === 'saving' || summaryStatus === 'unsaved';

  // Notify parent component about unsaved changes
  useEffect(() => {
    const hasUnsaved = summaryStatus === 'unsaved' || summaryStatus === 'saving';
    onHasUnsavedChanges?.(hasUnsaved);
  }, [summaryStatus, onHasUnsavedChanges]);

  const handleAnnotationDelete = async (type, annotationId) => {
    if (isViewMode) return;
    
    try {
      await onAnnotationDelete(type, annotationId);
    } catch (error) {
      console.error('Error in annotation deletion:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
            onTextSelect={isViewMode ? null : onTextSelect}
            selectedText={selectedText}
            onAnnotationSelect={isViewMode ? null : onAnnotationSelect}
            onAnnotationDelete={handleAnnotationDelete}
            eventType={eventType}
            readOnly={isViewMode}
            showToast={showToast} // Pass through to TextAnnotationPanel
          />
        </div>
      </div>

      <div className="col-span-1 space-y-4">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <SummaryInput 
            value={summaryInput}
            onChange={onSummaryChange}
            onDelete={isViewMode ? null : onSummaryDelete}
            eventType={eventType}
            disabled={isViewMode}
            maxLength={100}
            onStatusChange={setSummaryStatus}
            placeholder="Please summarize the event text in a single sentence..."
          />
        </div>

        <div className="flex-1">
          <JsonViewer 
            data={cleanedEvent}
            fullFileData={localFileData}
            onRemoveAnnotation={handleAnnotationDelete}
            onSummaryDelete={isViewMode ? null : onSummaryDelete} 
            readOnly={isViewMode}
            disableDownload={shouldDisableDownload}
            summaryStatus={summaryStatus}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(AnnotationMain);