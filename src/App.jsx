import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import { CircularProgress, Box } from '@mui/material';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';

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

// Protected route component
const ProtectedRoute = ({ children }) => {
  return <SignedIn>{children}</SignedIn>;
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
      <BrowserRouter>
        <React.Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Auth Routes */}
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />
            
            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <UserDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/file/:fileId"
              element={
                <ProtectedRoute>
                  <UserAnnotationDashboard mode="view" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/annotate/:fileId"
              element={
                <ProtectedRoute>
                  <UserAnnotationDashboard mode="edit" />
                </ProtectedRoute>
              }
            />

            {/* Redirect unauthorized users to sign-in */}
            <Route
              path="*"
              element={<RedirectToSignIn />}
            />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </ClerkProvider>
  );
}

export default App;