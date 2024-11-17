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
          path="/sign-in/*" 
          element={<SignIn redirectUrl="/" routing="path" signUpUrl="/sign-up" />} 
        />
        <Route 
          path="/sign-up/*" 
          element={<SignIn redirectUrl="/" routing="path" />} 
        />
        
        {/* Protected Routes */}
        <Route
          path="/"
          element={user ? <UserDashboard /> : <RedirectToSignIn />}
        />
        <Route
          path="/annotations"
          element={user ? <UserAnnotationDashboard /> : <RedirectToSignIn />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default AppRoutes;
