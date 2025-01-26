import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import Toast from './Toast';

const HIGHLIGHT_COLORS = {
  'Main Action': 'bg-blue-200 hover:bg-blue-300',
  'Arguments.Agent': 'bg-emerald-200 hover:bg-emerald-300',
  'Arguments.Object.Base Object': 'bg-violet-200 hover:bg-violet-300',
  'Arguments.Object.Base Modifier': 'bg-violet-200 hover:bg-violet-300',
  'Arguments.Object.Attached Object': 'bg-violet-200 hover:bg-violet-300',
  'Arguments.Object.Attached Modifier': 'bg-violet-200 hover:bg-violet-300',
  'Arguments.Context': 'bg-amber-200 hover:bg-amber-300',
  'Arguments.Purpose': 'bg-fuchsia-200 hover:bg-fuchsia-300',
  'Arguments.Method': 'bg-purple-200 hover:bg-purple-300',
  'Arguments.Results': 'bg-indigo-200 hover:bg-indigo-300',
  'Arguments.Analysis': 'bg-sky-200 hover:bg-sky-300',
  'Arguments.Challenge': 'bg-teal-200 hover:bg-teal-300',
  'Arguments.Ethical': 'bg-yellow-200 hover:bg-yellow-300',
  'Arguments.Implications': 'bg-red-200 hover:bg-red-300',
  'Arguments.Contradictions': 'bg-rose-200 hover:bg-rose-300'
};

const BUTTON_COLORS = {
  'blue': 'bg-blue-100 hover:bg-blue-200 text-blue-700',
  'emerald': 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700',
  'violet': 'bg-violet-100 hover:bg-violet-200 text-violet-700',
  'amber': 'bg-amber-100 hover:bg-amber-200 text-amber-700',
  'fuchsia': 'bg-fuchsia-100 hover:bg-fuchsia-200 text-fuchsia-700',
  'purple': 'bg-purple-100 hover:bg-purple-200 text-purple-700',
  'indigo': 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700',
  'sky': 'bg-sky-100 hover:bg-sky-200 text-sky-700',
  'teal': 'bg-teal-100 hover:bg-teal-200 text-teal-700',
  'yellow': 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700',
  'red': 'bg-red-100 hover:bg-red-200 text-red-700',
  'rose': 'bg-rose-100 hover:bg-rose-200 text-rose-700'
};

const KEYBOARD_SHORTCUTS = {
  'Main Action': '1',
  'Agent': '2',
  'Object.Base Object': '3',
  'Object.Base Modifier': '4',
  'Object.Attached Object': '5',
  'Object.Attached Modifier': '6',
  'Context': '7',
  'Purpose': '8',
  'Method': '9',
  'Results': 'r',
  'Analysis': 'a',
  'Challenge': 'c',
  'Ethical': 'e',
  'Implications': 'i',
  'Contradictions': 'd'
};

const ANNOTATION_BUTTONS = [
  { type: 'Main Action', label: 'Main Action', baseColor: 'blue', description: 'Primary action or event being described' },
  { type: 'Agent', label: 'Agent', baseColor: 'emerald', description: 'Entity performing the action' },
  { type: 'Object.Base Object', label: 'Base Object', baseColor: 'violet', description: 'Primary object involved' },
  { type: 'Object.Base Modifier', label: 'Base Modifier', baseColor: 'violet', description: 'Describes base object' },
  { type: 'Object.Attached Object', label: 'Attached Object', baseColor: 'violet', description: 'Connected to base object' },
  { type: 'Object.Attached Modifier', label: 'Attached Modifier', baseColor: 'violet', description: 'Describes attached object' },
  { type: 'Context', label: 'Context', baseColor: 'amber', description: 'Surrounding circumstances or conditions' },
  { type: 'Purpose', label: 'Purpose', baseColor: 'fuchsia', description: 'Goal or intended outcome' },
  { type: 'Method', label: 'Method', baseColor: 'purple', description: 'How the action is performed' },
  { type: 'Results', label: 'Results', baseColor: 'indigo', description: 'Outcome or consequences' },
  { type: 'Analysis', label: 'Analysis', baseColor: 'sky', description: 'Interpretation or evaluation' },
  { type: 'Challenge', label: 'Challenge', baseColor: 'teal', description: 'Difficulties or obstacles' },
  { type: 'Ethical', label: 'Ethical', baseColor: 'yellow', description: 'Moral or ethical considerations' },
  { type: 'Implications', label: 'Implications', baseColor: 'red', description: 'Future impact or significance' },
  { type: 'Contradictions', label: 'Contradictions', baseColor: 'rose', description: 'Inconsistencies or conflicts' }
];


const TextAnnotationPanel = ({
  text,
  annotations = [],
  onTextSelect,
  onAnnotationSelect,
  onAnnotationDelete,
  readOnly = false
}) => {
  const textRef = useRef(null);
  const textContainerRef = useRef(null);
  const [localSelection, setLocalSelection] = useState(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null);
  const [showToast, setShowToast] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const hasMainAction = useMemo(() => 
    annotations.some(annotation => annotation.type === 'Main Action'),
    [annotations]
  );

  // Get all text nodes up to a specific node
  const getTextUpToNode = useCallback((container, targetNode) => {
    if (!container || !targetNode) return 0;
    
    let length = 0;
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while ((node = walker.nextNode()) && node !== targetNode) {
      length += node.textContent.length;
    }

    return length;
  }, []);

  // Calculate exact selection indices
  const getExactIndices = useCallback((container, selection) => {
    if (!selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(container);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);

    const start = getTextUpToNode(container, range.startContainer) + range.startOffset;
    const end = start + range.toString().length;

    return { start, end, text: range.toString() };
  }, [getTextUpToNode]);

  const clearSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection) {
      try {
        selection.removeAllRanges();
      } catch (e) {
        selection.empty();
      }
    }
    setLocalSelection(null);
    setIsSelecting(false);
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (!textRef.current?.contains(e.target) || readOnly) {
      clearSelection();
      return;
    }
    setIsSelecting(true);
  }, [readOnly, clearSelection]);

  const handleMouseMove = useCallback((e) => {
    if (!isSelecting) return;

    if (!textRef.current?.contains(e.target)) {
      clearSelection();
      setShowToast({
        message: 'Please keep your selection inside the text box.',
        type: 'error'
      });
    }
  }, [isSelecting, clearSelection]);

  const handleMouseUp = useCallback((e) => {
    if (readOnly) return;
    setIsSelecting(false);

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const isStartInPanel = textRef.current?.contains(range.startContainer);
    const isEndInPanel = textRef.current?.contains(range.endContainer);

    if (!isStartInPanel || !isEndInPanel) {
      clearSelection();
      setShowToast({
        message: 'Please keep your selection inside the text box.',
        type: 'error'
      });
      return;
    }

    // Get exact indices
    const indices = getExactIndices(textContainerRef.current, selection);
    if (!indices) {
      clearSelection();
      return;
    }

    // Get the selected text and trim it
    const selectedText = indices.text.trim();
    const leadingSpaces = indices.text.length - indices.text.trimStart().length;
    const trailingSpaces = indices.text.length - indices.text.trimEnd().length;

    // Adjust indices for trimmed whitespace
    const adjustedIndices = {
      start: indices.start + leadingSpaces,
      end: indices.end - trailingSpaces,
      text: selectedText
    };

    // Check for overlap with existing annotations
    const hasOverlap = annotations.some(annotation => 
      (adjustedIndices.start >= annotation.start && adjustedIndices.start < annotation.end) ||
      (adjustedIndices.end > annotation.start && adjustedIndices.end <= annotation.end) ||
      (adjustedIndices.start <= annotation.start && adjustedIndices.end >= annotation.end)
    );

    if (hasOverlap) {
      clearSelection();
      setShowToast({
        message: 'Selection overlaps with existing annotation.',
        type: 'error'
      });
      return;
    }

    setLocalSelection(adjustedIndices);
    onTextSelect(adjustedIndices);
  }, [readOnly, annotations, clearSelection, onTextSelect, getExactIndices]);

  const handleMouseLeave = useCallback(() => {
    if (isSelecting) {
      clearSelection();
      setShowToast({
        message: 'Please keep your selection inside the text box.',
        type: 'error'
      });
    }
  }, [isSelecting, clearSelection]);

  const handleAnnotationClick = useCallback((type) => {
    if (!localSelection) {
      setShowToast({
        message: 'Please select text before adding an annotation.',
        type: 'error'
      });
      return;
    }
  
    if (type !== 'Main Action' && !hasMainAction) {
      setShowToast({
        message: 'Please annotate Main Action first',
        type: 'error'
      });
      return;
    }
  
    const fieldPath = type === 'Main Action' ? type :
      type.startsWith('Object.') ?
        `Arguments.Object.${type.slice(7)}` :
        `Arguments.${type}`;
  
    onAnnotationSelect(fieldPath, localSelection);
    clearSelection();
    setShowToast({
      message: `Added ${type} annotation`,
      type: 'success'
    });
  }, [localSelection, hasMainAction, onAnnotationSelect, clearSelection]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
        return;
      }
  
      if (!localSelection) return;
  
      const key = e.key.toLowerCase();
      const buttonType = Object.entries(KEYBOARD_SHORTCUTS).find(([_, shortcut]) =>
        shortcut.toLowerCase() === key
      )?.[0];
  
      if (buttonType) {
        e.preventDefault();
        handleAnnotationClick(buttonType);
      }
    };
  
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localSelection, clearSelection, handleAnnotationClick]);

  // Calculate ranges outside renderedText
  const calculateRanges = useMemo(() => {
    if (!text) return [];
    
    // Group annotations by type to track indices
    const annotationsByType = {};
    annotations.forEach(annotation => {
      if (!annotationsByType[annotation.type]) {
        annotationsByType[annotation.type] = [];
      }
      annotationsByType[annotation.type].push(annotation);
    });
  
    // Add indices within their type groups
    const annotationsWithIndices = annotations.map(annotation => {
      const typeIndex = annotationsByType[annotation.type].findIndex(a => 
        a.start === annotation.start && a.end === annotation.end
      );
      return {
        ...annotation,
        typeIndex // Index within its own type group
      };
    });
  
    const allRanges = localSelection 
    ? [...annotations, { 
        start: localSelection.start, 
        end: localSelection.end, 
        type: 'current-selection',
        id: 'selection',
        annotationId: 'selection'
      }]
    : annotations;
  
  return [...allRanges].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return a.end - b.end;
  });
}, [annotations, localSelection, text]);


const renderedText = useMemo(() => {
  if (!text) return null;

  let lastIndex = 0;
  const result = [];

  calculateRanges.forEach((range, index) => {
    if (range.start > lastIndex) {
      result.push(
        <span key={`text-${index}`} className="whitespace-pre-wrap">
          {text.slice(lastIndex, range.start)}
        </span>
      );
    }

    const rangeText = text.slice(range.start, range.end);

    if (range.type === 'current-selection') {
      result.push(
        <mark
          key={`selection-${index}`}
          className="bg-blue-100 text-blue-900 transition-colors duration-200 
                   inline whitespace-pre-wrap p-0 m-0"
          onClick={(e) => e.stopPropagation()}
        >
          {rangeText}
        </mark>
      );
    } else {
      result.push(
        <mark
          key={`annotation-${range.id}-${index}`}
          className={`${HIGHLIGHT_COLORS[range.type]} relative cursor-help 
                    transition-colors duration-150 group inline whitespace-pre-wrap p-0 m-0`}
          onMouseEnter={() => setHoveredAnnotation(index)}
          onMouseLeave={() => setHoveredAnnotation(null)}
          onClick={(e) => e.stopPropagation()}
        >
          {rangeText}
          {hoveredAnnotation === index && (
            <div 
              className="absolute bottom-full left-1/2 transform -translate-x-1/2 
                       px-2 py-1 bg-gray-800 text-white text-xs rounded 
                       z-10 whitespace-nowrap mb-1 fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              {range.type.replace(/\./g, ' → ')}
            </div>
          )}
          {!readOnly && (
            <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAnnotationDelete?.(range.type, range.annotationId);
            }}
            className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 
                      bg-white rounded-full p-0.5 shadow-sm border border-gray-200
                      transition-opacity duration-200 z-20"
            aria-label="Delete annotation"
          >
            <X className="w-3 h-3 text-gray-500 hover:text-red-500" />
          </button>
          )}
        </mark>
      );
    }

    lastIndex = range.end;
  });

  if (lastIndex < text.length) {
    result.push(
      <span key="text-end" className="whitespace-pre-wrap">
        {text.slice(lastIndex)}
      </span>
    );
  }

  return result;
}, [
  text,
  calculateRanges,
  hoveredAnnotation,
  readOnly,
  onAnnotationDelete
]);
  return (
    <div className="space-y-6" role="application" aria-label="Text Annotation Panel">
      {showToast && (
        <Toast 
          message={showToast.message}
          type={showToast.type}
          onClose={() => setShowToast(null)}
        />
      )}

      <div aria-live="polite" className="sr-only">
        {localSelection ? `Selected text: ${localSelection.text}` : ''}
      </div>

      {!hasMainAction && !readOnly && (
        <div className="mb-4 p-3 bg-yellow-100 rounded-lg border border-yellow-200" 
             role="alert">
          <span className="text-sm text-yellow-800 font-medium">
            ⚠️ Please annotate the Main Action first before adding other annotations
          </span>
        </div>
      )}

      {localSelection && (
        <div className="mb-4 p-3 bg-blue-100 rounded-lg fade-in" role="status">
          <span className="text-sm text-blue-800 font-medium">
            Selected text: <strong>"{localSelection.text}"</strong>
            <br />
            <span className="text-xs text-blue-600">Press ESC to clear selection</span>
          </span>
        </div>
      )}

      <div
        ref={textRef}
        className="prose max-w-none text-gray-800 leading-relaxed mb-6 border-2 
                  border-gray-200 rounded-lg p-4 selectable-text custom-scrollbar"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ 
          fontSize: '1.125rem', 
          lineHeight: '1.8',
          WebkitUserSelect: 'text',
          MozUserSelect: 'text',
          msUserSelect: 'text',
          userSelect: 'text'
        }}
        role="textbox"
        aria-label="Annotatable text content"
        tabIndex="0"
      >
        <div ref={textContainerRef}>
          {renderedText}
        </div>
      </div>

      {!readOnly && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3" id="annotation-buttons-label">
            Select text and choose annotation type
            <br />
            <span className="text-xs text-gray-500">
              Use keyboard shortcuts shown on buttons or select with mouse
            </span>
          </h3>

          <div 
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
            role="group"
            aria-labelledby="annotation-buttons-label"
          >
            {ANNOTATION_BUTTONS.map((button) => {
              const isDisabled = button.type !== 'Main Action' && !hasMainAction;
              const shortcut = KEYBOARD_SHORTCUTS[button.type];

              return (
                <button
                  key={button.type}
                  onClick={() => handleAnnotationClick(button.type)}
                  disabled={isDisabled}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    focus:outline-none focus:ring-2 
                    ${isDisabled 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : `${BUTTON_COLORS[button.baseColor]} focus:ring-offset-2`
                    }`}
                  title={isDisabled
                    ? 'Please annotate Main Action first'
                    : `${button.description} (Shortcut: ${shortcut})`
                  }
                  aria-disabled={isDisabled}
                >
                  <span>{button.label}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {shortcut}
                  </span>
                </button>
              );
            })}
          </div>

          <div 
            className="mt-4 text-sm text-gray-600"
            role="complementary"
            aria-label="Keyboard navigation instructions"
          >
            <p>
              <strong>Keyboard shortcuts:</strong>
              <br />
              • Use number keys 1-9 for first nine annotation types
              <br />
              • Use letters (r,a,c,e,i,d) for remaining types
              <br />
              • Press ESC to clear text selection
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextAnnotationPanel;