// src/hooks/useAuthSync.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { api } from '../lib/api';

export function useAuthSync() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [error, setError] = useState(null);
  const syncTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  const syncUser = useCallback(async (retryCount = 0) => {
    if (!user?.id || isSyncing || !mountedRef.current) return;

    try {
      setIsSyncing(true);
      setError(null);

      const response = await api.user.sync();
      
      if (mountedRef.current) {
        setLastSyncTime(new Date().toISOString());
        setIsInitialSync(false);
      }

      return response;
    } catch (error) {
      console.error('Sync error:', error);
      if (mountedRef.current) {
        setError(error.message);
        
        // Retry logic for initial sync
        if (isInitialSync && retryCount < 3) {
          syncTimeoutRef.current = setTimeout(() => {
            syncUser(retryCount + 1);
          }, 1000 * (retryCount + 1));
        }
      }
      throw error;
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [user?.id, isSyncing, isInitialSync]);

  // Initial sync effect
  useEffect(() => {
    if (isUserLoaded && user?.id && isInitialSync) {
      syncUser();
    }

    return () => {
      mountedRef.current = false;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [isUserLoaded, user?.id, isInitialSync, syncUser]);

  return {
    isInitialSync,
    isSyncing,
    lastSyncTime,
    error,
    syncUser
  };
}

export default useAuthSync;