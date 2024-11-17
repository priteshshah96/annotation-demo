import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

const AuthContext = createContext(null);

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Token management
const tokenManager = {
  lastToken: null,
  lastFetch: null,
  expiryBuffer: 5 * 60 * 1000, // 5 minutes

  async getToken(getTokenFn) {
    const now = Date.now();
    if (this.lastToken && this.lastFetch && 
        (now - this.lastFetch < this.expiryBuffer)) {
      return this.lastToken;
    }
    
    const newToken = await getTokenFn();
    this.lastToken = newToken;
    this.lastFetch = now;
    return newToken;
  },

  clearToken() {
    this.lastToken = null;
    this.lastFetch = null;
  }
};

// Error tracking
const errorTracker = {
  errors: new Map(),
  
  track(error, context) {
    const key = `${context}_${Date.now()}`;
    this.errors.set(key, { error, timestamp: Date.now() });
    
    // Clean old errors (older than 1 hour)
    const hour = 60 * 60 * 1000;
    for (const [key, value] of this.errors) {
      if (Date.now() - value.timestamp > hour) {
        this.errors.delete(key);
      }
    }
    
    return key;
  },
  
  getRecent(context) {
    return Array.from(this.errors.entries())
      .filter(([key]) => key.startsWith(context))
      .map(([_, value]) => value.error);
  }
};

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

  const clearError = useCallback(() => {
    setError(null);
    errorTracker.errors.clear();
  }, []);

  const handleError = useCallback((error, context = '') => {
    console.error(`[AuthProvider] ${context}:`, error);
    errorTracker.track(error, context);
    
    let message = 'An unexpected error occurred';
    let variant = 'error';
    let shouldRedirect = false;
    
    switch(error.code) {
      case 'TOKEN_EXPIRED':
        message = 'Your session has expired. Please sign in again.';
        shouldRedirect = true;
        tokenManager.clearToken();
        break;
      case 'NETWORK_ERROR':
        message = 'Network connection issue. Please check your connection.';
        variant = 'warning';
        break;
      case 'DB_ERROR':
        message = 'Database connection issue. Please try again later.';
        variant = 'warning';
        break;
      case 'AUTH_ERROR':
        message = 'Authentication error. Please sign in again.';
        shouldRedirect = true;
        break;
      default:
        if (error.status === 404) {
          message = 'User account not found. Please sign in again.';
          shouldRedirect = true;
        }
    }

    setError({ message, code: error.code });
    enqueueSnackbar(message, { 
      variant,
      autoHideDuration: 5000,
      preventDuplicate: true
    });

    if (shouldRedirect) {
      navigate('/sign-in');
    }
  }, [navigate, enqueueSnackbar]);

  const syncUser = useCallback(async (retry = false) => {
    if (syncInProgress || !isSignedIn) return;
    
    try {
      setSyncInProgress(true);
      const token = await tokenManager.getToken(getToken);
      
      if (!token) {
        throw new Error({ code: 'TOKEN_ERROR', message: 'No authentication token available' });
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
  }, [isSignedIn, getToken, retryCount, clearError, handleError]);

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
          tokenManager.clearToken();
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
  }, [clerkLoaded, isSignedIn, syncUser, navigate, handleError]);

  // Periodic sync
  useEffect(() => {
    if (!isSignedIn || !user) return;

    const syncInterval = setInterval(() => {
      if (!lastSync || Date.now() - lastSync.getTime() >= SYNC_INTERVAL) {
        syncUser(true);
      }
    }, SYNC_INTERVAL);

    return () => clearInterval(syncInterval);
  }, [isSignedIn, user, lastSync, syncUser]);

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
      handleError({ code: 'NETWORK_ERROR' }, 'Network disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error, clearError, syncUser, enqueueSnackbar, handleError]);

  const contextValue = {
    user,
    isLoading,
    error,
    syncInProgress,
    lastSync,
    clearError,
    syncUser,
    getAuthToken: () => tokenManager.getToken(getToken)
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};