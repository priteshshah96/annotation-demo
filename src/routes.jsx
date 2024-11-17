import { Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, RedirectToSignIn } from '@clerk/clerk-react';
import { useAuth } from './components/providers/AuthProvider';
import ErrorBoundary from './ErrorBoundary';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // or a loading spinner
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route 
          path="/sign-in" 
          element={
            <SignIn 
              path="/sign-in"
              routing="path"
              redirectUrl="/"
              signUpUrl="/sign-up"
            />
          } 
        />
        <Route 
          path="/sign-up" 
          element={
            <SignIn 
              path="/sign-up"
              routing="path"
              redirectUrl="/"
            />
          } 
        />
        
        {/* Protected Routes */}
        <Route
          path="/"
          element={user ? <UserDashboard /> : <RedirectToSignIn redirectUrl="/sign-in" />}
        />
        <Route
          path="/annotations"
          element={user ? <UserAnnotationDashboard /> : <RedirectToSignIn redirectUrl="/sign-in" />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default AppRoutes;
