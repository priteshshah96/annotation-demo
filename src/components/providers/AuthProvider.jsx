import React, { createContext, useContext, useState, useEffect } from 'react';
import { useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

const AuthContext = createContext(null);

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export function AuthProvider({ children }) {
  const { isLoaded: clerkLoaded, isSignedIn } = useClerkAuth();
  const { getToken } = useClerk();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const clearError = () => setError(null);

  const handleError = (error, context = '') => {
    console.error(`[AuthProvider] ${context}:`, error);
    
    let message = 'An unexpected error occurred';
    let variant = 'error';
    
    if (error.code === 'TOKEN_EXPIRED') {
      message = 'Your session has expired. Please sign in again.';
      navigate('/sign-in');
    } else if (error.code === 'NETWORK_ERROR') {
      message = 'Network connection issue. Please check your connection.';
      variant = 'warning';
    } else if (error.code === 'DB_ERROR') {
      message = 'Database connection issue. Please try again later.';
      variant = 'warning';
    } else if (error.status === 404) {
      message = 'User account not found. Please sign in again.';
      navigate('/sign-in');
    }

    setError({ message, code: error.code });
    enqueueSnackbar(message, { 
      variant,
      autoHideDuration: 5000,
      preventDuplicate: true
    });
  };

  const syncUser = async (retry = false) => {
    if (syncInProgress || !isSignedIn) return;
    
    try {
      setSyncInProgress(true);
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
        const error = await response.json();
        throw error;
      }

      const data = await response.json();
      setUser(data.user);
      setLastSync(new Date());
      setRetryCount(0);
      
      // Clear any existing errors since sync succeeded
      clearError();
      
    } catch (error) {
      console.error('[AuthProvider] Sync error:', error);
      
      if (retry && retryCount < MAX_RETRIES) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          syncUser(true);
        }, RETRY_DELAY * Math.pow(2, retryCount));
      } else {
        handleError(error, 'User sync failed');
      }
    } finally {
      setSyncInProgress(false);
    }
  };

  // Initial auth check and user sync
  useEffect(() => {
    if (!clerkLoaded) return;

    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        if (isSignedIn) {
          await syncUser(true);
        } else {
          setUser(null);
          // Only redirect if we're not already on an auth page
          if (!window.location.pathname.match(/\/(sign-in|sign-up)/)) {
            navigate('/sign-in');
          }
        }
      } catch (error) {
        handleError(error, 'Auth initialization failed');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [clerkLoaded, isSignedIn]);

  // Periodic sync
  useEffect(() => {
    if (!isSignedIn || !user) return;

    const syncInterval = setInterval(() => {
      // Only sync if more than SYNC_INTERVAL has passed since last sync
      if (!lastSync || Date.now() - lastSync.getTime() >= SYNC_INTERVAL) {
        syncUser(true);
      }
    }, SYNC_INTERVAL);

    return () => clearInterval(syncInterval);
  }, [isSignedIn, user, lastSync]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      enqueueSnackbar('Connection restored', { 
        variant: 'success',
        autoHideDuration: 3000
      });
      if (error?.code === 'NETWORK_ERROR') {
        clearError();
        syncUser(true);
      }
    };

    const handleOffline = () => {
      enqueueSnackbar('Connection lost', { 
        variant: 'warning',
        autoHideDuration: null
      });
      setError({ 
        message: 'Network connection lost',
        code: 'NETWORK_ERROR'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error]);

  const value = {
    user,
    isLoading,
    error,
    clearError,
    syncUser,
    syncInProgress,
    lastSync
  };

  if (!clerkLoaded) {
    return <div>Loading authentication...</div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}