import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { api } from '../../lib/api';  // Fixed import path

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useClerkAuth();
  const { getToken } = useClerk();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncUserData = useCallback(async () => {
    if (!isSignedIn || !clerkUser) return null;

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const { user } = await api.user.sync(token);
      return user;
    } catch (error) {
      console.error('User sync failed:', error);
      enqueueSnackbar(error.message || 'Failed to load user data', { 
        variant: 'error' 
      });
      return null;
    }
  }, [isSignedIn, clerkUser, getToken, enqueueSnackbar]);

  useEffect(() => {
    if (!clerkLoaded) return;

    const initializeUser = async () => {
      setIsLoading(true);
      
      try {
        if (isSignedIn && clerkUser) {
          const syncedData = await syncUserData();
          setUserData(syncedData);
        } else {
          setUserData(null);
          if (!window.location.pathname.match(/\/(sign-in|sign-up)/)) {
            navigate('/sign-in');
          }
        }
      } catch (error) {
        console.error('Error initializing user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeUser();
  }, [clerkLoaded, isSignedIn, clerkUser, syncUserData, navigate]);

  const contextValue = {
    user: userData || clerkUser,
    isLoading,
    isAuthenticated: isSignedIn && !!clerkUser,
    files: userData?.files || [],
    refreshUserData: syncUserData
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