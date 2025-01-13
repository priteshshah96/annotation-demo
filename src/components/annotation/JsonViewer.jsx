import React, { useState, useEffect } from 'react';
import { Download, Trash2, ChevronRight, ChevronDown } from 'lucide-react';

const JsonViewer = ({ data, onDownload, onRemoveAnnotation }) => {
  // Initialize with all important paths expanded
  const [expandedPaths, setExpandedPaths] = useState(new Set([
    'Arguments', 
    'Arguments.Object',
    'Main Action',
    'Arguments.Agent',
    'Arguments.Context',
    'Arguments.Purpose',
    'Arguments.Method',
    'Arguments.Results',
    'Arguments.Analysis',
    'Arguments.Challenge',
    'Arguments.Ethical',
    'Arguments.Implications',
    'Arguments.Contradictions'
  ]));

  // Auto-expand paths with non-empty values
  useEffect(() => {
    const pathsToExpand = new Set([...expandedPaths]);
    
    const findPathsWithValues = (obj, currentPath = '') => {
      if (!obj) return;
      
      Object.entries(obj).forEach(([key, value]) => {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        
        if (value && typeof value === 'string' && value !== '') {
          pathsToExpand.add(newPath);
        } else if (typeof value === 'object' && value !== null) {
          pathsToExpand.add(newPath);
          findPathsWithValues(value, newPath);
        }
      });
    };

    findPathsWithValues(data);
    setExpandedPaths(pathsToExpand);
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

  const handleDelete = (path, e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (onRemoveAnnotation) {
      onRemoveAnnotation(path);
    }
  };

  const renderJsonField = (key, value, depth = 0, path = '') => {
    const indent = '  '.repeat(depth);
    const isObject = typeof value === 'object' && value !== null;
    const currentPath = path ? `${path}.${key}` : key;
    const isExpanded = expandedPaths.has(currentPath);

    if (isObject) {
      return (
        <div key={key} className="group">
          <div 
            className="flex items-center cursor-pointer hover:bg-gray-800 rounded px-1 py-0.5"
            onClick={() => togglePath(currentPath)}
          >
            <span className="text-gray-400 w-4">
              {isExpanded ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
            </span>
            <span className="text-yellow-400">{indent}"{key}"</span>
            <span className="text-white">: {Array.isArray(value) ? '[' : '{'}</span>
          </div>
          
          <div className={`ml-4 ${isExpanded ? 'block' : 'hidden'}`}>
            {Array.isArray(value) 
              ? value.map((item, index) => (
                  <div key={index} className="group">
                    {typeof item === 'object' 
                      ? renderJsonField(index, item, depth + 1, currentPath)
                      : (
                        <div className="flex items-center gap-2">
                          <span className="text-green-400">{indent}  "{item}"</span>
                          <button
                            onClick={(e) => handleDelete(`${currentPath}.${index}`, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 
                                     rounded transition-opacity"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      )}
                  </div>
                ))
              : Object.entries(value).map(([k, v], index) => (
                  <div key={k}>
                    {renderJsonField(k, v, depth + 1, currentPath)}
                  </div>
                ))
            }
          </div>
          
          <div className={isExpanded ? 'block' : 'hidden'}>
            <span className="text-white">{indent}{Array.isArray(value) ? ']' : '}'}</span>
          </div>
        </div>
      );
    }

    return (
      <div key={key} className="flex items-center group">
        <span className="text-yellow-400">{indent}"{key}"</span>
        <span className="text-white">: </span>
        <span className="text-green-400">
          {typeof value === 'string' ? `"${value}"` : JSON.stringify(value)}
        </span>
        {typeof value === 'string' && value !== '' && (
          <button
            onClick={(e) => handleDelete(currentPath, e)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded ml-2
                     transition-opacity"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden border border-gray-700">
      <div className="bg-gray-800 px-4 py-3 flex justify-between items-center border-b border-gray-700">
        <h3 className="text-white font-medium">JSON Output</h3>
        {onDownload && (
          <button
            onClick={onDownload}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Download JSON"
          >
            <Download className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        )}
      </div>

      <div className="p-4 font-mono text-sm overflow-auto max-h-[calc(100vh-24rem)]">
        <div className="text-white">{'{'}</div>
        <div className="ml-4">
          {Object.entries(data).map(([key, value], index) => (
            <React.Fragment key={key}>
              {renderJsonField(key, value, 1)}
            </React.Fragment>
          ))}
        </div>
        <div className="text-white">{'}'}</div>
      </div>
    </div>
  );
};

export default JsonViewer;