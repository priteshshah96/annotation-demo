import React, { useState, useEffect, useCallback } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import _ from 'lodash';
import Toast from './Toast';

const STATUS = {
  IDLE: 'idle',
  SAVING: 'saving',
  SAVED: 'saved',
  ERROR: 'error'
};

const SummaryInput = ({ 
  value, 
  onChange,
  onDelete,
  eventType,
  disabled = false,
  maxLength = 100,
  placeholder
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState(null);
  const [previousValue, setPreviousValue] = useState(value);
  const [toast, setToast] = useState(null);
  
  const showToast = (message, type) => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };
  
  const debouncedSave = useCallback(
    _.debounce(async (newValue) => {
      if (!eventType || !onChange) return;
      if (newValue === value) return;

      setStatus(STATUS.SAVING);
      setError(null);

      try {
        await onChange(newValue);
        setStatus(STATUS.SAVED);
        setTimeout(() => setStatus(STATUS.IDLE), 2000);
        
        if (!previousValue) {
          showToast(`${eventType} summary added`, 'success');
        } else {
          showToast(`${eventType} summary updated`, 'success');
        }
        setPreviousValue(newValue);
      } catch (err) {
        console.error('Save error:', err);
        setError(err.message || 'Failed to save summary');
        setStatus(STATUS.ERROR);
        showToast(`Failed to save ${eventType} summary`, 'error');
        setTimeout(() => {
          setStatus(STATUS.IDLE);
          setError(null);
        }, 3000);
      }
    }, 1000),
    [onChange, value, eventType, previousValue]
  );

  useEffect(() => {
    setInputValue(value || '');
    setPreviousValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const handleClear = async () => {
    if (!onDelete || !eventType) return;

    try {
      // Cancel any pending saves
      debouncedSave.cancel();
      
      setStatus(STATUS.SAVING);
      await onDelete();
      
      // Clear states
      setInputValue('');
      setPreviousValue('');
      
      setStatus(STATUS.SAVED);
      showToast(`${eventType} summary deleted`, 'success');
      setTimeout(() => setStatus(STATUS.IDLE), 2000);
    } catch (err) {
      console.error('Clear error:', err);
      setError('Failed to clear summary');
      setStatus(STATUS.ERROR);
      showToast(`Failed to delete ${eventType} summary`, 'error');
      setTimeout(() => {
        setStatus(STATUS.IDLE);
        setError(null);
      }, 3000);
    }
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // If empty value, cancel debounced save and trigger delete
    if (!newValue.trim() && onDelete) {
      debouncedSave.cancel();
      handleClear();
      return;
    }

    if (eventType) {
      debouncedSave(newValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (eventType) {
        debouncedSave.flush();
      }
    }
  };

  return (
    <div 
      className="space-y-2"
      role="form"
      aria-label={`${eventType || 'Event'} summary input`}
    >
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}

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
          className="w-full p-3 border border-gray-300 rounded-lg min-h-[5rem]
                    resize-none text-sm focus:ring-2 focus:ring-blue-500 
                    focus:border-transparent transition-all disabled:bg-gray-50
                    disabled:text-gray-500 disabled:cursor-not-allowed
                    pr-16"
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
          className="text-sm text-gray-500"
        >
          {eventType ? 
            'Press Enter to save immediately, or wait for auto-save after typing.' :
            'Please select an event type to add a summary.'}
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