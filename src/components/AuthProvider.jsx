import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

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

  // Handle initial authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (isUserLoaded) {
          if (!isSignedIn) {
            navigate('/sign-in');
          } else {
            // Verify we can get a token
            const token = await getToken();
            if (!token) {
              throw new Error('Failed to get authentication token');
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setError(error.message);
      } finally {
        setIsInitializing(false);
      }
    };

    checkAuth();
  }, [isUserLoaded, isSignedIn, navigate, getToken]);

  // Memoize the context value to prevent unnecessary rerenders
  const contextValue = React.useMemo(() => ({
    user,
    isInitializing,
    isAuthenticated: isSignedIn,
    error,
    clearError: () => setError(null)
  }), [user, isInitializing, isSignedIn, error]);

  if (!isUserLoaded || isInitializing) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        Loading...
      </div>
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