import React, { createContext, useContext, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useAuthSync } from '../hooks/useAuthSync';
import { CircularProgress } from '@mui/material';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoaded: isUserLoaded } = useUser();
  const { isInitialSync, isSyncing, error, syncUser } = useAuthSync();
  const [isReady, setIsReady] = useState(false);

  // Show loading state if auth is not yet loaded
  if (!isAuthLoaded || !isUserLoaded) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress />
      </div>
    );
  }

  // Don't require sync for non-authenticated routes
  if (!isSignedIn) {
    return children;
  }

  // Show loading state during initial sync
  if (isInitialSync && isSyncing) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress />
      </div>
    );
  }

  // Show error state if sync failed
  if (error && !isReady) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: '1rem'
      }}>
        <div>Failed to sync user data: {error}</div>
        <button onClick={() => {
          syncUser().then(() => setIsReady(true));
        }}>
          Retry Sync
        </button>
      </div>
    );
  }

  return (
    <AuthContext.Provider 
      value={{ 
        isInitialSync, 
        isSyncing, 
        error,
        syncUser 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

export default AuthProvider;