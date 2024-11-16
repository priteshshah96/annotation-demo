import { useState, useCallback, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';

export function useAuthSync() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [isInitialSync, setIsInitialSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);

  const syncUser = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setIsSyncing(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('/api/vercel/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      setIsInitialSync(false);
    } catch (error) {
      console.error('Sync error:', error);
      setError(error.message);
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

  return {
    isInitialSync,
    isSyncing,
    error,
    syncUser
  };
}