import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';

const AuthContext = createContext(null);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const { user, isLoaded: isUserLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const syncUser = useCallback(async (force = false) => {
    if (!isSignedIn || isSyncing) return;

    try {
      setIsSyncing(true);
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
        throw new Error('Failed to sync user data');
      }

      setLastSyncTime(new Date().toISOString());
      setError(null);

    } catch (error) {
      console.error('Auth sync error:', error);
      setError(error.message);
      
      // If sync fails due to auth issues, redirect to sign-in
      if (error.message.includes('token') || error.message.includes('authentication')) {
        navigate('/sign-in', { replace: true });
      }
    } finally {
      setIsSyncing(false);
      setIsInitializing(false);
    }
  }, [isSignedIn, isSyncing, getToken, navigate]);

  // Initial auth check and sync
  useEffect(() => {
    if (isUserLoaded) {
      if (!isSignedIn) {
        navigate('/sign-in', { replace: true });
        setIsInitializing(false);
      } else {
        syncUser(true);
      }
    }
  }, [isUserLoaded, isSignedIn, navigate, syncUser]);

  // Periodic sync
  useEffect(() => {
    let syncInterval;
    
    if (isSignedIn && !isInitializing) {
      syncInterval = setInterval(() => {
        syncUser();
      }, 5 * 60 * 1000); // Sync every 5 minutes
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isSignedIn, isInitializing, syncUser]);

  // Loading state
  if (isInitializing) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <AuthContext.Provider 
      value={{
        user,
        isAuthenticated: isSignedIn,
        isSyncing,
        error,
        lastSyncTime,
        syncUser,
        clearError: () => setError(null)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;