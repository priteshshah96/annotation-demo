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
      navigate={(to) => window.history.pushState({}, '', to)}
    >
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route 
              path="/sign-in/*" 
              element={
                <SignIn 
                  routing="path" 
                  path="/sign-in" 
                  afterSignInUrl="/"
                  signUpUrl="/sign-up"
                />
              } 
            />
            <Route 
              path="/sign-up/*" 
              element={
                <SignUp 
                  routing="path" 
                  path="/sign-up"
                  afterSignUpUrl="/"
                  signInUrl="/sign-in"
                />
              } 
            />
            
            <Route
              path="/"
              element={
                <>
                  <SignedIn>
                    <UserDashboard />
                  </SignedIn>
                  <SignedOut>
                    <RedirectToSignIn redirectUrl="/" />
                  </SignedOut>
                </>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ClerkProvider>
  );
}

export default App;