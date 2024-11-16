// src/hooks/useAuthSync.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';

const RETRY_DELAYS = [1000, 2000, 4000];
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 8000;

export function useAuthSync() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef(true);
  const currentRequestRef = useRef(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
      currentRequestRef.current = null;
    }
  }, []);

  const syncUser = useCallback(async (force = false) => {
    if (!user?.id || (isSyncing && !force) || !mountedRef.current) return;
    
    cleanup();

    try {
      setIsSyncing(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Create new AbortController
      currentRequestRef.current = new AbortController();

      const timeoutId = setTimeout(() => {
        if (currentRequestRef.current) {
          currentRequestRef.current.abort();
        }
      }, REQUEST_TIMEOUT);

      const response = await fetch('/api/vercel/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: currentRequestRef.current.signal
      });

      clearTimeout(timeoutId);

      if (!mountedRef.current) return;

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to parse response' }));
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (!mountedRef.current) return;

      setIsInitialSync(false);
      setRetryCount(0);
      return data;

    } catch (error) {
      if (!mountedRef.current) return;

      console.error('Sync error:', {
        message: error.message,
        name: error.name,
        retryCount
      });

      setError(error.message);

      if (error.name !== 'AbortError' && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount];
        await new Promise(resolve => setTimeout(resolve, delay));
        if (mountedRef.current) {
          setRetryCount(prev => prev + 1);
          return syncUser(true);
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
        currentRequestRef.current = null;
      }
    }
  }, [user?.id, isSyncing, getToken, retryCount, cleanup]);

  useEffect(() => {
    mountedRef.current = true;

    if (isInitialSync && user?.id) {
      syncUser(true);
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [isInitialSync, user?.id, syncUser, cleanup]);

  return {
    isInitialSync,
    isSyncing,
    error,
    retryCount,
    syncUser,
    cancelSync: cleanup
  };
}

export default useAuthSync;