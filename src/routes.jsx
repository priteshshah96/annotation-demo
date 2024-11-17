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
        <div>Loading authentication... Please wait</div>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={
      <div>
        <h1>Routing Error</h1>
        <p>Something went wrong with navigation. Please try again.</p>
        <button onClick={() => window.location.reload()}>
          Reload Page
        </button>
      </div>
    }>
      <Routes>
        <Route 
          path="/sign-in" 
          element={
            !isSignedIn ? (
              <SignIn 
                routing="path"
                path="/sign-in"
                redirectUrl="/"
                appearance={{
                  layout: {
                    socialButtonsVariant: "iconButton",
                    socialButtonsPlacement: "bottom"
                  }
                }}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        
        <Route 
          path="/sign-up" 
          element={
            !isSignedIn ? (
              <SignUp 
                routing="path"
                redirectUrl="/"
                appearance={{
                  layout: {
                    socialButtonsVariant: "iconButton",
                    socialButtonsPlacement: "bottom"
                  }
                }}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        
        {/* Protected Routes */}
        <Route
          path="/"
          element={
            isSignedIn ? (
              <UserDashboard />
            ) : (
              <Navigate to="/sign-in" replace />
            )
          }
        />
        <Route
          path="/annotations"
          element={
            isSignedIn ? (
              <UserAnnotationDashboard />
            ) : (
              <Navigate to="/sign-in" replace />
            )
          }
        />
        
        {/* Catch-all route for unmatched paths */}
        <Route 
          path="*" 
          element={
            isSignedIn ? (
              <Navigate to="/" replace />
            ) : (
              <Navigate to="/sign-in" replace />
            )
          } 
        />
      </Routes>
    </ErrorBoundary>
  );
}

export default AppRoutes;
