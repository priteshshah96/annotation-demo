import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { dark } from '@clerk/themes';
import UserDashboard from './pages/UserDashboard';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error("Missing Clerk Publishable Key");
}

function App() {
  return (
    <ClerkProvider 
      publishableKey={clerkPubKey}
      appearance={{
        baseTheme: dark,
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
              element={<SignIn routing="path" redirectUrl={'/protected'} />}
            />
            <Route 
              path="/sign-up/*" 
              element={<SignUp routing="path" redirectUrl={'/protected'}  />}
            />
            <Route 
              path="/protected" 
              element={<UserDashboard />}
            />
            <Route 
              path="/" 
              element={<UserDashboard />}
            />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </ClerkProvider>
  );
}

export default App;