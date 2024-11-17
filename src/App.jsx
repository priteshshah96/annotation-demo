import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import AuthProvider from './providers/AuthProvider';
import UserDashboard from './pages/UserDashboard';

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
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Auth Routes */}
              <Route 
                path="/sign-in" 
                element={
                  <SignedOut>
                    <SignIn 
                      appearance={{ 
                        layout: { socialButtonsPlacement: "bottom" }
                      }}
                      redirectUrl="/"
                      routing="path"
                    />
                  </SignedOut>
                } 
              />
              <Route 
                path="/sign-up" 
                element={
                  <SignedOut>
                    <SignUp 
                      appearance={{ 
                        layout: { socialButtonsPlacement: "bottom" }
                      }}
                      redirectUrl="/"
                      routing="path"
                    />
                  </SignedOut>
                } 
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

              {/* Catch-all redirect */}
              <Route
                path="*"
                element={<Navigate to="/" replace />}
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ClerkProvider>
  );
}

export default App;