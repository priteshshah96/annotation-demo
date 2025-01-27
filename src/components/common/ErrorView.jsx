// components/common/ErrorView.jsx
import React, { memo } from 'react';
import { X, ChevronRight } from 'lucide-react';

const ErrorView = ({ error, onBack }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <X className="w-8 h-8 text-red-500" />
        <h2 className="text-red-600 text-xl font-bold">Error Occurred</h2>
      </div>
      <p className="text-gray-700 mb-6">{error}</p>
      <button
        onClick={onBack}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 
                 transition-colors duration-200 flex items-center justify-center gap-2"
      >
        <span>Try Again</span>
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  </div>
);

export default memo(ErrorView);