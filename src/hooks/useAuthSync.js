import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const REQUEST_TIMEOUT = 8000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export function useAuthSync() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);

  const log = (message, data = {}) => {
    console.log(`[useAuthSync] ${message}`, data);
  };

  const cleanup = useCallback(() => {
    log("Cleanup triggered");
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const syncUser = useCallback(async (retryAttempt = 0) => {
    log("Starting user sync process", { userId: user?.id, isSyncing, retryAttempt });

    if (!user?.id || isSyncing || !mountedRef.current) {
      log("Sync aborted: Missing user ID, already syncing, or component unmounted");
      return;
    }

    cleanup();

    try {
      setIsSyncing(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      log("Token retrieved", { token });

      abortControllerRef.current = new AbortController();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
          reject(new Error('Request timeout'));
        }, REQUEST_TIMEOUT);
      });

      const response = await Promise.race([
        fetch('/api/vercel/v1/user/sync', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: abortControllerRef.current.signal
        }),
        timeoutPromise
      ]);

      if (!mountedRef.current) return;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json().catch(() => ({}));
      log("Sync successful", { data });

      setIsInitialSync(false);
      setRetryCount(0); // Reset retries on success
      return data;

    } catch (error) {
      if (!mountedRef.current) return;

      if (error.name !== 'AbortError') {
        log("Sync error occurred", { error: error.message });
        setError(error.message);

        if (retryAttempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, retryAttempt); // Exponential backoff
          log(`Retrying sync in ${delay}ms`, { retryAttempt });
          await new Promise(resolve => setTimeout(resolve, delay));
          return syncUser(retryAttempt + 1);
        }

        if (error.message.includes('authentication')) {
          navigate('/sign-in');
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
        abortControllerRef.current = null;
        log("Sync process finalized");
      }
    }
  }, [user?.id, isSyncing, getToken, navigate, cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
      log("Component unmounted");
    };
  }, [cleanup]);

  useEffect(() => {
    if (isInitialSync && user?.id) {
      log("Triggering initial sync", { userId: user?.id });
      syncUser();
    }
  }, [isInitialSync, user?.id, syncUser]);

  return {
    isInitialSync,
    isSyncing,
    error,
    syncUser,
    cancelSync: cleanup
  };
}