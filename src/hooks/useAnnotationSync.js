import { useState, useCallback, useEffect, useRef } from 'react';
import { annotationApi } from '../services/annotationApi';
import { AnnotationTypes } from '../models/Annotation';

const SYNC_INTERVAL = 30000; // 30 seconds
const SYNC_STATUS_TIMEOUT = 2000; // 2 seconds

const SYNC_STATES = {
  SAVED: 'saved',
  SAVING: 'saving',
  ERROR: 'error',
  OFFLINE: 'offline'
};

// Updated storage helper functions to match model structure
const storageUtils = {
  getKey: (fileId, annotation) => {
    const { paperIndex, eventIndex, fieldPath } = annotation;
    return `annotation-${fileId}-${paperIndex}-${eventIndex}-${fieldPath}`;
  },

  saveAnnotation: (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  },

  getAnnotation: (key) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  },

  getAllPendingAnnotations: (fileId) => {
    const pendingAnnotations = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`annotation-${fileId}`)) {
          const data = storageUtils.getAnnotation(key);
          if (data?.pendingSync) {
            const [_, __, paperIndex, eventIndex, ...fieldPathParts] = key.split('-');
            const fieldPath = fieldPathParts.join('-');
            
            // Normalize the answer based on field type
            const isEventType = AnnotationTypes.EVENT_TYPE.includes(fieldPath);
            const isMainAction = fieldPath === 'Main Action';  // Use string literal
            const isArgument = fieldPath.startsWith('Arguments.') || fieldPath.startsWith('Object.');

            let normalizedAnswer;
            if (isEventType) {
              // Event types must be strings
              normalizedAnswer = String(data.answer || '');
            } else if (isMainAction) {
              // Main action includes spans
              normalizedAnswer = {
                text: String(data.answer?.text || ''),
                spans: [{
                  text: String(data.answer?.text || ''),
                  start: 0,
                  end: String(data.answer?.text || '').length
                }]
              };
            } else if (isArgument) {
              // Arguments are arrays with spans
              normalizedAnswer = {
                text: data.answer?.text || '',
                spans: Array.isArray(data.answer?.spans) ? data.answer.spans : []
              };
            }

            pendingAnnotations.push({
              fileId,
              paperIndex: parseInt(paperIndex),
              eventIndex: parseInt(eventIndex),
              fieldPath: fieldPath.startsWith('Object.') ? `Arguments.${fieldPath}` : fieldPath,
              answer: normalizedAnswer,
              timestamp: data.timestamp
            });
          }
        }
      }
    } catch (error) {
      console.error('Error getting pending annotations:', error);
    }
    return pendingAnnotations;
  }
};

export function useAnnotationSync(fileId, userId) {
  const mountedRef = useRef(true);
  const syncTimeoutRef = useRef(null);
  const syncIntervalRef = useRef(null);

  const [syncStatus, setSyncStatus] = useState({ 
    show: false, 
    status: SYNC_STATES.SAVED,
    lastSync: null
  });
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const safeSetState = useCallback((setter) => {
    if (mountedRef.current) {
      setter();
    }
  }, []);

  const clearStatusTimeout = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  }, []);

  const updateSyncStatus = useCallback((status, shouldAutoHide = true) => {
    clearStatusTimeout();
    safeSetState(() => {
      setSyncStatus(prev => ({
        ...prev,
        show: true,
        status,
        lastSync: status === SYNC_STATES.SAVED ? new Date().toISOString() : prev.lastSync
      }));
    });

    if (shouldAutoHide) {
      syncTimeoutRef.current = setTimeout(() => {
        safeSetState(() => {
          setSyncStatus(prev => ({ ...prev, show: false }));
        });
      }, SYNC_STATUS_TIMEOUT);
    }
  }, [clearStatusTimeout, safeSetState]);

  const syncAnnotation = useCallback(async (annotation) => {
    if (!annotation || !mountedRef.current || isSyncing || !userId) {
      return;
    }

    // Normalize field path
    const fieldPath = annotation.fieldPath.startsWith('Object.') ? 
      `Arguments.${annotation.fieldPath}` : annotation.fieldPath;

    const isEventType = AnnotationTypes.EVENT_TYPE.includes(fieldPath);
    const isMainAction = fieldPath === 'Main Action';  // Use string literal
    const isArgument = fieldPath.startsWith('Arguments.');

    // Process the answer based on field type
    let processedAnswer;
    if (isEventType) {
      processedAnswer = String(annotation.value || '');
    } else if (isMainAction) {
      processedAnswer = {
        text: String(annotation.value || ''),
        spans: [{
          text: String(annotation.value || ''),
          start: 0,
          end: String(annotation.value || '').length
        }]
      };
    } else if (isArgument) {
      const spans = annotation.span ? [annotation.span] : 
        (Array.isArray(annotation.spans) ? annotation.spans : []);
      processedAnswer = {
        text: spans.map(s => s.text).join(' '),
        spans: spans.sort((a, b) => a.start - b.start)
      };
    }

    if (!isOnline) {
      const key = storageUtils.getKey(fileId, { ...annotation, fieldPath });
      storageUtils.saveAnnotation(key, {
        answer: processedAnswer,
        timestamp: new Date().toISOString(),
        pendingSync: true
      });
      
      safeSetState(() => {
        setPendingSync(true);
        updateSyncStatus(SYNC_STATES.OFFLINE, false);
      });
      return;
    }

    try {
      safeSetState(() => setIsSyncing(true));
      updateSyncStatus(SYNC_STATES.SAVING);
      
      const apiPayload = {
        fileId,
        userId,
        paperIndex: Number(annotation.paperIndex),
        eventIndex: Number(annotation.eventIndex),
        fieldPath,
        answer: processedAnswer,
        isDelete: annotation.isDelete
      };
      
      await annotationApi.saveAnnotation(apiPayload);

      const key = storageUtils.getKey(fileId, { ...annotation, fieldPath });
      storageUtils.saveAnnotation(key, {
        answer: processedAnswer,
        timestamp: new Date().toISOString(),
        pendingSync: false
      });

      updateSyncStatus(SYNC_STATES.SAVED);
      
    } catch (error) {
      console.error('Sync error:', error);
      safeSetState(() => {
        setPendingSync(true);
        updateSyncStatus(SYNC_STATES.ERROR, false);
      });
    } finally {
      safeSetState(() => setIsSyncing(false));
    }
  }, [fileId, userId, isOnline, isSyncing, safeSetState, updateSyncStatus]);

  const syncPendingAnnotations = useCallback(async () => {
    if (!isOnline || !mountedRef.current || isSyncing || !userId) return false;

    try {
      safeSetState(() => setIsSyncing(true));
      const pendingAnnotations = storageUtils.getAllPendingAnnotations(fileId);

      if (pendingAnnotations.length === 0) {
        safeSetState(() => setPendingSync(false));
        return true;
      }

      updateSyncStatus(SYNC_STATES.SAVING);

      await annotationApi.syncAnnotations(fileId, pendingAnnotations.map(ann => ({
        ...ann,
        userId,
        paperIndex: Number(ann.paperIndex),
        eventIndex: Number(ann.eventIndex)
      })));

      // Update localStorage for synced annotations
      pendingAnnotations.forEach(annotation => {
        const key = storageUtils.getKey(fileId, annotation);
        const data = storageUtils.getAnnotation(key);
        if (data) {
          storageUtils.saveAnnotation(key, { ...data, pendingSync: false });
        }
      });

      safeSetState(() => setPendingSync(false));
      updateSyncStatus(SYNC_STATES.SAVED);

      return true;
    } catch (error) {
      console.error('Batch sync error:', error);
      updateSyncStatus(SYNC_STATES.ERROR, false);
      return false;
    } finally {
      safeSetState(() => setIsSyncing(false));
    }
  }, [fileId, userId, isOnline, isSyncing, safeSetState, updateSyncStatus]);

  const finalizeSync = useCallback(async () => {
    if (!mountedRef.current || isSyncing || !userId) return false;
    
    try {
      safeSetState(() => setIsSyncing(true));
      updateSyncStatus(SYNC_STATES.SAVING);

      const success = await syncPendingAnnotations();
      
      if (success) {
        localStorage.removeItem(`last-position-${fileId}`);
        updateSyncStatus(SYNC_STATES.SAVED);
      }

      return success;
    } catch (error) {
      console.error('Final sync error:', error);
      updateSyncStatus(SYNC_STATES.ERROR, false);
      return false;
    } finally {
      safeSetState(() => setIsSyncing(false));
    }
  }, [fileId, userId, isSyncing, syncPendingAnnotations, safeSetState, updateSyncStatus]);

  useEffect(() => {
    const handleOnline = () => {
      safeSetState(() => setIsOnline(true));
      if (pendingSync) {
        syncPendingAnnotations();
      }
    };
    
    const handleOffline = () => {
      safeSetState(() => {
        setIsOnline(false);
        updateSyncStatus(SYNC_STATES.OFFLINE, false);
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingSync, syncPendingAnnotations, safeSetState, updateSyncStatus]);

  useEffect(() => {
    if (!isSyncing && isOnline && pendingSync) {
      syncIntervalRef.current = setInterval(() => {
        if (mountedRef.current) {
          syncPendingAnnotations();
        }
      }, SYNC_INTERVAL);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isOnline, pendingSync, syncPendingAnnotations, isSyncing]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearStatusTimeout();
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [clearStatusTimeout]);

  return {
    syncStatus,
    syncAnnotation,
    syncPendingAnnotations,
    finalizeSync,
    isOnline,
    isSyncing
  };
}

export {
  SYNC_STATES,
  storageUtils
};

export default useAnnotationSync;