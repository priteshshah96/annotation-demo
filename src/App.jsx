import React from 'react';
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';
import { CircularProgress, Box } from '@mui/material';

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

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  return (
    <>
      <SignedIn>
        {children}
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
};

function ClerkProviderWithRoutes() {
  console.log('Clerk Key:', import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? 'Present' : 'Missing');
  
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <Box sx={{ minHeight: '100vh' }}>
        <Routes>
          {/* Public routes */}
          <Route
            path="/sign-in/*"
            element={<SignIn routing="path" signUpUrl="/sign-up" afterSignInUrl="/" />}
          />
          <Route
            path="/sign-up/*"
            element={<SignUp routing="path" signInUrl="/sign-in" afterSignUpUrl="/" />}
          />
          
          {/* Protected routes */}
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
          
          {/* Catch-all route */}
          <Route
            path="*"
            element={<RedirectToSignIn />}
          />
        </Routes>
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