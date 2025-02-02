import { useState, useCallback, useEffect, useRef } from 'react';
import { annotationApi } from '../services/annotationApi';

export const SYNC_STATES = {
  INITIALIZING: 'initializing',
  SAVED: 'saved',
  SAVING: 'saving',
  ERROR: 'error',
  OFFLINE: 'offline'
};

export function useAnnotationSync(fileId, userId, onRefreshNeeded) {
  const [syncStatus, setSyncStatus] = useState({ 
    show: false, 
    status: SYNC_STATES.INITIALIZING,
    lastSync: null,
    error: null
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const mountedRef = useRef(true);
  const isOnlineRef = useRef(window.navigator.onLine);
  const pendingChangesRef = useRef(new Set());
  const annotationQueueRef = useRef([]);
 
  const updateSyncStatus = useCallback((status, error = null) => {
    if (!mountedRef.current) return;
    
    setSyncStatus(prev => ({
      ...prev,
      show: true,
      status,
      error,
      lastSync: status === SYNC_STATES.SAVED ? new Date().toISOString() : prev.lastSync
    }));
  }, []);
 
  const processQueue = useCallback(async () => {
    if (annotationQueueRef.current.length === 0 || isSyncing || !isOnlineRef.current) return;
 
    setIsSyncing(true);
    updateSyncStatus(SYNC_STATES.SAVING);
 
    try {
      while (annotationQueueRef.current.length > 0) {
        const annotation = annotationQueueRef.current[0];
        await annotationApi.saveAnnotation(annotation);
        annotationQueueRef.current.shift();
      }
 
      if (onRefreshNeeded) {
        await onRefreshNeeded();
      }
 
      updateSyncStatus(SYNC_STATES.SAVED);
    } catch (error) {
      console.error('Queue processing error:', error);
      updateSyncStatus(SYNC_STATES.ERROR, error.message);
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [isSyncing, onRefreshNeeded, updateSyncStatus]);
 
  const queueAnnotation = useCallback((annotation) => {
    annotationQueueRef.current.push(annotation);
    processQueue();
  }, [processQueue]);
 
  const syncAnnotation = useCallback(async ({
    fieldPath,
    answer,
    paperIndex,
    eventIndex,
    isDelete = false,
    annotationId
  }) => {
    if (!fileId || !userId) {
      return { success: false, error: 'Missing fileId or userId' };
    }
  
    try {
      const result = await annotationApi.saveAnnotation({
        fileId,
        paperIndex,
        eventIndex,
        fieldPath,
        answer,
        isDelete,
        annotationId,
        userId
      });
  
      updateSyncStatus(SYNC_STATES.SAVED);
      
      // Return success without forcing full refresh
      return { success: true, data: result };
    } catch (error) {
      console.error('Sync error:', error);
      updateSyncStatus(SYNC_STATES.ERROR, error.message);
      return { success: false, error };
    }
  }, [fileId, userId, updateSyncStatus]);

  const finalizeSync = useCallback(async () => {
    if (!fileId || !userId) {
      console.error('Missing fileId or userId for finalization');
      return false;
    }

    if (!isOnlineRef.current) {
      console.error('Cannot finalize while offline');
      updateSyncStatus(SYNC_STATES.OFFLINE);
      return false;
    }

    try {
      setIsSyncing(true);
      updateSyncStatus(SYNC_STATES.SAVING);

      // First process any pending annotations
      if (annotationQueueRef.current.length > 0) {
        await processQueue();
      }

      // Finalize the annotations
      const response = await annotationApi.finalizeAnnotations(fileId);
      
      if (response.success) {
        updateSyncStatus(SYNC_STATES.SAVED);
        // Clear any pending changes
        pendingChangesRef.current.clear();
        annotationQueueRef.current = [];
        
        if (onRefreshNeeded) {
          await onRefreshNeeded();
        }
        return true;
      } else {
        throw new Error(response.error || 'Failed to finalize annotations');
      }
    } catch (error) {
      console.error('Finalize sync error:', error);
      updateSyncStatus(SYNC_STATES.ERROR, error.message);
      return false;
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [fileId, userId, processQueue, updateSyncStatus, onRefreshNeeded]);
 
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      updateSyncStatus(SYNC_STATES.SAVED);
      processQueue();
    };
    
    const handleOffline = () => {
      isOnlineRef.current = false;
      updateSyncStatus(SYNC_STATES.OFFLINE, 'No internet connection');
    };
 
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
 
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateSyncStatus, processQueue]);
 
  useEffect(() => {
    const interval = setInterval(() => {
      if (annotationQueueRef.current.length > 0) {
        processQueue();
      }
    }, 1000);
 
    return () => clearInterval(interval);
  }, [processQueue]);
 
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);
 
  return {
    syncStatus,
    isSyncing,
    syncAnnotation,
    finalizeSync,
    isOnline: isOnlineRef.current,
    pendingChanges: annotationQueueRef.current.length + pendingChangesRef.current.size
  };
}

export default useAnnotationSync;