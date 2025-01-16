import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-red-100 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 min-w-[300px]">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
        <p className="text-sm flex-1">{message}</p>
        <button
          onClick={onClose}
          className="text-red-700 hover:text-red-900 transition-colors"
          aria-label="Close notification"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Toast;