import React, { useState, useCallback, useEffect } from 'react';
import { Download, Trash2, ChevronRight, ChevronDown } from 'lucide-react';

const FIELD_ORDER = [
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
  fullFileData = null,
  onRemoveAnnotation,
  readOnly = false 
}) => {
  const [expandedPaths, setExpandedPaths] = useState(new Set(['Arguments', 'Arguments.Object']));
  const [localData, setLocalData] = useState(data);

  const handleDownload = () => {
    try {
      if (!fullFileData?.papers) {
        console.error('No file data available for download');
        return;
      }

      // Create clean version matching input format exactly
      const downloadData = {
        papers: fullFileData.papers.map(paper => ({
          paper_code: paper.paper_code || '',
          abstract: paper.abstract || '',
          events: paper.events.map(event => {
            // Find active event type
            const activeEventType = EVENT_TYPES.find(type => event[type] !== undefined && event[type] !== '');
            
            // Create base data structure
            const baseData = {
              Text: event.Text || '',
              'Main Action': event['Main Action'] || null,
              Arguments: {
                Agent: event.Arguments?.Agent || [],
                Object: {
                  'Base Object': event.Arguments?.Object?.['Base Object'] || [],
                  'Base Modifier': event.Arguments?.Object?.['Base Modifier'] || [],
                  'Attached Object': event.Arguments?.Object?.['Attached Object'] || [],
                  'Attached Modifier': event.Arguments?.Object?.['Attached Modifier'] || []
                },
                Context: event.Arguments?.Context || [],
                Purpose: event.Arguments?.Purpose || [],
                Method: event.Arguments?.Method || [],
                Results: event.Arguments?.Results || [],
                Analysis: event.Arguments?.Analysis || [],
                Challenge: event.Arguments?.Challenge || [],
                Ethical: event.Arguments?.Ethical || [],
                Implications: event.Arguments?.Implications || [],
                Contradictions: event.Arguments?.Contradictions || []
              }
            };

            // Add active event type if it exists
            if (activeEventType) {
              baseData[activeEventType] = event[activeEventType];
            }

            return baseData;
          })
        }))
      };

      // Convert to JSON string with nice formatting
      const jsonString = JSON.stringify(downloadData, null, 2);
      
      // Create blob and download link
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // Use paper_code for filename
      const paperCode = fullFileData.papers[0]?.paper_code || 'unknown';
      const filename = `${paperCode}_annotated.json`;
      
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading JSON:', error);
    }
  };

  // Update local data and fullFileData when props change
  useEffect(() => {
    setLocalData(prevData => {
      if (!data) return prevData;
      
      // Find the active event type and its value
      const activeEventType = EVENT_TYPES.find(type => type in data && data[type] !== '');
      
      // Create new data object with simplified structure
      const processedData = {
        // Keep event type with empty string if it exists in data
        ...EVENT_TYPES.reduce((acc, type) => {
          if (type in data) {
            acc[type] = data[type] || '';
          }
          return acc;
        }, {}),
        'Text': data.Text || '',
        'Main Action': data['Main Action'] || '',
        'Arguments': data.Arguments || {}
      };
      
      // Also update the fullFileData if it exists
      if (fullFileData?.papers) {
        const currentPaper = fullFileData.papers[0];
        if (currentPaper) {
          const eventIndex = currentPaper.events.findIndex(event => 
            event.Text === data.Text
          );
          if (eventIndex !== -1) {
            currentPaper.events[eventIndex] = {
              ...currentPaper.events[eventIndex],
              ...processedData
            };
          }
        }
      }
      
      return processedData;
    });
  }, [data, fullFileData]);

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
    
    if (path === 'Main Action') {
      lookupPath = 'Main Action';
    } else if (EVENT_TYPES.includes(path)) {
      lookupPath = path;
    } else if (path.startsWith('Object.')) {
      lookupPath = `Arguments.Object.${path.slice(7)}`;
    } else if (!path.startsWith('Arguments.')) {
      lookupPath = `Arguments.${path}`;
    }

    return data?.ArgumentPositions?.[lookupPath]?.[index]?.annotationId;
  };

  const handleRemoveAnnotation = useCallback(async (path, annotationId) => {
    try {
      await onRemoveAnnotation?.(path, annotationId);

      setLocalData(prevData => {
        const newData = { ...prevData };
        
        if (EVENT_TYPES.includes(path)) {
          delete newData[path];
        } else if (path === 'Main Action') {
          newData['Main Action'] = null;
        } else {
          const pathParts = path.split('.');
          let current = newData;
          
          for (let i = 0; i < pathParts.length - 1; i++) {
            if (!current[pathParts[i]]) break;
            current = current[pathParts[i]];
          }

          const lastPath = pathParts[pathParts.length - 1];
          if (Array.isArray(current[lastPath])) {
            const fullPath = path.startsWith('Object.') ? 
              `Arguments.Object.${path.slice(7)}` : 
              path.startsWith('Arguments.') ? path : `Arguments.${path}`;
              
            const index = data?.ArgumentPositions?.[fullPath]
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
        }

        return newData;
      });
    } catch (error) {
      console.error('Error removing annotation:', error);
    }
  }, [onRemoveAnnotation, data?.ArgumentPositions]);

  const renderValue = (value, path) => {
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
              {index < ARGUMENTS_ORDER.length - 1
              && <span className={SYNTAX_COLORS.comma}>,</span>}
              </React.Fragment>
            ))}
          </CollapsibleField>
        );
      }
  
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
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Download complete annotations"
          >
            <Download className="w-4 h-4 text-gray-400 hover:text-gray-300" />
          </button>
        </div>
  
        <div className="p-4 text-sm overflow-auto max-h-[calc(100vh-24rem)]">
          <div className={SYNTAX_COLORS.bracket}>{'{'}</div>
          <div className="ml-4">
            {Object.entries(localData)
              .sort((a, b) => {
                // Custom sort to ensure event type appears first
                if (EVENT_TYPES.includes(a[0])) return -1;
                if (EVENT_TYPES.includes(b[0])) return 1;
                return FIELD_ORDER.indexOf(a[0]) - FIELD_ORDER.indexOf(b[0]);
              })
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