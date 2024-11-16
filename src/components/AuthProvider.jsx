import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress, Box, Typography } from '@mui/material';

const AuthContext = createContext(null);
const MAX_RETRIES = 3;
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
  const [retryCount, setRetryCount] = useState(0);

  const syncUser = useCallback(async (force = false, retryAttempt = 0) => {
    if ((!isSignedIn || isSyncing) && !force) return;

    let timeoutId;
    const controller = new AbortController();

    try {
      setIsSyncing(true);
      const token = await getToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Set timeout
      timeoutId = setTimeout(() => {
        controller.abort();
      }, TIMEOUT_MS);

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
        throw new Error(`Sync failed with status: ${response.status}`);
      }

      setLastSyncTime(new Date().toISOString());
      setError(null);
      setRetryCount(0);

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Auth sync error:', {
        attempt: retryAttempt,
        error: error.message
      });

      setError(error.message);

      // Handle specific errors
      if (error.name === 'AbortError') {
        if (retryAttempt < MAX_RETRIES) {
          const delay = 1000 * Math.pow(2, retryAttempt);
          setRetryCount(retryAttempt + 1);
          
          setTimeout(() => {
            syncUser(force, retryAttempt + 1);
          }, delay);
          return;
        }
      } else if (error.message.includes('token') || error.message.includes('authentication')) {
        navigate('/sign-in', { replace: true });
        return;
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
        syncUser(false);
      }, SYNC_INTERVAL_MS);
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [isSignedIn, isInitializing, syncUser]);

  // Loading state with retry indication
  if (isInitializing) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: 2
      }}>
        <CircularProgress />
        {retryCount > 0 && (
          <Typography variant="caption" color="text.secondary">
            Retrying connection... ({retryCount}/{MAX_RETRIES})
          </Typography>
        )}
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
        retryCount,
        clearError: () => setError(null)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;