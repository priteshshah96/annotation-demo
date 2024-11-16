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
  const isProduction = process.env.NODE_ENV === 'production';

  if (!publishableKey && isProduction) {
    console.error('Missing Clerk publishable key');
    return (
      <Box sx={{ p: 4 }}>
        Error: Missing authentication configuration.
      </Box>
    );
  }

  return (
    <BrowserRouter>
      {isProduction && publishableKey ? (
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

              {/* Catch-all redirect to sign-in */}
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
      ) : (
        // For non-production or missing publishableKey: bypass authentication
        <React.Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Routes without authentication */}
            <Route path="/" element={<UserDashboard />} />
            <Route path="/file/:fileId" element={<UserAnnotationDashboard mode="view" />} />
            <Route path="/annotate/:fileId" element={<UserAnnotationDashboard mode="edit" />} />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </React.Suspense>
      )}
    </BrowserRouter>
  );
}

export default App;
