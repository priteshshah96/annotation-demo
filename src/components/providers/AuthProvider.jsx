import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function AuthProvider({ children }) {
  const { isLoaded: clerkLoaded, isSignedIn, userId } = useClerkAuth();
  const { getToken } = useClerk();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error, context = '') => {
    console.error(`[AuthProvider] ${context}:`, error);
    
    let message = 'An unexpected error occurred';
    let shouldRedirect = false;
    
    if (error.message?.includes('authentication') || error.status === 401) {
      message = 'Please sign in to continue';
      shouldRedirect = true;
    }

    setError(message);
    enqueueSnackbar(message, { 
      variant: 'error',
      autoHideDuration: 5000,
      preventDuplicate: true
    });

    if (shouldRedirect) {
      navigate('/sign-in');
    }
  }, [navigate, enqueueSnackbar]);

  // Sync user with backend
  const syncUser = useCallback(async () => {
    if (!isSignedIn || !userId) return;

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/user/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setUser(data);
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
        }
      } catch (error) {
        handleError(error, 'Auth initialization failed');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [clerkLoaded, isSignedIn, navigate, handleError, syncUser]);

  const value = {
    user,
    isLoading,
    error,
    clearError,
    getToken,
    syncUser
  };

  return (
    <AuthContext.Provider value={value}>
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