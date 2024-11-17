import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { isLoaded: clerkLoaded, isSignedIn } = useClerkAuth();
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

  // Initial auth check
  useEffect(() => {
    if (!clerkLoaded) return;

    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        if (!isSignedIn && !window.location.pathname.match(/\/(sign-in|sign-up)/)) {
          navigate('/sign-in');
        }
      } catch (error) {
        handleError(error, 'Auth initialization failed');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [clerkLoaded, isSignedIn, navigate, handleError]);

  const value = {
    user,
    isLoading,
    error,
    clearError,
    getToken
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