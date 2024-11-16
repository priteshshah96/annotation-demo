import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';
import { CircularProgress, Box } from '@mui/material';
import AuthProvider from './components/AuthProvider';

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
    console.error('Missing Clerk Publishable Key');
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        Configuration Error: Missing Clerk Key
      </Box>
    );
  }

  return (
    <BrowserRouter>
      <ClerkProvider publishableKey={publishableKey}>
        <AuthProvider>
          <React.Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/sign-in" element={<Navigate to="/sign-in" />} />
              <Route path="/sign-up" element={<Navigate to="/sign-up" />} />
              
              {/* Protected Routes */}
              <Route path="/" element={<UserDashboard />} />
              <Route path="/file/:fileId" element={<UserAnnotationDashboard mode="view" />} />
              <Route path="/annotate/:fileId" element={<UserAnnotationDashboard mode="edit" />} />
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </React.Suspense>
        </AuthProvider>
      </ClerkProvider>
    </BrowserRouter>
  );
}

export default App;