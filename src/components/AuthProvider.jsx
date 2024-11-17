import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress, Box, Typography } from '@mui/material';

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
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    isLoading: true,
    user: null
  });

  console.log('Auth Provider State:', {
    isUserLoaded,
    isSignedIn,
    isInitializing,
    isSyncing,
    error,
    user: user?.id
  });

  const syncUser = useCallback(async (force = false) => {
    if ((!isSignedIn || isSyncing) && !force) return;

    try {
      setIsSyncing(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Make API call to sync user
      const response = await fetch('/api/vercel/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Sync failed');
      }

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user
      });

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
  }, [isSignedIn, isSyncing, getToken, navigate, user]);

  // Initial auth check
  useEffect(() => {
    console.log('Auth initialization effect running:', {
      isUserLoaded,
      isSignedIn
    });

    if (isUserLoaded) {
      if (!isSignedIn) {
        console.log('User not signed in, redirecting to sign-in');
        navigate('/sign-in', { replace: true });
        setIsInitializing(false);
      } else {
        console.log('User signed in, syncing user data');
        syncUser(true);
      }
    }
  }, [isUserLoaded, isSignedIn, navigate, syncUser]);

  // Loading state
  if (isInitializing || !isUserLoaded) {
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
        <Typography variant="body2" color="text.secondary">
          Initializing...
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: 2,
        p: 3
      }}>
        <Typography color="error" align="center">
          {error}
        </Typography>
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
        syncUser,
        clearError: () => setError(null)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;