import React, { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const AnnotationFooter = ({
  onPrevious,
  onNext,
  isFirstField,
  isLastField,
  isCompleting,
  isOnline
}) => (
  <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg py-4">
    <div className="max-w-7xl mx-auto flex justify-center gap-4">
      <button
        onClick={onPrevious}
        disabled={isFirstField || isCompleting}
        className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 
                 disabled:opacity-50 flex items-center gap-2"
      >
        <ChevronLeft className="w-5 h-5" />
        Previous
      </button>
      
      <button
        onClick={onNext}
        disabled={isCompleting || !isOnline}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                 disabled:opacity-50 flex items-center gap-2"
      >
        {isCompleting ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white" />
            <span>Saving...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isLastField ? 'Complete and Return' : 'Next'}
            <ChevronRight className="w-5 h-5" />
          </div>
        )}
      </button>
    </div>
  </footer>
);

export default memo(AnnotationFooter);