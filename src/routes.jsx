import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { SignIn, SignUp, useAuth as useClerkAuth } from '@clerk/clerk-react';
import ErrorBoundary from './ErrorBoundary';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';

function AppRoutes() {
  const { isLoaded, isSignedIn, user } = useClerkAuth();

  // Detailed logging for authentication state
  useEffect(() => {
    console.group('Authentication Debug');
    console.log('Is Loaded:', isLoaded);
    console.log('Is Signed In:', isSignedIn);
    console.log('User Details:', user ? {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      username: user.username
    } : 'No user');
    console.groupEnd();
  }, [isLoaded, isSignedIn, user]);

  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
      <Route
          path="/sign-in/*"
          element={
            !isSignedIn ? (
              <SignIn 
                routing="path" 
                path="/sign-in" 
                appearance={{
                  elements: {
                    rootBox: {
                      boxShadow: "none",
                      background: "white"
                    },
                    card: {
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      borderRadius: "8px"
                    },
                    // Remove any duplicate buttons/boxes
                    socialButtonsIconButton: {
                      display: "none"  // Hide duplicate social buttons if present
                    },
                    formButtonPrimary: {
                      fontSize: '14px',
                      fontWeight: 600,
                      textTransform: 'none',
                      backgroundColor: 'var(--clerk-primary-color)',
                      '&:hover': {
                        backgroundColor: 'var(--clerk-primary-color)',
                        opacity: 0.8
                      }
                    }
                  },
                  layout: {
                    socialButtonsPlacement: "bottom",
                    socialButtonsVariant: "auto",
                    privacyPageUrl: false,    // Remove additional links that might cause spacing issues
                    termsPageUrl: false
                  }
                }}
              />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/sign-up/*"
          element={
            !isSignedIn ? (
              <SignUp routing="path" path="/sign-up" appearance={{
                elements: {
                  formButtonPrimary: {
                    fontSize: '14px',
                    fontWeight: 600,
                    textTransform: 'none',
                    backgroundColor: 'var(--clerk-primary-color)',
                    '&:hover': {
                      backgroundColor: 'var(--clerk-primary-color)',
                      opacity: 0.8
                    }
                  }
                }
              }} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/"
          element={
            isSignedIn ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/sign-in" replace />
            )
          }
        />
        <Route
          path="/dashboard/*"
          element={
            isSignedIn ? (
              <UserDashboard />
            ) : (
              <Navigate to="/sign-in" replace />
            )
          }
        />
        <Route
          path="/annotation/*"
          element={
            isSignedIn ? (
              <UserAnnotationDashboard />
            ) : (
              <Navigate to="/sign-in" replace />
            )
          }
        />
        <Route
          path="*"
          element={
            <Navigate to={isSignedIn ? "/dashboard" : "/sign-in"} replace />
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}

export default AppRoutes;
