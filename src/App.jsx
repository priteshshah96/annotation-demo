import { ClerkProvider, SignIn, SignUp } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { CircularProgress, Box } from '@mui/material';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';
import { AuthProvider } from './context/AuthProvider';

// Loading component
const LoadingFallback = () => (
  <Box sx={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh' 
  }}>
    <CircularProgress />
  </Box>
);

// RequireAuth wrapper component
const RequireAuth = ({ children }) => {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  return children;
};

function App() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <Box sx={{ p: 4, color: 'error.main' }}>
        Error: Missing Clerk publishable key. Please check your environment variables.
      </Box>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/sign-in" element={<SignIn routing="path" path="/sign-in" />} />
              <Route path="/sign-up" element={<SignUp routing="path" path="/sign-up" />} />
              
              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <UserDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/file/:fileId"
                element={
                  <RequireAuth>
                    <UserAnnotationDashboard mode="view" />
                  </RequireAuth>
                }
              />
              <Route
                path="/annotate/:fileId"
                element={
                  <RequireAuth>
                    <UserAnnotationDashboard mode="edit" />
                  </RequireAuth>
                }
              />

              {/* Catch all redirect to sign-in */}
              <Route path="*" element={<Navigate to="/sign-in" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ClerkProvider>
  );
}

export default App;