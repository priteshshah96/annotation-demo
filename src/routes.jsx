import { Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, SignUp, useAuth as useClerkAuth } from '@clerk/clerk-react';
import ErrorBoundary from './ErrorBoundary';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';
import { useAuth } from './components/providers/AuthProvider';

function AuthenticatedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { isLoaded: clerkLoaded } = useClerkAuth();

  if (!clerkLoaded || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"/>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  return children;
}

function AppRoutes() {
  const { isLoaded, isSignedIn } = useClerkAuth();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"/>
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
              <SignIn routing="path" path="/sign-in" />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/sign-up/*"
          element={
            !isSignedIn ? (
              <SignUp routing="path" path="/sign-up" />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            <AuthenticatedRoute>
              <UserDashboard />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/annotation/:fileId"
          element={
            <AuthenticatedRoute>
              <UserAnnotationDashboard />
            </AuthenticatedRoute>
          }
        />
        <Route
          path="/"
          element={
            <Navigate to={isSignedIn ? "/dashboard" : "/sign-in"} replace />
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