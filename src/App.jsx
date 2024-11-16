import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { CircularProgress, Box } from '@mui/material';
import UserDashboard from './pages/UserDashboard';

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
  // Get publishable key from environment variable
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <Box sx={{ p: 4, color: 'error.main' }}>
        Missing Clerk Publishable Key
      </Box>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public auth routes */}
            <Route 
              path="/sign-in/*" 
              element={<SignIn routing="path" path="/sign-in" />} 
            />
            <Route 
              path="/sign-up/*" 
              element={<SignUp routing="path" path="/sign-up" />} 
            />
            
            {/* Protected routes */}
            <Route
              path="/"
              element={
                <>
                  <SignedIn>
                    <UserDashboard />
                  </SignedIn>
                  <SignedOut>
                    <RedirectToSignIn />
                  </SignedOut>
                </>
              }
            />

            {/* Catch all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ClerkProvider>
  );
}

export default App;