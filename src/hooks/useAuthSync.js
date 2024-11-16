import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';

export function useAuthSync() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { getToken } = useAuth();
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const syncTimeoutRef = useRef(null);

  const syncUser = useCallback(async (retryCount = 3) => {
    if (!user?.id || isSyncing || !mountedRef.current) return;

    try {
      setIsSyncing(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Get the base URL from environment or default to window.location.origin
      const baseUrl = process.env.VITE_API_URL || window.location.origin;
      
      const response = await fetch(`${baseUrl}/api/user/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        // Add timeout
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sync failed');
      }

      const data = await response.json();

      if (mountedRef.current) {
        setLastSyncTime(new Date().toISOString());
        setIsInitialSync(false);
      }

      return data;
    } catch (error) {
      console.error('Sync error:', error);
      
      // Implement retry logic
      if (retryCount > 0 && error.name !== 'AbortError') {
        console.log(`Retrying sync... (${retryCount} attempts remaining)`);
        return new Promise(resolve => {
          syncTimeoutRef.current = setTimeout(() => {
            resolve(syncUser(retryCount - 1));
          }, 1000);
        });
      }

      if (mountedRef.current) {
        setError(error.message);
      }
      throw error;
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [user?.id, isSyncing, getToken]);

  // Initial sync
  useEffect(() => {
    if (isUserLoaded && user?.id && isInitialSync && !isSyncing) {
      syncUser().catch(error => {
        console.error('Initial sync failed:', error);
      });
    }
  }, [isUserLoaded, user?.id, isInitialSync, isSyncing, syncUser]);

  // Periodic sync
  useEffect(() => {
    let syncInterval;
    if (isUserLoaded && user?.id && !isInitialSync) {
      syncInterval = setInterval(() => {
        syncUser().catch(console.error);
      }, 5 * 60 * 1000); // Sync every 5 minutes
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isUserLoaded, user?.id, isInitialSync, syncUser]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
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