import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { SnackbarProvider } from 'notistack';
import AppRoutes from './routes';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <BrowserRouter>
        <SnackbarProvider maxSnack={3}>
          <AppRoutes />
        </SnackbarProvider>
      </BrowserRouter>
    </ClerkProvider>
  );
}

export default App;