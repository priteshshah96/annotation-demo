import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useClerkAuth();
  const { getToken } = useClerk();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user data and files from your backend
  const syncUserData = useCallback(async () => {
    if (!isSignedIn || !clerkUser) return null;

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Fetch user data including files from your backend
      const response = await fetch('/api/vercel/v1/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to sync user data');
      }

      const data = await response.json();
      
      if (!data?.user) {
        throw new Error('Invalid user data received');
      }

      return data.user;

    } catch (error) {
      console.error('User sync failed:', error);
      enqueueSnackbar('Failed to load user data', { variant: 'error' });
      return null;
    }
  }, [isSignedIn, clerkUser, getToken, enqueueSnackbar]);

  // Effect to handle authentication and data sync
  useEffect(() => {
    if (!clerkLoaded) return;

    const initializeUser = async () => {
      setIsLoading(true);
      
      try {
        if (isSignedIn && clerkUser) {
          // Sync user data and files
          const syncedData = await syncUserData();
          setUserData(syncedData);
        } else {
          setUserData(null);
          // Only redirect if not on auth pages
          if (!window.location.pathname.match(/\/(sign-in|sign-up)/)) {
            navigate('/sign-in');
          }
        }
      } catch (error) {
        console.error('Error initializing user:', error);
        enqueueSnackbar('Error loading user data', { variant: 'error' });
      } finally {
        setIsLoading(false);
      }
    };

    initializeUser();
  }, [clerkLoaded, isSignedIn, clerkUser, syncUserData, navigate, enqueueSnackbar]);

  // Re-sync when authentication state changes
  useEffect(() => {
    if (isSignedIn && clerkUser) {
      syncUserData().then(data => {
        if (data) {
          setUserData(data);
        }
      });
    }
  }, [isSignedIn, clerkUser, syncUserData]);

  const contextValue = {
    user: userData || clerkUser, // Fallback to Clerk user if sync hasn't completed
    isLoading,
    isAuthenticated: isSignedIn && !!clerkUser,
    files: userData?.files || [], // Provide files from synced data
    refreshUserData: syncUserData // Allow manual refresh of user data
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