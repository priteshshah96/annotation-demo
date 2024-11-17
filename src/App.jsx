import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { CircularProgress, Box, Typography } from '@mui/material';
import { SignIn, SignUp } from '@clerk/clerk-react';
import AuthProvider from './components/AuthProvider';

// Lazy load the dashboard
const UserDashboard = React.lazy(() => import('./pages/UserDashboard'));

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
        <Typography>Missing Clerk Publishable Key</Typography>
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
        <AuthProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route 
                path="/sign-in" 
                element={
                  <SignIn 
                    appearance={{ 
                      layout: { 
                        socialButtonsPlacement: "bottom",
                        term: "https://clerk.com/terms"
                      }
                    }}
                    path="/sign-in"
                    routing="path"
                    signUpUrl="/sign-up"
                    redirectUrl="/"
                  />
                } 
              />
              <Route 
                path="/sign-up" 
                element={
                  <SignUp 
                    appearance={{ 
                      layout: { 
                        socialButtonsPlacement: "bottom",
                        term: "https://clerk.com/terms"
                      }
                    }}
                    path="/sign-up"
                    routing="path"
                    signInUrl="/sign-in"
                    redirectUrl="/"
                  />
                } 
              />
              
              <Route path="/" element={<UserDashboard />} />
              <Route path="*" element={<Navigate to="/sign-in" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ClerkProvider>
  );
}

export default App;