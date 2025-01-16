import React, { useState } from 'react';
import { Download, Trash2, ChevronRight, ChevronDown } from 'lucide-react';

// Color scheme for syntax highlighting
const SYNTAX_COLORS = {
  key: 'text-yellow-300 font-medium',
  string: 'text-emerald-300',
  bracket: 'text-blue-300',
  colon: 'text-gray-300',
  comma: 'text-gray-400'
};

// Default expanded paths
const DEFAULT_EXPANDED_PATHS = new Set([
  'Text',
  'Background/Introduction',
  'Methods/Approach',
  'Results/Findings',
  'Conclusions/Implications',
  'Main Action',
  'Arguments',
  'Arguments.Agent',
  'Arguments.Object',
  'Arguments.Context',
  'Arguments.Purpose',
  'Arguments.Method',
  'Arguments.Results',
  'Arguments.Analysis',
  'Arguments.Challenge',
  'Arguments.Ethical',
  'Arguments.Implications',
  'Arguments.Contradictions'
]);

// Helper to clean the data structure
const cleanData = (data) => {
  if (!data) return {};

  // Get current event type
  const eventType = Object.keys(data).find(key => 
    key !== 'Text' && key !== 'Main Action' && key !== 'Arguments'
  );

  // Build clean structure
  const cleaned = {
    [eventType]: data[eventType] || '',  // Event type summary (string)
    Text: data.Text || '',
    'Main Action': data['Main Action'] || '',  // Main action (string)
    Arguments: {
      Agent: [],  // Arrays for all arguments
      Object: {
        'Base Object': [],
        'Base Modifier': [],
        'Attached Object': [],
        'Attached Modifier': []
      },
      Context: [],
      Purpose: [],
      Method: [],
      Results: [],
      Analysis: [],
      Challenge: [],
      Ethical: [],
      Implications: [],
      Contradictions: []
    }
  };

  // Fill in any existing annotations
  if (data.Arguments) {
    Object.entries(data.Arguments).forEach(([key, value]) => {
      if (key === 'Object') {
        Object.entries(value || {}).forEach(([objKey, objValue]) => {
          if (objValue && objValue.spans) {
            cleaned.Arguments.Object[objKey] = objValue.spans.map(span => span.text);
          }
        });
      } else if (value && value.spans) {
        cleaned.Arguments[key] = value.spans.map(span => span.text);
      }
    });
  }

  return cleaned;
};

const JsonViewer = ({ data, onDownload, onRemoveAnnotation }) => {
  const [expandedPaths, setExpandedPaths] = useState(DEFAULT_EXPANDED_PATHS);

  const togglePath = (path) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const renderJsonField = (key, value, depth = 0, path = '') => {
    const indent = '  '.repeat(depth);
    const currentPath = path ? `${path}.${key}` : key;
    const isExpanded = expandedPaths.has(currentPath);
    const isObject = typeof value === 'object' && value !== null;

    // Handle arrays (for arguments)
    if (Array.isArray(value)) {
      return (
        <div key={key} className="flex items-center group py-0.5 font-mono">
          <span className={SYNTAX_COLORS.key}>{indent}"{key}"</span>
          <span className={SYNTAX_COLORS.colon}>: </span>
          <span className={SYNTAX_COLORS.bracket}>[]</span>
          {value.length > 0 && onRemoveAnnotation && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemoveAnnotation(currentPath);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded ml-2
                       transition-opacity focus:opacity-100 focus:outline-none
                       focus:ring-1 focus:ring-red-500"
              aria-label={`Remove ${key} annotation`}
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-300" />
            </button>
          )}
        </div>
      );
    }

    // Handle objects
    if (isObject && Object.keys(value).length > 0) {
      return (
        <div key={key} className="group font-mono">
          <div 
            className="flex items-start cursor-pointer hover:bg-gray-800/50 rounded px-2 py-0.5 -mx-2
                     focus-within:ring-1 focus-within:ring-blue-500 focus-within:outline-none"
            onClick={() => togglePath(currentPath)}
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
          >
            <span className="text-gray-400 w-4 mt-1">
              {isExpanded ? 
                <ChevronDown className="w-3.5 h-3.5" /> : 
                <ChevronRight className="w-3.5 h-3.5" />
              }
            </span>
            <span className={SYNTAX_COLORS.key}>{indent}"{key}"</span>
            <span className={SYNTAX_COLORS.colon}>: </span>
            <span className={SYNTAX_COLORS.bracket}>{'{'}</span>
          </div>
          <div className={`ml-4 ${isExpanded ? 'block' : 'hidden'}`}>
            {Object.entries(value).map(([k, v], index, arr) => (
              <div key={k}>
                {renderJsonField(k, v, depth + 1, currentPath)}
                {index < arr.length - 1 && <span className={SYNTAX_COLORS.comma}>,</span>}
              </div>
            ))}
          </div>
          <div className={isExpanded ? 'block py-0.5' : 'hidden'}>
            <span className={SYNTAX_COLORS.bracket}>{indent}{'}'}</span>
          </div>
        </div>
      );
    }

    // Handle strings (for Text, event type, and Main Action)
    return (
      <div key={key} className="flex items-center group py-0.5 font-mono">
        <span className={SYNTAX_COLORS.key}>{indent}"{key}"</span>
        <span className={SYNTAX_COLORS.colon}>: </span>
        <span className={SYNTAX_COLORS.string}>"{value || ''}"</span>
        {value && key !== 'Text' && onRemoveAnnotation && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemoveAnnotation(currentPath);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded ml-2
                     transition-opacity focus:opacity-100 focus:outline-none
                     focus:ring-1 focus:ring-red-500"
            aria-label={`Remove ${key} annotation`}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-300" />
          </button>
        )}
      </div>
    );
  };

  const cleanedData = cleanData(data);

  return (
    <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden border border-gray-800">
      <div className="bg-gray-800/50 px-4 py-3 flex justify-between items-center border-b border-gray-700">
        <h3 className="text-gray-100 font-medium tracking-wide">JSON Output</h3>
        {onDownload && (
          <button
            onClick={onDownload}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Download JSON"
            aria-label="Download JSON file"
          >
            <Download className="w-4 h-4 text-gray-400 hover:text-gray-300" />
          </button>
        )}
      </div>

      <div 
        className="p-4 text-sm overflow-auto max-h-[calc(100vh-24rem)] font-mono
                   scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
        role="region"
        aria-label="JSON content viewer"
      >
        <div className={SYNTAX_COLORS.bracket}>{'{'}</div>
        <div className="ml-4">
          {Object.entries(cleanedData).map(([key, value], index, arr) => (
            <React.Fragment key={key}>
              {renderJsonField(key, value, 1)}
              {index < arr.length - 1 && (
                <span className={SYNTAX_COLORS.comma}>,</span>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className={SYNTAX_COLORS.bracket}>{'}'}</div>
      </div>
    </div>
  );
};

export default JsonViewer;