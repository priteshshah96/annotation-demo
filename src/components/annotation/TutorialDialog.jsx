import React from 'react';
import { X } from 'lucide-react';

const TutorialDialog = ({ isOpen, onClose }) => {
  const videoUrl = '/video/tutorial.mp4'; // Default video path from public folder
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[1024px] mx-4 p-6 max-h-[90vh] overflow-y-auto mb-10">
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

        {/* Video Section */}
        <div className="mb-6">
          <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
          <video 
              className="w-full h-full"
              controls
              controlsList="nodownload"
              preload="auto"
              poster="/api/placeholder/800/450"
              playsInline
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Watch the tutorial video above to see the annotation process in action.
          </p>
        </div>

        {/* Written Instructions - Made more compact */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <h3 className="font-semibold text-base mb-1">1. Main Action First</h3>
              <p className="text-sm text-gray-600">
                Always annotate the Main Action first. Other annotation buttons will be disabled 
                until you've identified the main action.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4 py-2">
              <h3 className="font-semibold text-base mb-1">2. Text Selection</h3>
              <p className="text-sm text-gray-600">
                Select text by clicking and dragging. Use the annotation buttons or keyboard 
                shortcuts to assign categories.
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4 py-2">
              <h3 className="font-semibold text-base mb-1">3. Multiple Spans</h3>
              <p className="text-sm text-gray-600">
                You can annotate multiple text spans for the same category. Each selection
                adds to existing annotations.
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div className="border-l-4 border-purple-500 pl-4 py-2">
              <h3 className="font-semibold text-base mb-1">4. Keyboard Shortcuts</h3>
              <p className="text-sm text-gray-600">
                • Numbers 1-9 for main categories
                <br />• Letters for additional categories (shown on buttons)
              </p>
            </div>

            <div className="border-l-4 border-rose-500 pl-4 py-2">
              <h3 className="font-semibold text-base mb-1">5. Completing Work</h3>
              <p className="text-sm text-gray-600">
                Navigate using Previous/Next buttons. On the last event, use the Finish 
                button to download your annotations.
              </p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">
                For detailed guidelines, click the (i) icon to view the complete documentation.
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