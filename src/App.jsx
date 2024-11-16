import React from 'react';
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';
import { CircularProgress, Box } from '@mui/material';

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

const ProtectedRoute = ({ children }) => {
  return (
    <SignedIn>
      {children}
    </SignedIn>
  );
};

function App() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  
  return (
    <BrowserRouter>
      <ClerkProvider publishableKey={publishableKey}>
        <React.Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Auth Routes */}
            <Route
              path="/sign-in/*"
              element={<SignIn routing="path" signUpUrl="/sign-up" />}
            />
            <Route
              path="/sign-up/*"
              element={<SignUp routing="path" signInUrl="/sign-in" />}
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
            
            {/* Public Routes */}
            <Route
              path="*"
              element={
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              }
            />
          </Routes>
        </React.Suspense>
      </ClerkProvider>
    </BrowserRouter>
  );
}

export default App;