import React, { useRef, useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import Toast from './Toast';

// Button color mapping for Tailwind classes
const BUTTON_COLORS = {
  blue: 'bg-blue-200 hover:bg-blue-300 focus:ring-blue-500',
  emerald: 'bg-emerald-200 hover:bg-emerald-300 focus:ring-emerald-500',
  violet: 'bg-violet-200 hover:bg-violet-300 focus:ring-violet-500',
  amber: 'bg-amber-200 hover:bg-amber-300 focus:ring-amber-500',
  fuchsia: 'bg-fuchsia-200 hover:bg-fuchsia-300 focus:ring-fuchsia-500',
  purple: 'bg-purple-200 hover:bg-purple-300 focus:ring-purple-500',
  indigo: 'bg-indigo-200 hover:bg-indigo-300 focus:ring-indigo-500',
  sky: 'bg-sky-200 hover:bg-sky-300 focus:ring-sky-500',
  teal: 'bg-teal-200 hover:bg-teal-300 focus:ring-teal-500',
  yellow: 'bg-yellow-200 hover:bg-yellow-300 focus:ring-yellow-500',
  red: 'bg-red-200 hover:bg-red-300 focus:ring-red-500',
  rose: 'bg-rose-200 hover:bg-rose-300 focus:ring-rose-500'
};

// Highlight colors for different annotation types
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

// Annotation buttons configuration
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

// Keyboard shortcuts mapping
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

const TextAnnotationPanel = ({
  text,
  annotations = [],
  onTextSelect,
  onAnnotationSelect,
  onAnnotationDelete,
  selectedText,
  eventType,
  readOnly = false
}) => {
  const textRef = useRef(null);
  const [showObjectMenu, setShowObjectMenu] = useState(false);
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [localSelection, setLocalSelection] = useState(null);

  // Check if Main Action exists
  const hasMainAction = useMemo(() => 
    annotations.some(annotation => 
      annotation.type === 'Main Action' && 
      annotation.text
    ),
    [annotations]
  );

  // Get Object-related and main buttons
  const { objectButtons, mainButtons } = useMemo(() => ({
    objectButtons: ANNOTATION_BUTTONS.filter(button => button.type.startsWith('Object.')),
    mainButtons: ANNOTATION_BUTTONS.filter(button => !button.type.startsWith('Object.'))
  }), []);

  // Handle text selection
  const handleMouseUp = (e) => {
    if (readOnly) return;
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText) {
      // Get the text node and its parent element
      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;
      
      // Calculate the absolute start position within the entire text
      let absoluteStart = 0;
      const treeWalker = document.createTreeWalker(
        textRef.current,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while ((node = treeWalker.nextNode()) !== null) {
        if (node === textNode) {
          absoluteStart += range.startOffset;
          break;
        }
        absoluteStart += node.length;
      }
      
      // Check for overlapping spans
      const isOverlapping = annotations.some(annotation => 
        (absoluteStart >= annotation.start && absoluteStart < annotation.end) ||
        (absoluteStart + selectedText.length > annotation.start && 
         absoluteStart + selectedText.length <= annotation.end) ||
        (absoluteStart <= annotation.start && 
         absoluteStart + selectedText.length >= annotation.end)
      );
  
      if (isOverlapping) {
        setShowToast(true);
        setToastMessage('Selection overlaps with existing annotation');
        return;
      }
  
      const span = {
        text: selectedText,
        start: absoluteStart,
        end: absoluteStart + selectedText.length
      };
  
      setLocalSelection(span);
      onTextSelect(span);
    }
  };

  // Handle annotation selection
  const handleAnnotationClick = (type) => {
    if (!localSelection) {
      setShowToast(true);
      setToastMessage('Please select text first');
      return;
    }

    try {
      if (type === 'Object') {
        setShowObjectMenu(true);
        return;
      }

      if (type !== 'Main Action' && !hasMainAction) {
        setShowToast(true);
        setToastMessage('Please annotate Main Action first');
        return;
      }

      const selection = {
        text: localSelection.text,
        start: localSelection.start,
        end: localSelection.end
      };

      if (type === 'Main Action') {
        onAnnotationSelect(type, selection);
      } else {
        const finalType = type.startsWith('Object.') ? 
          `Arguments.Object.${type.slice(7)}` : 
          `Arguments.${type}`;
          
        onAnnotationSelect(finalType, selection);
      }

      setShowObjectMenu(false);
      setLocalSelection(null);
      if (onTextSelect) {
        onTextSelect(null);
        window.getSelection()?.removeAllRanges();
      }
    } catch (error) {
      console.error('Error handling annotation:', error);
      setShowToast(true);
      setToastMessage('Failed to create annotation. Please try again.');
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();

      if (e.key === 'Escape') {
        e.preventDefault();
        setLocalSelection(null);
        onTextSelect(null);
        window.getSelection()?.removeAllRanges();
        return;
      }

      if (localSelection) {
        Object.entries(KEYBOARD_SHORTCUTS).forEach(([type, shortcut]) => {
          if (shortcut === key) {
            e.preventDefault();
            if (type === 'Main Action' || hasMainAction) {
              handleAnnotationClick(type);
            } else {
              setShowToast(true);
              setToastMessage('Please annotate Main Action first');
            }
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localSelection, hasMainAction, onTextSelect, handleAnnotationClick]);

  // Update local selection when prop changes
  useEffect(() => {
    setLocalSelection(selectedText);
  }, [selectedText]);

  // Clean up selection on unmount or event type change
  useEffect(() => {
    return () => {
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
      setLocalSelection(null);
    };
  }, [eventType]);

  // Render highlighted text
  const renderedHighlightedText = useMemo(() => {
    if (!text) return null;

    let lastIndex = 0;
    const sortedAnnotations = [...annotations].sort((a, b) => a.start - b.start);
    const result = [];

    sortedAnnotations.forEach((annotation, index) => {
      if (annotation.start > lastIndex) {
        result.push(
          <span key={`text-${index}`}>
            {text.slice(lastIndex, annotation.start)}
          </span>
        );
      }

      result.push(
        <mark
          key={`annotation-${index}`}
          className={`${HIGHLIGHT_COLORS[annotation.type]} relative cursor-help transition-colors duration-150 group`}
          onMouseEnter={() => setHoveredAnnotation(index)}
          onMouseLeave={() => setHoveredAnnotation(null)}
          role="mark"
          aria-label={`${annotation.type} annotation: ${text.slice(annotation.start, annotation.end)}`}
          tabIndex="0"
        >
          {text.slice(annotation.start, annotation.end)}
          {hoveredAnnotation === index && (
            <div 
              className="absolute bottom-full left-1/2 transform -translate-x-1/2 px-2 py-1 
                       bg-gray-800 text-white text-xs rounded z-10 whitespace-nowrap mb-1"
              role="tooltip"
            >
              {annotation.type}
            </div>
          )}
          {!readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAnnotationDelete?.(annotation.type, index);
              }}
              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 
                       bg-white rounded-full p-0.5 shadow-sm border border-gray-200
                       transition-opacity duration-200"
              aria-label={`Remove ${annotation.type} annotation`}
            >
              <X className="w-3 h-3 text-gray-500 hover:text-red-500" />
            </button>
          )}
        </mark>
      );

      lastIndex = annotation.end;
    });

    if (lastIndex < text.length) {
      result.push(
        <span key="text-end">
          {text.slice(lastIndex)}
        </span>
      );
    }

    return result;
  }, [text, annotations, hoveredAnnotation, readOnly, onAnnotationDelete]);

  // Helper function for button classes
  const getButtonClasses = (button, isDisabled) => {
    return `px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 
      ${isDisabled
        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
        : `${BUTTON_COLORS[button.baseColor]} focus:ring-offset-2`
      }`;
  };

  return (
    <div className="space-y-6">
      {/* Main Action Warning */}
      {!hasMainAction && !readOnly && (
        <div className="mb-4 p-3 bg-yellow-100 rounded-lg border border-yellow-200" role="alert">
          <span className="text-sm text-yellow-800 font-medium">
            ⚠️ Please annotate the Main Action first before adding other annotations
          </span>
        </div>
      )}
      
      {/* Selected Text Indicator */}
      {localSelection && (
        <div className="mb-4 p-3 bg-blue-100 rounded-lg" role="status">
          <span className="text-sm text-blue-800 font-medium">
            Selected text: <strong>"{localSelection.text}"</strong>
            <br />
            <span className="text-xs text-blue-600">Press ESC to clear selection</span>
          </span>
        </div>
      )}

      {/* Text Content */}
      <div
        ref={textRef}
        className="prose max-w-none text-gray-800 leading-relaxed select-text mb-6"
        onMouseUp={handleMouseUp}
        style={{ fontSize: '1.125rem', lineHeight: '1.8' }}
        role="textbox"
        aria-label="Annotatable text content"
        tabIndex="0"
      >
        {renderedHighlightedText}
      </div>

      {/* Annotation Buttons */}
      {!readOnly && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3" id="annotation-buttons-label">
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
              <>
                Select text and choose annotation type
                <br />
                <span className="text-xs text-gray-500">
                  Use keyboard shortcuts shown on buttons or select with mouse
                </span>
              </>
            )}
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2" 
               role="toolbar" 
               aria-label="Annotation options">
            {showObjectMenu ? (
              // Object type buttons
              objectButtons.map(button => {
                const isDisabled = !hasMainAction;
                const shortcut = KEYBOARD_SHORTCUTS[button.type];
                
                return (
                  <button
                    key={button.type}
                    onClick={() => handleAnnotationClick(button.type)}
                    disabled={isDisabled}
                    className={getButtonClasses(button, isDisabled)}
                    title={isDisabled
                      ? 'Please annotate Main Action first'
                      : `${button.description} (Shortcut: ${shortcut})`
                    }
                  >
                    <span>{button.label}</span>
                    <span className="ml-2 text-xs text-gray-500">{shortcut}</span>
                  </button>
                );
              })
            ) : (
              // Main annotation buttons + Object button
              <>
                {mainButtons.map(button => {
                  const isDisabled = button.type !== 'Main Action' && !hasMainAction;
                  const shortcut = KEYBOARD_SHORTCUTS[button.type];
                  
                  return (
                    <button
                      key={button.type}
                      onClick={() => handleAnnotationClick(button.type)}
                      disabled={isDisabled}
                      className={getButtonClasses(button, isDisabled)}
                      title={isDisabled
                        ? 'Please annotate Main Action first'
                        : `${button.description} (Shortcut: ${shortcut})`
                      }
                    >
                      <span>{button.label}</span>
                      <span className="ml-2 text-xs text-gray-500">{shortcut}</span>
                    </button>
                  );
                })}

                {/* Object Menu Button */}
                <button
                  onClick={() => handleAnnotationClick('Object')}
                  disabled={!hasMainAction}
                  className={!hasMainAction 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2'
                    : 'bg-violet-200 hover:bg-violet-300 focus:ring-violet-500 focus:ring-offset-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2'
                  }
                  title={!hasMainAction ? 'Please annotate Main Action first' : 'Object-related annotations'}
                >
                  Object ↓
                </button>
              </>
            )}
          </div>

          {/* Keyboard shortcuts help */}
          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>Keyboard navigation:</strong>
              <br />
              • Use Tab to move between buttons
              <br />
              • Press Enter to activate buttons
              <br />
              • Use number keys 1-9 and letters (r,a,c,e,i,d) for quick annotation
              <br />
              • Press ESC to clear text selection
            </p>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {showToast && (
        <Toast 
          message={toastMessage} 
          onClose={() => setShowToast(false)} 
        />
      )}
    </div>
  );
};

export default TextAnnotationPanel;