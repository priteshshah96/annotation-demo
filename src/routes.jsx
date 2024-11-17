import { Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ErrorBoundary from './ErrorBoundary';

// Import your page components here
// Example: import HomePage from './pages/HomePage';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <ErrorBoundary>
      <Routes>
        {/* Add your routes here */}
        {/* Example:
        <Route path="/" element={<HomePage />} />
        */}
      </Routes>
    </ErrorBoundary>
  );
}

export default AppRoutes;
