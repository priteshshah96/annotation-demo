import React, { useState, useEffect } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import Toast from './Toast';

const STATUS = {
  IDLE: 'idle',
  SAVING: 'saving',
  SAVED: 'saved',
  ERROR: 'error',
  UNSAVED: 'unsaved'  // New status for unsaved changes
};

const SummaryInput = ({ 
  value, 
  onChange,
  onDelete,
  eventType,
  disabled = false,
  maxLength = 100,
  onStatusChange,
  placeholder
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState(null);
  const [previousValue, setPreviousValue] = useState(value);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [showSuccessFlash, setShowSuccessFlash] = useState(false);

  const handleSave = async (newValue) => {
    if (!eventType || !onChange) return;
    if (newValue === value) {
      setHasUnsavedChanges(false);
      return;
    }

    setStatus(STATUS.SAVING);
    setError(null);

    try {
      await onChange(newValue);
      setStatus(STATUS.SAVED);
      setHasUnsavedChanges(false);
      setShowSuccessFlash(true);  // Show green flash
      setTimeout(() => {
        setShowSuccessFlash(false);
        setStatus(STATUS.IDLE);
      }, 1000);  // Remove flash after 1 second
      
      // Status is handled by parent component
      setPreviousValue(newValue);
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save summary');
      setStatus(STATUS.ERROR);
      // Error handling by parent component
      setTimeout(() => {
        setStatus(STATUS.IDLE);
        setError(null);
      }, 3000);
    }
  };

  useEffect(() => {
    setInputValue(value || '');
    setPreviousValue(value);
    setHasUnsavedChanges(false);
  }, [value]);

    // When status changes, notify parent
    useEffect(() => {
      onStatusChange?.(status);
    }, [status, onStatusChange]);

  const handleClear = async () => {
    if (!onDelete || !eventType) return;

    try {
      setStatus(STATUS.SAVING);
      await onDelete();
      
      // Clear states
      setInputValue('');
      setPreviousValue('');
      setHasUnsavedChanges(false);
      
      // Show success flash
      setShowSuccessFlash(true);
      setTimeout(() => {
        setShowSuccessFlash(false);
        setStatus(STATUS.IDLE);
      }, 1000);
    } catch (err) {
      console.error('Clear error:', err);
      setError('Failed to clear summary');
      setStatus(STATUS.ERROR);
      // Error handling by parent component
      setTimeout(() => {
        setStatus(STATUS.IDLE);
        setError(null);
      }, 3000);
    }
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // If the value is different from the saved value, show unsaved changes
    if (newValue !== value) {
      setStatus(STATUS.UNSAVED);
      setHasUnsavedChanges(true);
    }
    
    // If empty value, trigger clear but don't show empty notification
    if (!newValue.trim() && onDelete) {
      handleClear();
      return;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (eventType) {
        handleSave(inputValue);
      }
    }
  };

  return (
    <div 
      className="space-y-2"
      role="form"
      aria-label={`${eventType || 'Event'} summary input`}
    >


      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {eventType ? `${eventType} Summary` : 'Summary'}
        </h3>
        <div 
          className="flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          {status === STATUS.SAVING && (
            <div className="flex items-center text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden="true" />
              <span>Saving...</span>
            </div>
          )}
          {status === STATUS.SAVED && (
            <div className="flex items-center text-green-600 text-sm">
              <Check className="w-4 h-4 mr-1" aria-hidden="true" />
              <span>Saved</span>
            </div>
          )}
          {status === STATUS.ERROR && error && (
            <div className="text-red-600 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
      
      <div className="relative mb-2">
        <textarea
          className={`w-full p-3 border-2 rounded-lg min-h-[5rem]
                    resize-none text-base
                    transition-all duration-300 ease-in-out
                    disabled:bg-gray-50 disabled:text-gray-500 
                    disabled:cursor-not-allowed pr-16
                    focus:outline-none
                    ${hasUnsavedChanges 
                      ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] text-gray-700 bg-red-50/30' 
                      : showSuccessFlash
                        ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] text-gray-700 bg-green-50/30'
                        : 'border-gray-300 hover:border-gray-400 focus:border-blue-400 focus:shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                    }`}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          disabled={disabled || !eventType}
          rows={3}
          aria-label={`${eventType || 'Event'} summary text`}
          aria-describedby="summary-help-text"
        />
        <div className="absolute top-3 right-3">
          <span className="text-xs text-gray-400" aria-hidden="true">
            {inputValue.length}/{maxLength}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p 
          id="summary-help-text"
          className={`text-sm font-medium transition-all duration-300 ${
            hasUnsavedChanges 
              ? 'text-red-500' 
              : showSuccessFlash
                ? 'text-green-500'
                : 'text-gray-500'
          }`}
        >
          {eventType 
            ? (hasUnsavedChanges 
                ? 'Press Enter to save'
                : showSuccessFlash
                  ? 'Changes saved!'
                  : 'Edit text and press Enter to save')
            : 'Please select an event type to add a summary.'}
        </p>
        
        {inputValue && !disabled && eventType && (
          <button
            onClick={handleClear}
            className="flex items-center px-2 py-1 text-sm text-red-600 hover:text-red-700
                      hover:bg-red-50 rounded transition-colors focus:outline-none 
                      focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
            title="Clear summary"
            type="button"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default SummaryInput;
