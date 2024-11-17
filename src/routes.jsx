import { Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, SignUp, useAuth as useClerkAuth } from '@clerk/clerk-react';
import ErrorBoundary from './ErrorBoundary';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';

function AppRoutes() {
  const { isLoaded, isSignedIn } = useClerkAuth();

  if (!isLoaded) {
    return null; // or a loading spinner
  }

  return (
    <ErrorBoundary>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default AppRoutes;
