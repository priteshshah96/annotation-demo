// src/hooks/useAnnotationSync.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { annotationApi } from '../services/annotationApi';
import { ANNOTATION_FIELDS } from './useAnnotation'; // Add this import


// Constants
const SYNC_INTERVAL = 30000; // 30 seconds
const SYNC_STATUS_TIMEOUT = 2000; // 2 seconds
const SYNC_STATES = {
  SAVED: 'saved',
  SAVING: 'saving',
  ERROR: 'error',
  OFFLINE: 'offline'
};

// Storage helper functions
const storageUtils = {
  getKey: (fileId, annotation) => {
    // Updated to use paperIndex and eventIndex instead of abstract/sentence/entity
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
            // Updated parsing to match new key format
            const [_, __, paperIndex, eventIndex, ...fieldPathParts] = key.split('-');
            const fieldPath = fieldPathParts.join('-'); // Rejoin in case fieldPath contains hyphens
            
            pendingAnnotations.push({
              fileId,
              paperIndex: parseInt(paperIndex),
              eventIndex: parseInt(eventIndex),
              fieldPath,
              value: data.answer,
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
  // Refs
  const mountedRef = useRef(true);
  const syncTimeoutRef = useRef(null);
  const syncIntervalRef = useRef(null);

  // State
  const [syncStatus, setSyncStatus] = useState({ 
    show: false, 
    status: SYNC_STATES.SAVED,
    lastSync: null
  });
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Helper to safely update state only if component is mounted
  const safeSetState = useCallback((setter) => {
    if (mountedRef.current) {
      setter();
    }
  }, []);

  // Clear any existing status timeout
  const clearStatusTimeout = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  }, []);

  // Update sync status with auto-hide
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

  // Sync a single annotation
  const syncAnnotation = useCallback(async (annotation) => {
    // Initial validation checks
    if (!annotation || !mountedRef.current || isSyncing || !userId) {
      console.log('Sync prevented due to:', {
        hasAnnotation: !!annotation,
        isMounted: mountedRef.current,
        isSyncing,
        hasUserId: !!userId
      });
      return;
    }

    console.log('Starting sync for annotation:', {
      ...annotation,
      userId,
      fileId,
      isOnline
    });

    if (!isOnline) {
      console.log('Device is offline, saving to local storage');
      const key = storageUtils.getKey(fileId, annotation);
      console.log('Storage key:', key);
      
      const savedLocally = storageUtils.saveAnnotation(key, {
        answer: annotation.value,
        timestamp: new Date().toISOString(),
        pendingSync: true
      });
      
      console.log('Saved to localStorage:', savedLocally);
      
      safeSetState(() => {
        setPendingSync(true);
        updateSyncStatus(SYNC_STATES.OFFLINE, false);
      });
      console.log('Updated offline state');
      return;
    }

    try {
      console.log('Starting online sync process');
      safeSetState(() => setIsSyncing(true));
      updateSyncStatus(SYNC_STATES.SAVING);
      
      // Prepare API payload
      const apiPayload = {
        fileId,
        userId,
        ...annotation
      };
      console.log('API payload:', apiPayload);
      
      // Make API call
      const response = await annotationApi.saveAnnotation(apiPayload);
      console.log('API response:', response);

      // Save to local storage
      const key = storageUtils.getKey(fileId, annotation);
      console.log('Saving successful response to localStorage with key:', key);
      
      const savedLocally = storageUtils.saveAnnotation(key, {
        answer: annotation.value,
        timestamp: new Date().toISOString(),
        pendingSync: false
      });
      
      console.log('Saved to localStorage:', savedLocally);

      // Update local state to reflect the saved annotation
      const eventPath = `papers[${annotation.paperIndex}].events[${annotation.eventIndex}]`;
      console.log('Updating event at path:', eventPath);
      
      safeSetState(prev => {
        const newData = JSON.parse(JSON.stringify(prev.fileData)); // Deep clone
        const event = newData.papers[annotation.paperIndex].events[annotation.eventIndex];
        
        // Update the appropriate field based on fieldPath
        if (annotation.fieldPath === 'Main Action') {
          event['Main Action'] = annotation.value;
        } else if (annotation.fieldPath.startsWith('Arguments.')) {
          if (!event.Arguments) event.Arguments = {};
          
          if (annotation.fieldPath.startsWith('Arguments.Object.')) {
            if (!event.Arguments.Object) event.Arguments.Object = {};
            const objectField = annotation.fieldPath.replace('Arguments.Object.', '');
            event.Arguments.Object[objectField] = annotation.value;
          } else {
            const argField = annotation.fieldPath.replace('Arguments.', '');
            event.Arguments[argField] = annotation.value;
          }
        } else if (ANNOTATION_FIELDS.EVENT_TYPES.includes(annotation.fieldPath)) {
          event[annotation.fieldPath] = annotation.value;
        }
        
        console.log('Updated event:', event);
        return { ...prev, fileData: newData };
      });

      updateSyncStatus(SYNC_STATES.SAVED);
      console.log('Sync completed successfully');
      
    } catch (error) {
      console.error('Sync error:', error);
      console.log('Error details:', {
        message: error.message,
        stack: error.stack,
        annotation
      });
      
      safeSetState(() => {
        setPendingSync(true);
        updateSyncStatus(SYNC_STATES.ERROR, false);
      });
    } finally {
      console.log('Sync process finished');
      safeSetState(() => setIsSyncing(false));
    }
  }, [fileId, userId, isOnline, isSyncing, safeSetState, updateSyncStatus, ANNOTATION_FIELDS.EVENT_TYPES]);

  // Sync all pending annotations
  const syncPendingAnnotations = useCallback(async () => {
    if (!isOnline || !mountedRef.current || isSyncing || !userId) return false;

    try {
      safeSetState(() => setIsSyncing(true));
      const pendingAnnotations = storageUtils.getAllPendingAnnotations(fileId);

      if (pendingAnnotations.length === 0) {
        safeSetState(() => setPendingSync(false));
        return true;
      }

      console.log('Syncing pending annotations:', pendingAnnotations);
      updateSyncStatus(SYNC_STATES.SAVING);

      await annotationApi.syncAnnotations(fileId, pendingAnnotations.map(ann => ({
        ...ann,
        userId
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

  // Final sync for completion
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

  // Online/Offline status effect
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

  // Periodic sync check effect
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

  // Cleanup effect
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