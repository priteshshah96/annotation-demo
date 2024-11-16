import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';

const SYNC_TIMEOUT = 15000; // 15 seconds
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
      const timeoutId = setTimeout(() => abortController.current.abort(), SYNC_TIMEOUT);

      const response = await fetch('/api/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: abortController.current.signal
      });

      clearTimeout(timeoutId);

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

      // Only retry on network errors or timeouts, not auth errors
      if (retryCount > 0 && 
          (error.name === 'TimeoutError' || 
           error.name === 'AbortError' || 
           error.message.includes('failed to fetch'))) {
        console.log(`Retrying sync... (${retryCount} attempts remaining)`);
        
        // Wait between retries
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

  // Initial sync
  useEffect(() => {
    let mounted = true;

    if (isUserLoaded && user?.id && isInitialSync && !isSyncing) {
      syncUser().catch(error => {
        if (mounted) {
          console.error('Initial sync failed:', error);
        }
      });
    }

    return () => {
      mounted = false;
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
    syncUser
  };
}