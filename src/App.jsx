import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { CircularProgress, Box } from '@mui/material';
import { SignIn, SignUp } from '@clerk/clerk-react';
import AuthProvider from './components/AuthProvider';

// Lazy load components for better performance
const UserDashboard = React.lazy(() => import('./pages/UserDashboard'));

// Loading Fallback Component
const LoadingFallback = () => (
  <Box sx={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    width: '100vw',
    position: 'fixed',
    top: 0,
    left: 0,
    backgroundColor: 'background.default'
  }}>
    <CircularProgress />
  </Box>
);

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded) {
    return <LoadingFallback />;
  }

  return isSignedIn ? children : null;
};

// Public Route Wrapper
const PublicRoute = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/');
    }
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded) {
    return <LoadingFallback />;
  }

  return !isSignedIn ? children : null;
};

function App() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <Box 
        sx={{ 
          p: 4, 
          color: 'error.main',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <Typography variant="h5">
          Missing Clerk Publishable Key
        </Typography>
      </Box>
    );
  }

  return (
    <ClerkProvider 
      publishableKey={publishableKey}
      appearance={{
        layout: {
          socialButtonsPlacement: "bottom",
          socialButtonsVariant: "iconButton",
          termsPageUrl: "https://clerk.com/terms"
        },
        elements: {
          rootBox: {
            backgroundColor: 'var(--mdc-theme-background)',
          },
          card: {
            border: '1px solid var(--mdc-theme-divider)',
            boxShadow: 'var(--mdc-theme-box-shadow)'
          }
        }
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Public Routes */}
              <Route
                path="/sign-in"
                element={
                  <PublicRoute>
                    <SignIn 
                      appearance={{ 
                        elements: { 
                          rootBox: { 
                            backgroundColor: 'var(--mdc-theme-background)' 
                          }
                        }
                      }}
                      navigationFn={navigate}
                      afterSignInUrl="/"
                      afterSignUpUrl="/sign-up"
                    />
                  </PublicRoute>
                }
              />
              <Route
                path="/sign-up"
                element={
                  <PublicRoute>
                    <SignUp 
                      appearance={{ 
                        elements: { 
                          rootBox: { 
                            backgroundColor: 'var(--mdc-theme-background)' 
                          }
                        }
                      }}
                      navigationFn={navigate}
                      afterSignUpUrl="/"
                      afterSignInUrl="/sign-in"
                    />
                  </PublicRoute>
                }
              />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <UserDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all route - redirect to sign in */}
              <Route
                path="*"
                element={<Navigate to="/sign-in" replace />}
              />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ClerkProvider>
  );
}

export default App;