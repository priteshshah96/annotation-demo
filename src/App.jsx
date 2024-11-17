import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import UserDashboard from './pages/UserDashboard';

const theme = createTheme({});

function App() {
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!clerkPubKey) {
    throw new Error("Missing Clerk Publishable Key");
  }

  return (
    <ClerkProvider 
      publishableKey={clerkPubKey}
      appearance={{
        elements: {
          formButtonPrimary: {
            fontSize: 14,
            textTransform: 'none',
            borderRadius: 6,
          },
          card: {
            borderRadius: 8,
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)'
          }
        }
      }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            <Route 
              path="/sign-in/*" 
              element={
                <SignIn 
                  routing="path" 
                  path="/sign-in"
                  afterSignInUrl="/dashboard"
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
                  afterSignUpUrl="/dashboard"
                  signInUrl="/sign-in"
                />
              } 
            />
            <Route 
              path="/dashboard"
              element={<UserDashboard />}
            />
            <Route 
              path="/" 
              element={<Navigate to="/dashboard" replace />}
            />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </ClerkProvider>
  );
}

export default App;