import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { SnackbarProvider } from 'notistack';
import { ThemeProvider, createTheme } from '@mui/material';
import AppRoutes from './routes';
import AuthProvider from './components/providers/AuthProvider';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

// Create theme with clerk primary color
const theme = createTheme({
  palette: {
    primary: {
      main: '#0070f3', // Clerk's primary color
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <SnackbarProvider 
        maxSnack={3}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <ClerkProvider
          publishableKey={clerkPubKey}
          navigate={(to) => {
            window.history.pushState({}, '', to);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          appearance={{
            baseTheme: theme,
            elements: {
              formButtonPrimary: {
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'none',
                backgroundColor: 'var(--clerk-primary-color)',
                '&:hover': {
                  backgroundColor: 'var(--clerk-primary-color)',
                  opacity: 0.8
                }
              }
            }
          }}
        >
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </ClerkProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;