// src/hooks/useAuthSync.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';

const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff
const REQUEST_TIMEOUT = 8000; // 8 second timeout

export function useAuthSync() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // Cleanup function
  const cleanup = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
  };

  const syncUser = useCallback(async (force = false) => {
    if (!user?.id || (isSyncing && !force)) return;

    // Cleanup any existing requests
    cleanup();

    try {
      setIsSyncing(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => 
        abortControllerRef.current.abort(), REQUEST_TIMEOUT
      );

      const response = await fetch('/api/vercel/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: abortControllerRef.current.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      // Success - reset retry count and initial sync flag
      setIsInitialSync(false);
      setRetryCount(0);
      
      return data;

    } catch (error) {
      console.error('Sync error:', {
        message: error.message,
        name: error.name,
        retryCount
      });

      setError(error.message);

      // Retry logic with exponential backoff
      if (retryCount < RETRY_DELAYS.length) {
        const nextRetry = retryCount + 1;
        console.log(`Scheduling retry ${nextRetry}/${RETRY_DELAYS.length}...`);
        
        retryTimeoutRef.current = setTimeout(() => {
          setRetryCount(nextRetry);
          syncUser(true);
        }, RETRY_DELAYS[retryCount]);
      }

      throw error;
    } finally {
      setIsSyncing(false);
      abortControllerRef.current = null;
    }
  }, [user?.id, isSyncing, getToken, retryCount]);

  // Initial sync
  useEffect(() => {
    if (isInitialSync && user?.id) {
      syncUser(true);
    }

    // Cleanup on unmount
    return cleanup;
  }, [isInitialSync, user?.id, syncUser]);

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