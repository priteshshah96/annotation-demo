import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';

const SYNC_TIMEOUT = 30000; // 30 seconds
const RETRY_DELAY = 2000;   // 2 seconds between retries
const MAX_RETRIES = 3;

export function useAuthSync() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { getToken } = useAuth();
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const abortController = useRef(null);

  const syncUser = useCallback(async (retryCount = MAX_RETRIES) => {
    if (!user?.id || isSyncing || !mountedRef.current) return;

    // Cancel any existing request
    if (abortController.current) {
      abortController.current.abort();
    }

    try {
      setIsSyncing(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Create new abort controller
      abortController.current = new AbortController();
      
      const response = await fetch('/api/vercel/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: abortController.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Sync failed');
      }

      const data = await response.json();

      if (mountedRef.current) {
        setLastSyncTime(new Date().toISOString());
        setIsInitialSync(false);
        setError(null);
      }

      return data;
    } catch (error) {
      console.error('Sync error:', error);
      
      if (!mountedRef.current) return;

      // Only retry on network errors or timeouts
      if (retryCount > 0 && 
          (error.name === 'TimeoutError' || 
           error.name === 'AbortError' || 
           !error.status)) { // Network errors don't have status
        console.log(`Retrying sync... (${retryCount} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return syncUser(retryCount - 1);
      }

      setError(error.message);
      throw error;
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
        abortController.current = null;
      }
    }
  }, [user?.id, isSyncing, getToken]);

  // Initial sync with delay
  useEffect(() => {
    let syncTimeout;
    if (isUserLoaded && user?.id && isInitialSync && !isSyncing) {
      // Add small delay before initial sync
      syncTimeout = setTimeout(() => {
        syncUser().catch(console.error);
      }, 1000);
    }

    return () => {
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
    };
  }, [isUserLoaded, user?.id, isInitialSync, isSyncing, syncUser]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  return {
    isInitialSync,
    isSyncing,
    lastSyncTime,
    error,
    syncUser,
    // Add retry method
    retrySync: () => syncUser(MAX_RETRIES)
  };
}