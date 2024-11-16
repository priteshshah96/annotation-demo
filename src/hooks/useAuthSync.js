import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const REQUEST_TIMEOUT = 8000;

export function useAuthSync() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const syncUser = useCallback(async () => {
    // Prevent sync if conditions not met
    if (!user?.id || isSyncing || !mountedRef.current) return;

    // Clean up any existing request
    cleanup();

    try {
      setIsSyncing(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
          reject(new Error('Request timeout'));
        }, REQUEST_TIMEOUT);
      });

      // Make request with race against timeout
      const response = await Promise.race([
        fetch('/api/vercel/user/sync', {
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
        const data = await response.json();
        throw new Error(data.error || 'Sync failed');
      }

      const data = await response.json();
      setIsInitialSync(false);
      return data;

    } catch (error) {
      if (!mountedRef.current) return;

      // Only set error for non-abort errors
      if (error.name !== 'AbortError') {
        console.error('Sync error:', error);
        setError(error.message);

        // Handle auth errors
        if (error.message.includes('authentication')) {
          navigate('/sign-in');
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
        abortControllerRef.current = null;
      }
    }
  }, [user?.id, isSyncing, getToken, navigate, cleanup]);

  // Clean up on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Initial sync
  useEffect(() => {
    if (isInitialSync && user?.id) {
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

export default useAuthSync;