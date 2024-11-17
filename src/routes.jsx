import { Routes, Route, Navigate } from 'react-router-dom';
import { SignIn } from '@clerk/clerk-react';
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
        <Route path="/sign-in" element={<SignIn routing="path" path="/sign-in" />} />
        
        {/* Protected Routes */}
        <Route
          path="/"
          element={user ? <UserDashboard /> : <Navigate to="/sign-in" replace />}
        />
        <Route
          path="/annotations"
          element={user ? <UserAnnotationDashboard /> : <Navigate to="/sign-in" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default AppRoutes;
