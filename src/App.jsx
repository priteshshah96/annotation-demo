import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { CircularProgress, Box } from '@mui/material';
import { SignIn, SignUp, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
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
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <Box sx={{ p: 4, color: 'error.main' }}>
        Missing Clerk Publishable Key
      </Box>
    );
  }

  return (
    <ClerkProvider 
      publishableKey={publishableKey}
      appearance={{
        layout: {
          socialButtonsPlacement: "bottom",
          socialButtonsVariant: "iconButton",
          termsPageUrl: "https://clerk.com/terms"
        }
      }}
    >
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Auth Routes */}
            <Route 
              path="/sign-in" 
              element={
                <SignIn 
                  appearance={{ layout: { socialButtonsPlacement: "bottom" }}}
                  redirectUrl="/"
                  routing="path"
                />
              } 
            />
            <Route 
              path="/sign-up" 
              element={
                <SignUp 
                  appearance={{ layout: { socialButtonsPlacement: "bottom" }}}
                  redirectUrl="/"
                  routing="path"
                />
              } 
            />
            
            {/* Protected Route */}
            <Route 
              path="/"
              element={
                <SignedIn>
                  <UserDashboard />
                </SignedIn>
              }
            />

            {/* Redirect unsigned users */}
            <Route
              path="*"
              element={
                <SignedOut>
                  <RedirectToSignIn />
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