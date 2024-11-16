import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import PropTypes from 'prop-types';
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
  const [error, setError] = useState(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  const initializeAuth = useCallback(async () => {
    try {
      if (!isUserLoaded) return;

      if (!isSignedIn) {
        navigate('/sign-in');
        return;
      }

      // Verify token access
      const token = await getToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      // Try initial sync
      const response = await fetch('/api/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sync user data');
      }

      setIsAuthChecked(true);
    } catch (error) {
      console.error('Auth initialization error:', error);
      setError(error.message);
    } finally {
      setIsInitializing(false);
    }
  }, [isUserLoaded, isSignedIn, navigate, getToken]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const contextValue = React.useMemo(() => ({
    user,
    isInitializing,
    isAuthenticated: isSignedIn && isAuthChecked,
    error,
    clearError: () => setError(null)
  }), [user, isInitializing, isSignedIn, isAuthChecked, error]);

  if (!isUserLoaded || isInitializing) {
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
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export default AuthProvider;