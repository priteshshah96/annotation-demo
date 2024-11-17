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
          path="/sign-in/*"
          element={<SignIn routing="path" path="/sign-in" />}
        />
        <Route
          path="/sign-up/*"
          element={<SignUp routing="path" path="/sign-up" />}
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
      </Routes>
    </ErrorBoundary>
  );
}

export default AppRoutes;
