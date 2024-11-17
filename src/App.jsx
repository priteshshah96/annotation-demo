import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { SnackbarProvider } from 'notistack';
import AppRoutes from './routes';
import { useEffect } from 'react';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

function AppContent() {
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    console.log('App Content Auth State:', { isSignedIn, isLoaded });
  }, [isSignedIn, isLoaded]);

  return <AppRoutes />;
}

function App() {
  return (
    <ClerkProvider 
      publishableKey={clerkPubKey}
      appearance={{
        variables: {
          colorPrimary: '#0070f3',
        },
      }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <BrowserRouter>
        <SnackbarProvider maxSnack={3}>
          <AppContent />
        </SnackbarProvider>
      </BrowserRouter>
    </ClerkProvider>
  );
}

export default App;