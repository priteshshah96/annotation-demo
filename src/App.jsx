import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { SnackbarProvider } from 'notistack';
import AppRoutes from './routes';
import { AuthProvider } from './components/providers/AuthProvider';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

function App() {
  return (
    <BrowserRouter>
      <ClerkProvider 
        publishableKey={clerkPubKey}
        navigate={(to) => window.location.href = to}
      >
        <SnackbarProvider maxSnack={3}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </SnackbarProvider>
      </ClerkProvider>
    </BrowserRouter>
  );
}

export default App;