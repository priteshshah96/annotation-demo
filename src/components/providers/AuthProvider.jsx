import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { api } from '../../lib/api';

const AuthContext = createContext(null);

const REQUEST_TIMEOUT = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

class AuthError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.details = details;
  }
}

export function AuthProvider({ children }) {
  const { isLoaded: clerkLoaded, isSignedIn, userId } = useClerkAuth();
  const { getToken } = useClerk();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error, context = '') => {
    console.error(`[AuthProvider] ${context}:`, error);
    
    let message = error.message || 'An unexpected error occurred';
    let shouldRedirect = false;
    let variant = 'error';
    
    if (error.message?.includes('authentication') || error.status === 401) {
      message = 'Please sign in to continue';
      shouldRedirect = true;
    } else if (error.name === 'AbortError') {
      message = 'Request timed out. Please try again.';
      variant = 'warning';
    } else if (error.status === 429) {
      message = 'Too many requests. Please try again later.';
      variant = 'warning';
    }

    setError(message);
    enqueueSnackbar(message, { 
      variant,
      autoHideDuration: 5000,
      preventDuplicate: true
    });

    if (shouldRedirect) {
      navigate('/sign-in');
    }
  }, [navigate, enqueueSnackbar]);

  // Sync user with backend
  const syncUser = useCallback(async (retryAttempt = 0) => {
    if (!isSignedIn || !userId) {
      setUser(null);
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        throw new AuthError('No authentication token available', 401);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const response = await api.user.sync();
        if (!response || !response.user) {
          throw new AuthError('Invalid user data received');
        }
        setUser(response.user);
        setRetryCount(0);
        clearError();
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          setUser(null);
          navigate('/sign-in');
          return;
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      handleError(error, 'User sync failed');

      if (retryAttempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retryAttempt);
        console.log(`[AuthProvider] Retrying user sync in ${delay}ms`, error);
        setRetryCount(retryAttempt + 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return syncUser(retryAttempt + 1);
      }
    }
  }, [isSignedIn, userId, getToken, handleError, navigate, clearError]);

  // Initial auth check and user sync
  useEffect(() => {
    if (!clerkLoaded) return;

    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        if (!isSignedIn && !window.location.pathname.match(/\/(sign-in|sign-up)/)) {
          navigate('/sign-in');
          return;
        }

        if (isSignedIn) {
          await syncUser();
        } else {
          setUser(null);
        }
      } catch (error) {
        handleError(error, 'Auth initialization failed');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [clerkLoaded, isSignedIn, syncUser, navigate, handleError]);

  // Re-sync user when auth state changes
  useEffect(() => {
    if (clerkLoaded && isSignedIn) {
      syncUser();
    }
  }, [clerkLoaded, isSignedIn, syncUser]);

  const contextValue = {
    user,
    isLoading,
    error,
    clearError,
    syncUser
  };

  return (
    <AuthContext.Provider value={contextValue}>
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

export default AuthProvider;