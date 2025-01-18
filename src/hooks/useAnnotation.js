import { useState, useCallback, useEffect, useRef } from 'react';
import { annotationApi } from '../services/annotationApi';
import { AnnotationTypes } from '../models/Annotation';

// Simple cache implementation with TTL
class FileCache {
  constructor(ttl = 1000 * 60 * 30) { // 30 minutes TTL
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache.set(key, {
      value: JSON.parse(JSON.stringify(value)), // Deep clone to prevent mutations
      timestamp: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return JSON.parse(JSON.stringify(item.value)); // Return deep clone
  }

  // Add method to update specific event in cache
  updateEvent(fileId, paperIndex, eventIndex, updatedEvent) {
    const cachedFile = this.get(fileId);
    if (!cachedFile) return false;

    const paper = cachedFile.papers[paperIndex];
    if (!paper || !paper.events[eventIndex]) return false;

    paper.events[eventIndex] = updatedEvent;
    this.set(fileId, cachedFile);
    return true;
  }

  // Add method to invalidate cache for specific file
  invalidate(fileId) {
    this.cache.delete(fileId);
  }

  // Add method to clear entire cache
  clear() {
    this.cache.clear();
  }
}

const fileCache = new FileCache();

// Local storage wrapper with error handling
const safeStorage = {
  get: (key) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Storage read error: ${key}`, error);
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Storage write error: ${key}`, error);
      return false;
    }
  }
};

function useAnnotation(fileId, navigate, userId) {
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  // State management
  const [state, setState] = useState({
    currentPosition: {
      paperIndex: 0,
      eventIndex: 0
    },
    fileData: fileCache.get(fileId) || null,
    loading: !fileCache.get(fileId),
    error: null,
    saving: false
  });

  // Safe state updates for async operations
  const safeSetState = useCallback((updater) => {
    if (!mountedRef.current) return;
    setState(prev => {
      const newState = typeof updater === 'function' ? updater(prev) : updater;
      return JSON.stringify(prev) === JSON.stringify(newState) ? prev : newState;
    });
  }, []);

  // Handle annotation saves
  const handleAnnotationSave = useCallback(async (field, answer, options = {}) => {
    if (!mountedRef.current) return;
  
    const { indices = null, isDelete = false } = options;
    const { paperIndex, eventIndex } = indices || state.currentPosition;
  
    if (!field || typeof field !== 'string') {
      throw new Error('Invalid fieldPath. Please provide a valid annotation type.');
    }
  
    try {
      safeSetState((prev) => ({ ...prev, saving: true }));
  
      const payload = {
        fileId,
        paperIndex: Number(paperIndex),
        eventIndex: Number(eventIndex),
        fieldPath: field,
        answer,
        isDelete,
      };

      // Make API call first
      const result = await annotationApi.saveAnnotation(payload);
      
      if (!result) throw new Error('Failed to save annotation');
  
      // If successful, update local state
      safeSetState((prev) => {
        const updatedFileData = JSON.parse(JSON.stringify(prev.fileData));
        const event = updatedFileData.papers?.[paperIndex]?.events?.[eventIndex];
        
        if (!event) {
          console.error('Invalid fileData structure:', prev.fileData);
          return prev;
        }
  
        if (field === 'Main Action') {
          event['Main Action'] = answer || '';
        } else if (field.startsWith('Arguments.')) {
          const path = field.split('.');
          let target = event.Arguments || {};
          
          // Ensure Arguments object exists
          if (!event.Arguments) {
            event.Arguments = {};
          }
          
          // Navigate to the correct nested location
          for (let i = 1; i < path.length - 1; i++) {
            if (!target[path[i]]) {
              target[path[i]] = {};
            }
            target = target[path[i]];
          }
          
          // Handle deletion
          if (isDelete) {
            if (path.length === 2) {
              target[path[1]] = [];
            } else {
              target[path[path.length - 1]] = [];
            }
          } else {
            // Handle array answers
            if (Array.isArray(answer)) {
              if (path.length === 2) {
                target[path[1]] = answer;
              } else {
                target[path[path.length - 1]] = answer;
              }
            } else {
              target[path[path.length - 1]] = [];
            }
          }
        } else if (AnnotationTypes.EVENT_TYPE.includes(field)) {
          event[field] = answer || '';
        }

        // Update cache with the new event data
        fileCache.updateEvent(fileId, paperIndex, eventIndex, event);
  
        return {
          ...prev,
          fileData: updatedFileData,
        };
      });
  
      return result;
    } catch (error) {
      console.error('Annotation save error:', error);
      // Invalidate cache on error to force fresh data on next load
      fileCache.invalidate(fileId);
      throw error;
    } finally {
      safeSetState((prev) => ({ ...prev, saving: false }));
    }
  }, [fileId, state.currentPosition, safeSetState]);
  
  // Navigation helpers
  const moveNext = useCallback(() => {
    if (!state.fileData?.papers) return;

    safeSetState(prev => {
      const { currentPosition, fileData } = prev;
      const { paperIndex, eventIndex } = currentPosition;
      const currentPaper = fileData.papers[paperIndex];

      if (eventIndex < currentPaper.events.length - 1) {
        return {
          ...prev,
          currentPosition: {
            ...currentPosition,
            eventIndex: eventIndex + 1
          }
        };
      }

      if (paperIndex < fileData.papers.length - 1) {
        return {
          ...prev,
          currentPosition: {
            paperIndex: paperIndex + 1,
            eventIndex: 0
          }
        };
      }

      return prev;
    });
  }, [state.fileData, safeSetState]);

  const movePrevious = useCallback(() => {
    if (!state.fileData?.papers) return;

    safeSetState(prev => {
      const { currentPosition, fileData } = prev;
      const { paperIndex, eventIndex } = currentPosition;

      if (eventIndex > 0) {
        return {
          ...prev,
          currentPosition: {
            ...currentPosition,
            eventIndex: eventIndex - 1
          }
        };
      }

      if (paperIndex > 0) {
        const prevPaper = fileData.papers[paperIndex - 1];
        return {
          ...prev,
          currentPosition: {
            paperIndex: paperIndex - 1,
            eventIndex: prevPaper.events.length - 1
          }
        };
      }

      return prev;
    });
  }, [state.fileData, safeSetState]);

  // Load file data
  const loadFileData = useCallback(async () => {
    if (!fileId || loadingRef.current || !mountedRef.current || !userId) return;
  
    try {
      loadingRef.current = true;
      safeSetState(prev => ({ ...prev, loading: true, error: null }));
  
      let data = fileCache.get(fileId);
  
      if (!data) {
        const response = await annotationApi.getFileWithAnnotations(fileId);
        data = {
          papers: response.papers,
          metadata: response.metadata
        };
  
        if (data?.papers) {
          fileCache.set(fileId, data);
        }
      }
  
      if (!mountedRef.current) return;
      if (!data?.papers) {
        throw new Error('Invalid file data received');
      }
  
      const lastPosition = safeStorage.get(`last-position-${fileId}`);
  
      safeSetState(prev => ({
        ...prev,
        fileData: data,
        currentPosition: lastPosition || { paperIndex: 0, eventIndex: 0 },
        loading: false,
        error: null
      }));
    } catch (error) {
      fileCache.invalidate(fileId);
      if (mountedRef.current) {
        safeSetState(prev => ({
          ...prev,
          loading: false,
          error: error.message || 'Failed to load file data'
        }));
      }
    } finally {
      loadingRef.current = false;
    }
  }, [fileId, userId, safeSetState]);

  // Position helpers
  const isFirstField = useCallback(() => {
    const { paperIndex, eventIndex } = state.currentPosition;
    return paperIndex === 0 && eventIndex === 0;
  }, [state.currentPosition]);

  const isLastField = useCallback(() => {
    if (!state.fileData) return false;
    const { papers } = state.fileData;
    const { paperIndex, eventIndex } = state.currentPosition;
    return paperIndex === papers.length - 1 && 
           eventIndex === papers[paperIndex].events.length - 1;
  }, [state.fileData, state.currentPosition]);

  // Current item getters
  const getCurrentEvent = useCallback(() => {
    if (!state.fileData || !state.currentPosition) return null;
    const { paperIndex, eventIndex } = state.currentPosition;
    const event = state.fileData.papers[paperIndex]?.events[eventIndex] || null;
    console.log('Current Event:', event); // Debugging
    return event;
  }, [state.fileData, state.currentPosition]);
  
  const getCurrentPaper = useCallback(() => {
    if (!state.fileData || !state.currentPosition) return null;
    const paper = state.fileData.papers[state.currentPosition.paperIndex] || null;
    console.log('Current Paper:', paper); // Debugging
    return paper;
  }, [state.fileData, state.currentPosition]);

  // Effects
  useEffect(() => {
    mountedRef.current = true;
    if (userId) loadFileData();
    return () => {
      mountedRef.current = false;
    };
  }, [loadFileData, userId]);

  useEffect(() => {
    if (state.currentPosition) {
      safeStorage.set(`last-position-${fileId}`, state.currentPosition);
    }
  }, [fileId, state.currentPosition]);

  return {
    currentPosition: state.currentPosition,
    fileData: state.fileData,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    moveNext,
    movePrevious,
    loadFileData,
    handleAnnotationSave,
    isFirstField: isFirstField(),
    isLastField: isLastField(),
    getCurrentEvent,
    getCurrentPaper,
    invalidateCache: () => fileCache.invalidate(fileId)
  };
}
export {
  useAnnotation as default,
  fileCache,
  safeStorage
};