import React from 'react';
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';
import { CircularProgress, Box, Typography } from '@mui/material';

const LoadingFallback = () => (
  <Box sx={{ 
    display: 'flex', 
    flexDirection: 'column',
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    gap: 2
  }}>
    <CircularProgress />
  </Box>
);

function ClerkProviderWithRoutes() {
  const navigate = useNavigate();
  
  return (
    <ClerkProvider 
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
    >
      <Box sx={{ minHeight: '100vh' }}>
        <SignedOut>
          <Routes>
            <Route 
              path="/sign-in" 
              element={<SignIn routing="path" afterSignInUrl="/" />} 
            />
            <Route 
              path="/sign-up" 
              element={<SignUp routing="path" afterSignUpUrl="/" />} 
            />
            <Route 
              path="*" 
              element={<Navigate to="/sign-in" replace />} 
            />
          </Routes>
        </SignedOut>

        <SignedIn>
          <Routes>
            <Route path="/" element={<UserDashboard />} />
            <Route 
              path="/file/:fileId" 
              element={<UserAnnotationDashboard mode="view" />} 
            />
            <Route 
              path="/annotate/:fileId" 
              element={<UserAnnotationDashboard mode="edit" />} 
            />
            <Route 
              path="*" 
              element={<Navigate to="/" replace />} 
            />
          </Routes>
        </SignedIn>
      </Box>
    </ClerkProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <React.Suspense fallback={<LoadingFallback />}>
        <ClerkProviderWithRoutes />
      </React.Suspense>
    </BrowserRouter>
  );
}

export default App;