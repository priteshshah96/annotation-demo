import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || '/api/vercel';
const REQUEST_TIMEOUT = 8000;

export function AuthProvider({ children }) {
  const { isLoaded: clerkLoaded, isSignedIn, userId } = useClerkAuth();
  const { getToken } = useClerk();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error, context = '') => {
    console.error(`[AuthProvider] ${context}:`, error);
    
    let message = 'An unexpected error occurred';
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
  const syncUser = useCallback(async () => {
    if (!isSignedIn || !userId) {
      setUser(null);
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${API_URL}/user/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setUser(null);
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setUser(data.user);
      setRetryCount(0);
    } catch (error) {
      handleError(error, 'User sync failed');
    }
  }, [isSignedIn, userId, getToken, handleError]);

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
  }, [clerkLoaded, isSignedIn, navigate, syncUser, handleError]);

  const value = {
    user,
    isLoading,
    error,
    clearError,
    syncUser,
    getToken
  };

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