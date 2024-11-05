import { useState, useCallback, useEffect, useRef } from 'react';
import { annotationApi } from '../services/annotationApi';

export function useAnnotationSync(fileId) {
  const mountedRef = useRef(true);
  const [syncStatus, setSyncStatus] = useState({ 
    show: false, 
    status: 'saved', // 'saved' | 'saving' | 'error' | 'offline'
    lastSync: null
  });
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Track online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (pendingSync && mountedRef.current) {
        syncPendingAnnotations();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      if (mountedRef.current) {
        setSyncStatus(prev => ({ 
          ...prev, 
          status: 'offline',
          show: true 
        }));
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingSync]);

  // Sync a single annotation
  const syncAnnotation = useCallback(async (annotation) => {
    if (!annotation || !mountedRef.current || isSyncing) return;

    if (!isOnline) {
      const key = `annotation-${fileId}-${annotation.abstractIndex}-${annotation.sentenceIndex}-${annotation.entityIndex}`;
      localStorage.setItem(key, JSON.stringify({
        answer: annotation.answer,
        timestamp: new Date().toISOString(),
        pendingSync: true
      }));
      setPendingSync(true);
      setSyncStatus({ 
        show: true, 
        status: 'offline',
        lastSync: null
      });
      return;
    }

    try {
      setIsSyncing(true);
      setSyncStatus(prev => ({ ...prev, show: true, status: 'saving' }));
      
      await annotationApi.saveAnnotation({
        fileId,
        ...annotation
      });

      if (!mountedRef.current) return;

      const key = `annotation-${fileId}-${annotation.abstractIndex}-${annotation.sentenceIndex}-${annotation.entityIndex}`;
      localStorage.setItem(key, JSON.stringify({
        answer: annotation.answer,
        timestamp: new Date().toISOString(),
        pendingSync: false
      }));

      setSyncStatus(prev => ({ 
        ...prev,
        status: 'saved',
        lastSync: new Date().toISOString()
      }));

      setTimeout(() => {
        if (mountedRef.current) {
          setSyncStatus(prev => ({ ...prev, show: false }));
        }
      }, 2000);

    } catch (error) {
      console.error('Sync error:', error);
      if (mountedRef.current) {
        setSyncStatus(prev => ({ 
          ...prev,
          status: 'error',
          lastSync: null
        }));
        setPendingSync(true);
      }
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [fileId, isOnline, isSyncing]);

  // Sync all pending annotations
  const syncPendingAnnotations = useCallback(async () => {
    if (!isOnline || !mountedRef.current || isSyncing) return;

    try {
      setIsSyncing(true);
      const pendingAnnotations = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`annotation-${fileId}`)) {
          const data = JSON.parse(localStorage.getItem(key));
          if (data?.pendingSync) {
            const [_, __, abstractIndex, sentenceIndex, entityIndex] = key.split('-');
            pendingAnnotations.push({
              fileId,
              abstractIndex: parseInt(abstractIndex),
              sentenceIndex: parseInt(sentenceIndex),
              entityIndex: parseInt(entityIndex),
              answer: data.answer,
              timestamp: data.timestamp
            });
          }
        }
      }

      if (pendingAnnotations.length === 0) {
        setPendingSync(false);
        return true;
      }

      if (!mountedRef.current) return false;
      setSyncStatus({ show: true, status: 'saving' });

      await annotationApi.syncAnnotations(fileId, pendingAnnotations);

      if (!mountedRef.current) return false;

      // Update localStorage
      pendingAnnotations.forEach(annotation => {
        const key = `annotation-${fileId}-${annotation.abstractIndex}-${annotation.sentenceIndex}-${annotation.entityIndex}`;
        const data = JSON.parse(localStorage.getItem(key));
        if (data) {
          localStorage.setItem(key, JSON.stringify({
            ...data,
            pendingSync: false
          }));
        }
      });

      setPendingSync(false);
      setSyncStatus({ 
        show: true, 
        status: 'saved',
        lastSync: new Date().toISOString()
      });

      setTimeout(() => {
        if (mountedRef.current) {
          setSyncStatus(prev => ({ ...prev, show: false }));
        }
      }, 2000);

      return true;
    } catch (error) {
      console.error('Batch sync error:', error);
      if (mountedRef.current) {
        setSyncStatus({ 
          show: true, 
          status: 'error',
          lastSync: null
        });
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [fileId, isOnline, isSyncing]);

  // Final sync for completion
  const finalizeSync = useCallback(async () => {
    if (!mountedRef.current || isSyncing) return false;
    
    try {
      setIsSyncing(true);
      setSyncStatus(prev => ({ ...prev, show: true, status: 'saving' }));

      // Perform final sync
      const success = await syncPendingAnnotations();
      
      if (!mountedRef.current) return false;

      // Additional cleanup
      if (success) {
        // Clear position data
        localStorage.removeItem(`last-position-${fileId}`);
        
        setSyncStatus({ 
          show: true, 
          status: 'saved',
          lastSync: new Date().toISOString()
        });
      }

      return success;
    } catch (error) {
      console.error('Final sync error:', error);
      if (mountedRef.current) {
        setSyncStatus({ 
          show: true, 
          status: 'error',
          lastSync: null
        });
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [fileId, isSyncing, syncPendingAnnotations]);

  // Periodic sync check
  useEffect(() => {
    let syncInterval;
    if (!isSyncing) {
      syncInterval = setInterval(() => {
        if (isOnline && pendingSync && mountedRef.current) {
          syncPendingAnnotations();
        }
      }, 30000);
    }
    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isOnline, pendingSync, syncPendingAnnotations, isSyncing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    syncStatus,
    syncAnnotation,
    syncPendingAnnotations,
    finalizeSync,
    isOnline,
    isSyncing
  };
}

export default useAnnotationSync;