import { useState, useEffect, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { api } from '../lib/api';

export function useAuthSync() {
  const { getToken } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [error, setError] = useState(null);

  // Sync user data with our backend
  const syncUser = useCallback(async () => {
    if (!user?.id || isSyncing) return;
  
    try {
      setIsSyncing(true);
      setError(null);
  
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
  
      // Use the correct base URL
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to sync user data');
      }
  
      const syncData = await response.json();
      setLastSyncTime(new Date().toISOString());
      setIsInitialSync(false);
      
      return syncData;
    } catch (err) {
      console.error('Sync error details:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id, getToken, isSyncing]);

  // Check sync status
  const checkSyncStatus = useCallback(async () => {
    if (!user?.id) return null;

    try {
      const token = await getToken();
      if (!token) return null;

      const response = await fetch('/api/user/sync', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to check sync status');
      }

      const data = await response.json();
      return data.user;
    } catch (err) {
      console.error('Sync status check failed:', err);
      return null;
    }
  }, [user?.id, getToken]);

  // Initial sync effect
  useEffect(() => {
    if (isUserLoaded && user?.id && isInitialSync) {
      syncUser().catch(console.error);
    }
  }, [isUserLoaded, user?.id, isInitialSync, syncUser]);

  // Periodic sync effect (every 30 minutes)
  useEffect(() => {
    if (!isUserLoaded || !user?.id) return;

    const syncInterval = setInterval(() => {
      syncUser().catch(console.error);
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(syncInterval);
  }, [isUserLoaded, user?.id, syncUser]);

  return {
    isInitialSync,
    isSyncing,
    lastSyncTime,
    error,
    syncUser,
    checkSyncStatus
  };
}

export default useAuthSync;