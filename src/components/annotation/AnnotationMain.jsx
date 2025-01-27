import React, { memo } from 'react';
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
  isViewMode
}) => (
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
          onTextSelect={isViewMode ? null : onTextSelect}
          selectedText={selectedText}
          onAnnotationSelect={isViewMode ? null : onAnnotationSelect}
          onAnnotationDelete={isViewMode ? null : onAnnotationDelete}
          eventType={eventType}
          readOnly={isViewMode}
        />
      </div>
    </div>

    {/* Right column: Summary and JSON Viewer */}
    <div className="col-span-1 space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <SummaryInput 
          value={summaryInput}
          onChange={onSummaryChange}
          onDelete={isViewMode ? null : onSummaryDelete}
          eventType={eventType}
          disabled={isViewMode}
          maxLength={100}
          placeholder="Add a brief summary..."
        />
      </div>

      <div className="flex-1">
        <JsonViewer 
          data={cleanedEvent}
          fullFileData={fileData}
          onRemoveAnnotation={isViewMode ? null : onAnnotationDelete}
          readOnly={isViewMode}
        />
      </div>
    </div>
  </div>
);

export default memo(AnnotationMain);