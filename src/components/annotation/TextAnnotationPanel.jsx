import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import { Alert } from '@/components/ui/alert';

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
// Highlight colors for different annotation types
const HIGHLIGHT_COLORS = {
  'Main Action': 'highlight-main-action',
  'Arguments.Agent': 'highlight-agent',
  'Arguments.Object.Base Object': 'highlight-object',
  'Arguments.Object.Base Modifier': 'highlight-object',
  'Arguments.Object.Attached Object': 'highlight-object',
  'Arguments.Object.Attached Modifier': 'highlight-object',
  'Arguments.Context': 'highlight-context',
  'Arguments.Purpose': 'highlight-purpose',
  'Arguments.Method': 'highlight-method',
  'Arguments.Results': 'highlight-results',
  'Arguments.Analysis': 'highlight-analysis',
  'Arguments.Challenge': 'highlight-challenge',
  'Arguments.Ethical': 'highlight-ethical',
  'Arguments.Implications': 'highlight-implications',
  'Arguments.Contradictions': 'highlight-contradictions'
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
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null);
  const [error, setError] = useState('');

  // Check if Main Action exists
  const hasMainAction = useMemo(() => 
    annotations.some(annotation => 
      annotation.type === 'Main Action' && 
      annotation.text?.trim().length > 0
    ),
    [annotations]
  );

  // Handle text selection
  const handleTextSelection = useCallback(() => {
    if (readOnly || !onTextSelect) return;

    const selection = window.getSelection();
    const selectedStr = selection?.toString().trim();

    if (!selectedStr) {
      setError('Please select some text first');
      return;
    }

    if (!selection?.rangeCount) {
      setError('Invalid selection');
      return;
    }

    try {
      const containerNode = textRef.current;
      if (!containerNode) {
        setError('Text container not found');
        return;
      }

      const range = selection.getRangeAt(0);

      // Ensure selection is within our container
      if (!containerNode.contains(range.startContainer) || 
          !containerNode.contains(range.endContainer)) {
        setError('Please select text within the content area');
        return;
      }

      // Calculate selection position
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(containerNode);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      const start = preCaretRange.toString().length;

      // Check for overlapping annotations
      const isOverlapping = annotations.some(annotation => 
        (start >= annotation.start && start < annotation.end) ||
        (start + selectedStr.length > annotation.start && 
         start + selectedStr.length <= annotation.end) ||
        (start <= annotation.start && 
         start + selectedStr.length >= annotation.end)
      );

      if (isOverlapping) {
        setError('Selection overlaps with existing annotation');
        return;
      }

      onTextSelect({
        text: selectedStr,
        start,
        end: start + selectedStr.length
      });
      setError('');
    } catch (error) {
      console.error('Selection error:', error);
      setError('Error processing text selection');
    }
  }, [readOnly, onTextSelect, annotations]);

  // Handle annotation button click
  const handleAnnotationClick = useCallback(async (type) => {
    if (!selectedText) {
      setError('Please select text first');
      return;
    }

    if (type !== 'Main Action' && !hasMainAction) {
      setError('Please annotate Main Action first');
      return;
    }

    try {
      const selection = {
        text: selectedText.text,
        start: selectedText.start,
        end: selectedText.end
      };

      if (type.startsWith('Object.')) {
        await onAnnotationSelect(`Arguments.${type}`, [selection]);
      } else {
        const isMainAction = type === 'Main Action';
        await onAnnotationSelect(
          isMainAction ? type : `Arguments.${type}`,
          isMainAction ? selection.text : [selection]
        );
      }

      window.getSelection()?.removeAllRanges();
    } catch (error) {
      setError(error.message || 'Failed to create annotation');
    }
  }, [selectedText, hasMainAction, onAnnotationSelect]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (readOnly || !selectedText || 
          e.target.tagName === 'INPUT' || 
          e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        onTextSelect(null);
        return;
      }

      const shortcut = e.key.toLowerCase();
      const button = ANNOTATION_BUTTONS.find(btn => 
        KEYBOARD_SHORTCUTS[btn.type]?.toLowerCase() === shortcut
      );

      if (button) {
        e.preventDefault();
        handleAnnotationClick(button.type);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedText, readOnly, onTextSelect, handleAnnotationClick]);

  // Mouse event handlers
  useEffect(() => {
    const textContainer = textRef.current;
    if (!textContainer || readOnly) return;

    let mouseIsDown = false;

    const handleMouseDown = () => {
      mouseIsDown = true;
    };

    const handleMouseUp = () => {
      if (mouseIsDown) {
        handleTextSelection();
      }
      mouseIsDown = false;
    };

    textContainer.addEventListener('mousedown', handleMouseDown);
    textContainer.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      textContainer.removeEventListener('mousedown', handleMouseDown);
      textContainer.removeEventListener('mouseup', handleMouseUp);
    };
  }, [readOnly, handleTextSelection]);

  // Clear error message timer
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Render highlighted text
  const renderedHighlightedText = useMemo(() => {
    if (!text) return null;

    let lastIndex = 0;
    const sortedAnnotations = [...annotations].sort((a, b) => a.start - b.start);
    const result = [];

    sortedAnnotations.forEach((annotation, index) => {
      if (annotation.start > lastIndex) {
        result.push(
          <span key={`text-${index}`}>{text.slice(lastIndex, annotation.start)}</span>
        );
      }

      const highlightColor = HIGHLIGHT_COLORS[annotation.type];
      
      result.push(
        <mark
          key={`annotation-${index}`}
          className={`${highlightColor} relative cursor-help transition-colors duration-150 group`}
          onMouseEnter={() => setHoveredAnnotation(index)}
          onMouseLeave={() => setHoveredAnnotation(null)}
        >
          {text.slice(annotation.start, annotation.end)}
          {hoveredAnnotation === index && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 px-2 py-1 
                          bg-gray-800 text-white text-xs rounded z-10 whitespace-nowrap mb-1">
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
            >
              <X className="w-3 h-3 text-gray-500 hover:text-red-500" />
            </button>
          )}
        </mark>
      );

      lastIndex = annotation.end;
    });

    if (lastIndex < text.length) {
      result.push(<span key="text-end">{text.slice(lastIndex)}</span>);
    }

    return result;
  }, [text, annotations, hoveredAnnotation, readOnly, onAnnotationDelete]);

  return (
    <div className="space-y-6">
      {!hasMainAction && !readOnly && (
        <div className="mb-4 p-3 bg-yellow-100 rounded-lg border border-yellow-200">
          <span className="text-sm text-yellow-800 font-medium">
            ⚠️ Please annotate the Main Action first before adding other annotations
          </span>
        </div>
      )}

      {/* Selected Text Indicator */}
      {selectedText && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-sm">
            <span className="font-medium text-gray-700">Selected text: </span>
            <span className="text-blue-600 font-medium">"{selectedText.text}"</span>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Press ESC to clear selection
          </p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Text Content */}
      <div
        ref={textRef}
        className="prose max-w-none text-gray-800 leading-relaxed text-container"
        style={{ 
          fontSize: '1.125rem', 
          lineHeight: '1.8'
        }}
      >
        {renderedHighlightedText || text}
      </div>

      {/* Annotation Buttons */}
      {!readOnly && (
        <div className="border-t border-gray-200 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {ANNOTATION_BUTTONS.map(button => {
              const isDisabled = button.type !== 'Main Action' && !hasMainAction;
              const shortcut = KEYBOARD_SHORTCUTS[button.type];
              
              return (
                <button
                  key={button.type}
                  onClick={() => handleAnnotationClick(button.type)}
                  disabled={isDisabled}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDisabled
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : BUTTON_COLORS[button.baseColor]
                  }`}
                  title={`${button.description} (Shortcut: ${shortcut})`}
                >
                  <span>{button.label}</span>
                  <span className="ml-2 text-xs text-gray-500">{shortcut}</span>
                </button>
              );
            })}
          </div>

          {/* Keyboard Navigation Help */}
          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>Keyboard shortcuts:</strong>
              <br />
              • Use Tab to move between buttons
              <br />
              • Press Enter to activate buttons
              <br />
              • Use number keys 1-9 and letters (r,a,c,e,i,d) for quick annotation
              <br />
              • Press ESC to clear selection
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TextAnnotationPanel);