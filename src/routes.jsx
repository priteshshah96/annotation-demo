import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './components/providers/AuthProvider';
import ErrorBoundary from './ErrorBoundary';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // or a loading spinner
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<UserDashboard />} />
        <Route path="/annotations" element={<UserAnnotationDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default AppRoutes;
