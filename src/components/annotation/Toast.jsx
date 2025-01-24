import React, { useEffect } from 'react';
import { AlertCircle, X, CheckCircle } from 'lucide-react';

const Toast = ({ message, onClose, type = 'error' }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-100' : 'bg-red-100';
  const borderColor = type === 'success' ? 'border-green-200' : 'border-red-200';
  const textColor = type === 'success' ? 'text-green-800' : 'text-red-800';
  const iconColor = type === 'success' ? 'text-green-600' : 'text-red-600';
  const Icon = type === 'success' ? CheckCircle : AlertCircle;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className={`${bgColor} border ${borderColor} ${textColor} px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 min-w-[300px]`}>
        <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0`} />
        <p className="text-sm flex-1">{message}</p>
        <button
          onClick={onClose}
          className={`${textColor} hover:${textColor.replace('800', '900')} transition-colors`}
          aria-label="Close notification"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Toast;