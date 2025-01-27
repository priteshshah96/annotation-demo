import React, { useState, useCallback, useEffect } from 'react';
import { Download, Trash2, ChevronRight, ChevronDown } from 'lucide-react';

const FIELD_ORDER = [
  'Event Type',
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

const EVENT_TYPES = [
  'Background/Introduction',
  'Methods/Approach',
  'Results/Findings',
  'Conclusions/Implications'
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
  depth = 0,
  isArray = false 
}) => {
  const indent = '  '.repeat(depth);
  
  return (
    <div className="group font-mono">
      <div
        className="flex items-center py-0.5 hover:bg-gray-800/50 rounded px-2 -mx-2
                   focus-within:ring-1 focus-within:ring-blue-500 focus-within:outline-none
                   cursor-pointer"
        onClick={onToggle}
        role="button"
        tabIndex={0}
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
  const [expandedPaths, setExpandedPaths] = useState(new Set(['Arguments', 'Arguments.Object']));
  const [localData, setLocalData] = useState(data);

  // Update local data when prop changes and ensure immediate UI updates
  useEffect(() => {
    setLocalData(prevData => {
      if (!data) return prevData;
      
      // Find the event type from the EVENT_TYPES constant
      const eventType = EVENT_TYPES.find(type => type in data) || '';
      
      // Create new data object with processed Event Type
      const processedData = {
        'Event Type': eventType,
        'Text': data.Text || '',
        'Main Action': data['Main Action'] || '',
        'Arguments': data.Arguments || {},
        ...data.ArgumentPositions ? { ArgumentPositions: data.ArgumentPositions } : {}
      };
      
      return processedData;
    });
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

  const getAnnotationId = (path, index) => {
    let lookupPath = path;
    
    // Transform the path to match ArgumentPositions structure
    if (path === 'Main Action') {
      lookupPath = 'Main Action';
    } else if (path === 'Event Type') {
      lookupPath = 'Event Type';
    } else if (path.startsWith('Object.')) {
      lookupPath = `Arguments.Object.${path.slice(7)}`;
    } else if (!path.startsWith('Arguments.')) {
      lookupPath = `Arguments.${path}`;
    }

    return localData?.ArgumentPositions?.[lookupPath]?.[index]?.annotationId;
  };

  const handleRemoveAnnotation = useCallback(async (path, annotationId) => {
    try {
      // If trying to remove Event Type, convert to the actual field name
      const actualPath = path === 'Event Type' ? 
        EVENT_TYPES.find(type => type === localData[path]) || path : 
        path;
        
      // Call parent handler and wait for it to complete
      await onRemoveAnnotation?.(actualPath, annotationId);

      // Update local state after successful deletion
      setLocalData(prevData => {
        const newData = { ...prevData };
        
        // Handle deletion based on path
        if (path === 'Event Type') {
          delete newData['Event Type'];
          if (newData.ArgumentPositions?.['Event Type']) {
            delete newData.ArgumentPositions['Event Type'];
          }
        } else if (path === 'Main Action') {
          delete newData['Main Action'];
          if (newData.ArgumentPositions?.['Main Action']) {
            delete newData.ArgumentPositions['Main Action'];
          }
        } else {
          // Handle nested paths in Arguments
          const pathParts = path.split('.');
          let current = newData;
          
          for (let i = 0; i < pathParts.length - 1; i++) {
            if (!current[pathParts[i]]) break;
            current = current[pathParts[i]];
          }

          const lastPath = pathParts[pathParts.length - 1];
          const fullPath = path.startsWith('Object.') ? 
            `Arguments.Object.${path.slice(7)}` : 
            path.startsWith('Arguments.') ? path : `Arguments.${path}`;

          // Remove from Arguments structure
          if (Array.isArray(current[lastPath])) {
            const index = newData.ArgumentPositions[fullPath]
              ?.findIndex(pos => pos.annotationId === annotationId) ?? -1;
            
            if (index > -1) {
              current[lastPath].splice(index, 1);
              if (current[lastPath].length === 0) {
                delete current[lastPath];
              }
            }
          } else {
            delete current[lastPath];
          }

          // Remove from ArgumentPositions
          if (newData.ArgumentPositions?.[fullPath]) {
            newData.ArgumentPositions[fullPath] = newData.ArgumentPositions[fullPath]
              .filter(pos => pos.annotationId !== annotationId);
            if (newData.ArgumentPositions[fullPath].length === 0) {
              delete newData.ArgumentPositions[fullPath];
            }
          }
        }

        return newData;
      });
    } catch (error) {
      console.error('Error removing annotation:', error);
    }
  }, [onRemoveAnnotation]);

  const renderValue = (value, path) => {
    // For arrays of annotations
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-col">
          {value.map((item, itemIndex) => {
            const displayText = typeof item === 'object' ? item?.text || String(item) : String(item);
            const annotationId = getAnnotationId(path, itemIndex);
            const shouldShowTrash = !readOnly && path !== 'Text' && annotationId;

            return (
              <div key={itemIndex} className="flex items-center group py-0.5">
                <span className={SYNTAX_COLORS.string}>"{displayText}"</span>
                {shouldShowTrash && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveAnnotation(path, annotationId);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded ml-2
                             transition-opacity focus:opacity-100 focus:outline-none
                             focus:ring-1 focus:ring-red-500"
                    aria-label="Remove annotation"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-300" />
                  </button>
                )}
                {itemIndex < value.length - 1 && <span className={SYNTAX_COLORS.comma}>,</span>}
              </div>
            );
          })}
        </div>
      );
    }

    // For single values
    const displayValue = value === null || value === undefined ? '' : String(value);
    const annotationId = getAnnotationId(path, 0);
    const shouldShowTrash = !readOnly && path !== 'Text' && annotationId;

    return (
      <div className="flex items-center group">
        <span className={SYNTAX_COLORS.string}>"{displayValue}"</span>
        {shouldShowTrash && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRemoveAnnotation(path, annotationId);
            }}
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

  const renderArgumentField = (key, value, depth) => {
    // Handle Object arguments specially
    if (key === 'Object') {
      const isExpanded = expandedPaths.has(`Arguments.Object`);
      
      return (
        <CollapsibleField
          key={key}
          label={key}
          isExpanded={isExpanded}
          onToggle={() => togglePath(`Arguments.Object`)}
          depth={depth}
          isArray={false}
        >
          {OBJECT_FIELD_ORDER.map((objKey, index) => (
            <React.Fragment key={objKey}>
              <div className="flex items-center group py-0.5 font-mono">
                <span className={SYNTAX_COLORS.key}>{`${'  '.repeat(depth + 1)}"${objKey}"`}</span>
                <span className={SYNTAX_COLORS.colon}>: </span>
                {renderValue(value[objKey] || '', `Object.${objKey}`)}
              </div>
              {index < OBJECT_FIELD_ORDER.length - 1 && <span className={SYNTAX_COLORS.comma}>,</span>}
            </React.Fragment>
          ))}
        </CollapsibleField>
      );
    }

    // Regular arguments
    return (
      <div key={key} className="flex items-center group py-0.5 font-mono">
        <span className={SYNTAX_COLORS.key}>{`${'  '.repeat(depth)}"${key}"`}</span>
        <span className={SYNTAX_COLORS.colon}>: </span>
        {renderValue(value || '', key)}
      </div>
    );
  };

  const renderField = (key, value, depth = 0) => {
    if (key === 'Arguments') {
      const isExpanded = expandedPaths.has('Arguments');
      
      return (
        <CollapsibleField
          key={key}
          label={key}
          isExpanded={isExpanded}
          onToggle={() => togglePath('Arguments')}
          depth={depth}
          isArray={false}
        >
          {ARGUMENTS_ORDER.map((argKey, index) => (
            <React.Fragment key={argKey}>
              {renderArgumentField(argKey, value[argKey] || '', depth + 1)}
              {index < ARGUMENTS_ORDER.length - 1 && <span className={SYNTAX_COLORS.comma}>,</span>}
            </React.Fragment>
          ))}
        </CollapsibleField>
      );
    }

    // Regular fields
    return (
      <div key={key} className="flex items-center group py-0.5 font-mono">
        <span className={SYNTAX_COLORS.key}>{`${'  '.repeat(depth)}"${key}"`}</span>
        <span className={SYNTAX_COLORS.colon}>: </span>
        {renderValue(value || '', key)}
      </div>
    );
  };

  if (!localData || Object.keys(localData).length === 0) {
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

      <div className="p-4 text-sm overflow-auto max-h-[calc(100vh-24rem)]">
        <div className={SYNTAX_COLORS.bracket}>{'{'}</div>
        <div className="ml-4">
          {Object.entries(localData)
            .filter(([key]) => FIELD_ORDER.includes(key))
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