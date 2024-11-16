// src/hooks/useAuthSync.js
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
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const syncUser = useCallback(async () => {
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

      // Setup new request with timeout
      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, REQUEST_TIMEOUT);

      const response = await fetch('/api/vercel/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: abortControllerRef.current.signal
      });

      clearTimeout(timeoutId);

      if (!mountedRef.current) return;

      if (!response.ok) {
        // Handle specific error cases
        switch (response.status) {
          case 401:
          case 403:
            navigate('/sign-in');
            throw new Error('Authentication required');
          case 404:
            throw new Error('Sync endpoint not found');
          case 429:
            throw new Error('Too many requests, please try again later');
          case 503:
            throw new Error('Service temporarily unavailable');
          default:
            throw new Error('Failed to sync user data');
        }
      }

      const data = await response.json();
      setIsInitialSync(false);
      return data;

    } catch (error) {
      if (!mountedRef.current) return;

      console.error('Sync error:', {
        message: error.message,
        name: error.name
      });

      // Only set error if it's not an abort
      if (error.name !== 'AbortError') {
        setError(error.message);
      }

      // Handle fatal errors
      if (error.message.includes('authentication')) {
        navigate('/sign-in');
      }

    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
        abortControllerRef.current = null;
      }
    }
  }, [user?.id, isSyncing, getToken, navigate]);

  // Cleanup on unmount
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