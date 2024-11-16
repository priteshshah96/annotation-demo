import { useState, useCallback, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';

const MAX_RETRIES = 3;
const TIMEOUT_MS = 8000;
const BASE_DELAY_MS = 1000;

export function useAuthSync() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const syncUser = useCallback(async (retryAttempt = 0) => {
    if (!user?.id) return;
    
    let timeoutId;
    const controller = new AbortController();

    try {
      setIsSyncing(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Set timeout
      timeoutId = setTimeout(() => {
        controller.abort();
      }, TIMEOUT_MS);

      const response = await fetch('/api/vercel/user/sync', {
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

      // Success case
      clearTimeout(timeoutId);
      setIsInitialSync(false);
      setRetryCount(0);
      return true;

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Sync error:', {
        attempt: retryAttempt,
        error: error.message
      });

      // Handle abort/timeout
      if (error.name === 'AbortError') {
        error.message = 'Sync request timed out';
      }

      setError(error.message);

      // Retry logic
      if (retryAttempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryAttempt);
        setRetryCount(retryAttempt + 1);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return syncUser(retryAttempt + 1);
      } else {
        // Max retries reached
        setIsInitialSync(false);
        return false;
      }
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id, getToken]);

  // Initial sync
  useEffect(() => {
    if (isInitialSync && user?.id) {
      syncUser();
    }
  }, [isInitialSync, user?.id, syncUser]);

  // Reset retry count on user change
  useEffect(() => {
    setRetryCount(0);
  }, [user?.id]);

  return {
    isInitialSync: isInitialSync && retryCount < MAX_RETRIES,
    isSyncing,
    error,
    retryCount,
    syncUser,
    clearError: () => setError(null)
  };
}

export default useAuthSync;