import { useState, useCallback, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';

const MAX_RETRIES = 3;
const TIMEOUT_MS = 8000;
const BASE_DELAY_MS = 1000;

export function useAnnotationSync() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const log = (message, data = {}) => {
    console.log(`[useAnnotationSync] ${message}`, data);
  };

  const syncAnnotations = useCallback(async (retryAttempt = 0) => {
    if (!user?.id) {
      log("User is not logged in. Sync aborted.");
      return;
    }
    
    let timeoutId;
    const controller = new AbortController();

    try {
      setIsSyncing(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      timeoutId = setTimeout(() => {
        controller.abort();
      }, TIMEOUT_MS);

      const response = await fetch('/api/vercel/annotations/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Sync failed with status: ${response.status}`);
      }

      clearTimeout(timeoutId);
      log("Annotations synced successfully.");
      setIsInitialSync(false);
      setRetryCount(0);

    } catch (error) {
      clearTimeout(timeoutId);
      log("Error during annotation sync", { error: error.message });

      if (error.name === 'AbortError') {
        error.message = 'Sync request timed out';
      }

      setError(error.message);

      if (retryAttempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryAttempt);
        log(`Retrying annotation sync in ${delay}ms`, { retryAttempt });
        setRetryCount(retryAttempt + 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return syncAnnotations(retryAttempt + 1);
      } else {
        log("Max retries reached. Sync failed.", { retryAttempt });
      }

    } finally {
      setIsSyncing(false);
    }
  }, [user?.id, getToken]);

  useEffect(() => {
    if (isInitialSync && user?.id) {
      log("Triggering initial annotation sync", { userId: user?.id });
      syncAnnotations();
    }
  }, [isInitialSync, user?.id, syncAnnotations]);

  useEffect(() => {
    setRetryCount(0);
  }, [user?.id]);

  return {
    isInitialSync: isInitialSync && retryCount < MAX_RETRIES,
    isSyncing,
    error,
    retryCount,
    syncAnnotations,
    clearError: () => setError(null)
  };
}

export default useAnnotationSync;