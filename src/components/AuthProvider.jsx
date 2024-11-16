// src/components/providers/AuthProvider.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';

const AuthContext = createContext(null);
const TIMEOUT_MS = 8000;
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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
    if ((!isSignedIn || isSyncing) && !force) return;

    let timeoutId;
    const controller = new AbortController();

    try {
      setIsSyncing(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Set timeout
      timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch('/api/vercel/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Sync failed');
      }

      const data = await response.json();
      setLastSyncTime(new Date().toISOString());

    } catch (error) {
      console.error('Auth sync error:', error);
      setError(error.message);

      if (error.message.includes('authentication') || error.status === 401) {
        navigate('/sign-in', { replace: true });
      }
    } finally {
      setIsSyncing(false);
      setIsInitializing(false);
    }
  }, [isSignedIn, isSyncing, getToken, navigate]);

  // Initial auth check
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
      }, SYNC_INTERVAL_MS);
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isSignedIn, isInitializing, syncUser]);

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