import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import UserDashboard from './pages/UserDashboard';

const theme = createTheme({});

function App() {
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!clerkPubKey) {
    console.error('Missing Clerk Publishable Key');
    return (
      <div style={{ padding: 20, color: 'red' }}>
        Error: Missing VITE_CLERK_PUBLISHABLE_KEY environment variable
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            <Route 
              path="/sign-in" 
              element={<SignIn routing="path" path="/sign-in" />} 
            />
            <Route 
              path="/sign-up" 
              element={<SignUp routing="path" path="/sign-up" />} 
            />
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
            <Route 
              path="*" 
              element={<Navigate to="/" replace />} 
            />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </ClerkProvider>
  );
}

export default App;