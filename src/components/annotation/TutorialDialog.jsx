import React from 'react';
import { X } from 'lucide-react';

const TutorialDialog = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[800px] mx-4 p-6 max-h-[80vh] overflow-y-auto mb-20">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">How to Use the Annotation Tool</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close tutorial"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Made more compact */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <h3 className="font-semibold text-base mb-1">1. Main Action First</h3>
              <p className="text-sm text-gray-600">
                Always annotate the Main Action first. Other annotation types will be disabled 
                until you've identified the main action.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4 py-2">
              <h3 className="font-semibold text-base mb-1">2. Text Selection</h3>
              <p className="text-sm text-gray-600">
                Select text by clicking and dragging. Use the keyboard shortcuts or buttons 
                to assign annotation types. Multiple selections per type are supported.
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4 py-2">
              <h3 className="font-semibold text-base mb-1">3. Keyboard Shortcuts</h3>
              <p className="text-sm text-gray-600">
                Use number keys (1-9) for main categories and letter keys for additional types 
                (shown on buttons). Press ESC to clear selection.
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div className="border-l-4 border-purple-500 pl-4 py-2">
              <h3 className="font-semibold text-base mb-1">4. Object Annotations</h3>
              <p className="text-sm text-gray-600">
                Use the Object button to access Base Object, Base Modifier, 
                Attached Object, and Attached Modifier annotations.
              </p>
            </div>

            <div className="border-l-4 border-rose-500 pl-4 py-2">
              <h3 className="font-semibold text-base mb-1">5. Summarization</h3>
              <p className="text-sm text-gray-600">
                Add brief summaries for each event. Summaries save automatically after typing 
                stops, or press Enter to save immediately.
              </p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">
                Your annotations are saved automatically. You can always revisit and 
                edit them later.
              </p>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 
                     transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialDialog;