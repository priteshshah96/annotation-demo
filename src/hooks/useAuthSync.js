import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';

export function useAuthSync() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { getToken } = useAuth();
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const syncUser = useCallback(async () => {
    if (!user?.id || isSyncing || !mountedRef.current) return;

    console.log('Starting user sync...'); // Debug log
    
    try {
      setIsSyncing(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('/api/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sync failed');
      }

      const data = await response.json();
      console.log('Sync successful:', data); // Debug log

      if (mountedRef.current) {
        setLastSyncTime(new Date().toISOString());
        setIsInitialSync(false);
      }

      return data;
    } catch (error) {
      console.error('Sync error:', error);
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
      console.log('Triggering initial sync...'); // Debug log
      syncUser().catch(error => {
        console.error('Initial sync failed:', error);
      });
    }
  }, [isUserLoaded, user?.id, isInitialSync, isSyncing, syncUser]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
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