import React, { useRef, useState } from 'react';

// Annotation types with colors
const ANNOTATION_TYPES = {
  'Main_Action': { label: 'Main Action', color: 'bg-blue-100' },
  'Agent': { label: 'Agent', color: 'bg-green-100' },
  'Context': { label: 'Context', color: 'bg-orange-100' },
  'Purpose': { label: 'Purpose', color: 'bg-pink-100' },
  'Method': { label: 'Method', color: 'bg-purple-100' },
  'Results': { label: 'Results', color: 'bg-indigo-100' },
  'Analysis': { label: 'Analysis', color: 'bg-cyan-100' },
  'Challenge': { label: 'Challenge', color: 'bg-teal-100' },
  'Ethical': { label: 'Ethical', color: 'bg-amber-100' },
  'Implications': { label: 'Implications', color: 'bg-red-100' },
  'Contradictions': { label: 'Contradictions', color: 'bg-rose-100' }
};

const OBJECT_TYPES = {
  'Base_Object': { label: 'Base Object', color: 'bg-violet-100' },
  'Base_Modifier': { label: 'Base Modifier', color: 'bg-violet-100' },
  'Attached_Object': { label: 'Attached Object', color: 'bg-violet-100' },
  'Attached_Modifier': { label: 'Attached Modifier', color: 'bg-violet-100' }
};

const TextAnnotationPanel = ({
  text,
  annotations = [],
  onTextSelect,
  onAnnotationSelect,
  selectedText,
  readOnly = false
}) => {
  const textRef = useRef(null);
  const [showObjectMenu, setShowObjectMenu] = useState(false);

  const handleMouseUp = (e) => {
    if (readOnly) return;
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText) {
      const textContent = textRef.current.textContent;
      const selectedStart = textContent.indexOf(selectedText);
      
      // Check for overlapping annotations
      const isOverlapping = annotations.some(annotation => {
        return (selectedStart >= annotation.start && selectedStart < annotation.end) ||
               (selectedStart + selectedText.length > annotation.start && 
                selectedStart + selectedText.length <= annotation.end);
      });

      if (isOverlapping) {
        alert('This text overlaps with an existing annotation. Please select a different text.');
        return;
      }

      onTextSelect({
        text: selectedText,
        start: selectedStart,
        end: selectedStart + selectedText.length
      });
    }
  };

  const handleAnnotationClick = (type) => {
    if (!selectedText) {
      alert('Please select some text first');
      return;
    }

    if (type === 'Object') {
      setShowObjectMenu(true);
      return;
    }

    onAnnotationSelect(type);
  };

  const handleObjectAnnotationClick = (subType) => {
    if (!selectedText) return;
    onAnnotationSelect(`Object.${subType}`);
    setShowObjectMenu(false);
  };

  const renderHighlightedText = () => {
    if (!text) return null;

    let lastIndex = 0;
    const result = [];
    const sortedAnnotations = [...annotations].sort((a, b) => a.start - b.start);

    sortedAnnotations.forEach((annotation, index) => {
      if (annotation.start > lastIndex) {
        result.push(
          <span key={`text-${index}`} className="text-gray-800">
            {text.slice(lastIndex, annotation.start)}
          </span>
        );
      }

      const highlightColor = annotation.type.startsWith('Object.') 
        ? OBJECT_TYPES[annotation.type.split('.')[1]]?.color 
        : ANNOTATION_TYPES[annotation.type]?.color;

      result.push(
        <mark
          key={`highlight-${index}`}
          className={`${highlightColor} px-1 rounded`}
        >
          {text.slice(annotation.start, annotation.end)}
        </mark>
      );

      lastIndex = annotation.end;
    });

    if (lastIndex < text.length) {
      result.push(
        <span key="text-end" className="text-gray-800">
          {text.slice(lastIndex)}
        </span>
      );
    }

    return result;
  };

  return (
    <div className="space-y-4">
      {/* Selected text indicator */}
      {selectedText && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            Selected: <strong>"{selectedText.text}"</strong>
          </p>
        </div>
      )}

      {/* Text content */}
      <div
        ref={textRef}
        className="prose max-w-none text-gray-800 leading-relaxed select-text"
        onMouseUp={handleMouseUp}
        style={{ fontSize: '1.125rem', lineHeight: '1.8' }}
      >
        {renderHighlightedText()}
      </div>

      {/* Annotation buttons */}
      {!readOnly && (
        <div className="border-t border-gray-200 pt-4">
          <div className="text-sm font-medium text-gray-700 mb-3">
            {showObjectMenu ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowObjectMenu(false)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  ← Back
                </button>
                <span>Select Object Type</span>
              </div>
            ) : (
              "Select text and choose annotation type"
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {showObjectMenu ? (
              Object.entries(OBJECT_TYPES).map(([type, { label, color }]) => (
                <button
                  key={type}
                  onClick={() => handleObjectAnnotationClick(type)}
                  className={`${color} px-3 py-1.5 rounded-lg text-sm font-medium 
                           transition-colors hover:bg-violet-200`}
                >
                  {label}
                </button>
              ))
            ) : (
              <>
                {Object.entries(ANNOTATION_TYPES).map(([type, { label, color }]) => (
                  <button
                    key={type}
                    onClick={() => handleAnnotationClick(type)}
                    className={`${color} px-3 py-1.5 rounded-lg text-sm font-medium 
                             transition-colors hover:opacity-80`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => handleAnnotationClick('Object')}
                  className="bg-violet-100 hover:bg-violet-200 px-3 py-1.5 rounded-lg 
                           text-sm font-medium transition-colors"
                >
                  Object ↓
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TextAnnotationPanel;