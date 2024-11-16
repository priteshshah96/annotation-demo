import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense } from 'react';
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

function App() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <Box sx={{ p: 4, color: 'error.main' }}>
        Error: Missing Clerk publishable key
      </Box>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route
              path="/sign-in/*"
              element={<SignIn routing="path" path="/sign-in" />}
            />
            <Route
              path="/sign-up/*"
              element={<SignUp routing="path" path="/sign-up" />}
            />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <SignedIn>
                  <UserDashboard />
                </SignedIn>
              }
            />
            <Route
              path="/file/:fileId"
              element={
                <SignedIn>
                  <UserAnnotationDashboard mode="view" />
                </SignedIn>
              }
            />
            <Route
              path="/annotate/:fileId"
              element={
                <SignedIn>
                  <UserAnnotationDashboard mode="edit" />
                </SignedIn>
              }
            />

            {/* Default redirect for unauthenticated users */}
            <Route
              path="*"
              element={
                <SignedOut>
                  <Navigate to="/sign-in" replace />
                </SignedOut>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ClerkProvider>
  );
}

export default App;