import React, { memo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const AbstractSection = ({ abstract, isOpen, onToggle }) => {
  if (!abstract) return null;

  return (
    <div className="w-full bg-white rounded-xl shadow-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 
                  transition-colors rounded-t-xl"
        aria-expanded={isOpen}
      >
        <h2 className="text-xl font-semibold text-gray-900">Abstract</h2>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      
      <div className={`transition-all duration-300 ${
        isOpen ? 'max-h-96 overflow-y-auto' : 'max-h-0 overflow-hidden'
      }`}>
        <div className="p-6 border-t border-gray-100">
          <p className="text-gray-700 whitespace-pre-wrap">{abstract}</p>
        </div>
      </div>
    </div>
  );
};

export default memo(AbstractSection);