import React, { useState, useEffect } from 'react';
import { Download, Trash2, ChevronRight, ChevronDown } from 'lucide-react';

// Field ordering constants remain the same
const FIELD_ORDER = [
  'Background/Introduction',
  'Methods/Approach',
  'Results/Findings',
  'Conclusions/Implications',
  'Text',
  'Main Action',
  'Arguments'
];

const ARGUMENTS_ORDER = [
  'Agent',
  'Object',
  'Context',
  'Purpose',
  'Method',
  'Results',
  'Analysis',
  'Challenge',
  'Ethical',
  'Implications',
  'Contradictions'
];

const OBJECT_FIELD_ORDER = [
  'Base Object',
  'Base Modifier',
  'Attached Object',
  'Attached Modifier'
];

const SYNTAX_COLORS = {
  key: 'text-yellow-300 font-medium',
  string: 'text-emerald-300',
  bracket: 'text-blue-300',
  colon: 'text-gray-300',
  comma: 'text-gray-400'
};

const CollapsibleField = ({ 
  label, 
  isExpanded, 
  onToggle, 
  children, 
  isArgumentSection = false,
  depth = 0,
  isArray = false 
}) => {
  const indent = '  '.repeat(depth);
  
  return (
    <div className="group font-mono">
      <div
        className={`flex items-center py-0.5 hover:bg-gray-800/50 rounded px-2 -mx-2
                   focus-within:ring-1 focus-within:ring-blue-500 focus-within:outline-none
                   ${isArgumentSection ? 'cursor-default' : 'cursor-pointer'}`}
        onClick={() => !isArgumentSection && onToggle()}
        role={isArgumentSection ? undefined : "button"}
        tabIndex={isArgumentSection ? undefined : 0}
        aria-expanded={isExpanded}
      >
        <span className="text-gray-400 w-4">
          {isExpanded ? 
            <ChevronDown className="w-3.5 h-3.5" /> : 
            <ChevronRight className="w-3.5 h-3.5" />}
        </span>
        <span className={SYNTAX_COLORS.key}>{indent}"{label}"</span>
        <span className={SYNTAX_COLORS.colon}>: </span>
        <span className={SYNTAX_COLORS.bracket}>{isArray ? '[' : '{'}</span>
      </div>

      <div className={isExpanded ? 'ml-4' : 'hidden'}>
        {children}
      </div>

      <div className={isExpanded ? 'py-0.5' : 'hidden'}>
        <span className={SYNTAX_COLORS.bracket}>
          {indent}{isArray ? ']' : '}'}
        </span>
      </div>
    </div>
  );
};

const JsonViewer = ({ 
  data = {}, 
  onDownload,
  onRemoveAnnotation,
  readOnly = false 
}) => {
  // Always initialize hooks at the top level
  const [expandedPaths, setExpandedPaths] = useState(new Set(['Arguments', 'Arguments.Object']));

  // Effect to handle path expansion
  useEffect(() => {
    const pathsToExpand = new Set(['Arguments', 'Arguments.Object']);
    
    const findPathsWithValues = (obj, currentPath = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      Object.entries(obj).forEach(([key, value]) => {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        if (value !== null && value !== undefined && value !== '') {
          pathsToExpand.add(newPath);
        }
        if (typeof value === 'object') {
          findPathsWithValues(value, newPath);
        }
      });
    };

    if (data && typeof data === 'object') {
      findPathsWithValues(data);
      setExpandedPaths(pathsToExpand);
    }
  }, [data]);

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

  const renderValue = (value, path) => {
    if (value === null || value === undefined) {
      return <span className={SYNTAX_COLORS.string}>null</span>;
    }

    if (Array.isArray(value)) {
      return (
        <div className="flex flex-col">
          {value.length === 0 ? (
            <span className={SYNTAX_COLORS.string}>[]</span>
          ) : (
            value.map((item, index) => {
              const displayText = typeof item === 'object' ? item?.text || JSON.stringify(item) : String(item);
              return (
                <div key={index} className="flex items-center group py-0.5">
                  <span className={SYNTAX_COLORS.string}>"{displayText || ''}"</span>
                  {!readOnly && (
                    <button
                      onClick={() => onRemoveAnnotation?.(`${path}.${index}`)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded ml-2
                               transition-opacity focus:opacity-100 focus:outline-none
                               focus:ring-1 focus:ring-red-500"
                      aria-label="Remove annotation"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-300" />
                    </button>
                  )}
                  {index < value.length - 1 && <span className={SYNTAX_COLORS.comma}>,</span>}
                </div>
              );
            })
          )}
        </div>
      );
    }

    if (typeof value === 'object' && value !== null) {
      return <span className={SYNTAX_COLORS.string}>{'{}'}</span>;
    }

    return (
      <div className="flex items-center group">
        <span className={SYNTAX_COLORS.string}>"{String(value)}"</span>
        {!readOnly && path !== 'Text' && (
          <button
            onClick={() => onRemoveAnnotation?.(path)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded ml-2
                     transition-opacity focus:opacity-100 focus:outline-none
                     focus:ring-1 focus:ring-red-500"
            aria-label="Remove annotation"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-300" />
          </button>
        )}
      </div>
    );
  };

  const renderField = (key, value, depth = 0, path = '') => {
    const currentPath = path ? `${path}.${key}` : key;
    const isExpanded = expandedPaths.has(currentPath);
    const isArgumentSection = currentPath === 'Arguments' || 
                            currentPath.startsWith('Arguments.') ||
                            key === 'Main Action';

    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value || {});

      let sortedEntries = entries;
      if (path === '') {
        sortedEntries = entries.sort((a, b) => 
          FIELD_ORDER.indexOf(a[0]) - FIELD_ORDER.indexOf(b[0]));
      } else if (path === 'Arguments') {
        sortedEntries = entries.sort((a, b) => 
          ARGUMENTS_ORDER.indexOf(a[0]) - ARGUMENTS_ORDER.indexOf(b[0]));
      } else if (path === 'Arguments.Object') {
        sortedEntries = entries.sort((a, b) => 
          OBJECT_FIELD_ORDER.indexOf(a[0]) - OBJECT_FIELD_ORDER.indexOf(b[0]));
      }

      return (
        <CollapsibleField
          key={key}
          label={key}
          isExpanded={isExpanded}
          onToggle={() => togglePath(currentPath)}
          isArgumentSection={isArgumentSection}
          depth={depth}
          isArray={Array.isArray(value)}
        >
          {sortedEntries.map(([k, v], index) => (
            <React.Fragment key={k}>
              {renderField(k, v, depth + 1, currentPath)}
              {index < entries.length - 1 && (
                <span className={SYNTAX_COLORS.comma}>,</span>
              )}
            </React.Fragment>
          ))}
        </CollapsibleField>
      );
    }

    return (
      <div key={key} className="flex items-center group py-0.5 font-mono">
        <span className={SYNTAX_COLORS.key}>{`${'  '.repeat(depth)}"${key}"`}</span>
        <span className={SYNTAX_COLORS.colon}>: </span>
        {renderValue(value, currentPath)}
      </div>
    );
  };

  const safeData = data && typeof data === 'object' ? data : {};
  
  if (!data || Object.keys(safeData).length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden border border-gray-800">
        <div className="bg-gray-800/50 px-4 py-3 flex justify-between items-center border-b border-gray-700">
          <h3 className="text-gray-100 font-medium tracking-wide">JSON Output</h3>
        </div>
        <div className="p-4 text-sm text-gray-400">
          No data available
        </div>
      </div>
    );
  }

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
          >
            <Download className="w-4 h-4 text-gray-400 hover:text-gray-300" />
          </button>
        )}
      </div>

      <div className="p-4 text-sm overflow-auto max-h-[calc(100vh-24rem)]
                     scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        <div className={SYNTAX_COLORS.bracket}>{'{'}</div>
        <div className="ml-4">
          {Object.entries(safeData)
            .sort((a, b) => FIELD_ORDER.indexOf(a[0]) - FIELD_ORDER.indexOf(b[0]))
            .map(([key, value], index, array) => (
              <React.Fragment key={key}>
                {renderField(key, value, 1)}
                {index < array.length - 1 && (
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