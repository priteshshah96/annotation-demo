import React, { useState, useEffect, useCallback } from 'react';
import { Check, Loader2 } from 'lucide-react';
import _ from 'lodash';

const STATUS = {
  IDLE: 'idle',
  SAVING: 'saving',
  SAVED: 'saved',
  ERROR: 'error'
};

const SummaryInput = ({ 
  value, 
  onChange, 
  eventType,
  disabled = false,
  maxLength = 100,
  placeholder = "Add a brief summary..."
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState(null);
  
  // Create a debounced save function
  const debouncedSave = useCallback(
    _.debounce((newValue) => {
      if (newValue !== value) {
        setStatus(STATUS.SAVING);
        setError(null);

        Promise.resolve(onChange(newValue))
          .then(() => {
            setStatus(STATUS.SAVED);
            // Reset status after 2 seconds
            setTimeout(() => setStatus(STATUS.IDLE), 2000);
          })
          .catch((err) => {
            setError(err.message || 'Failed to save summary');
            setStatus(STATUS.ERROR);
            // Reset error after 3 seconds
            setTimeout(() => {
              setStatus(STATUS.IDLE);
              setError(null);
            }, 3000);
          });
      }
    }, 1000), // Wait 1 second after last keystroke before saving
    [onChange, value]
  );

  // Update local input value when prop changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    debouncedSave(newValue);
  };

  const handleKeyDown = (e) => {
    // Save immediately on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      debouncedSave.flush();
    }
  };

  return (
    <div 
      className="space-y-2"
      role="form"
      aria-label={`${eventType} summary input`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {eventType} Summary
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
      
      <div className="relative">
        <textarea
          className="w-full p-3 border border-gray-300 rounded-lg min-h-[5rem]
                   resize-none text-sm focus:ring-2 focus:ring-blue-500 
                   focus:border-transparent transition-all disabled:bg-gray-50
                   disabled:text-gray-500 disabled:cursor-not-allowed"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          disabled={disabled}
          rows={3}
          aria-label={`${eventType} summary text`}
          aria-describedby="summary-help-text"
        />
        <div 
          className="absolute bottom-2 right-2 text-xs text-gray-400"
          aria-hidden="true"
        >
          {inputValue.length}/{maxLength}
        </div>
      </div>
      
      <p 
        id="summary-help-text"
        className="text-sm text-gray-500"
      >
        Press Enter to save immediately, or wait for auto-save after typing.
      </p>
    </div>
  );
};

export default SummaryInput;