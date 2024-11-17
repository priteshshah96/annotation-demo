import { useUser, useClerk, SignedIn, SignedOut, RedirectToSignIn, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Paper, 
  Box,
  Avatar,
  Button,
  CircularProgress,
  Alert,
  useTheme 
} from '@mui/material';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const UserDashboard = () => {
  const theme = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    const verifyConnection = async () => {
      try {
        setIsVerifying(true);
        // Try to sync the user - this will verify DB connection
        const response = await api.user.sync();
        console.log('Sync response:', response);
        setConnectionError(null);
      } catch (error) {
        console.error('Connection verification failed:', error);
        setConnectionError(error.message);
      } finally {
        setIsVerifying(false);
      }
    };

    if (user) {
      verifyConnection();
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Let Clerk handle the redirect
    } catch (error) {
      console.error('Sign out error:', error);
      navigate('/sign-in');
    }
  };

  return (
    <>
      <SignedIn>
        <Container maxWidth="lg">
          <Box sx={{ py: 4 }}>
            {isVerifying ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : connectionError ? (
              <Alert 
                severity="error" 
                sx={{ mb: 3 }}
                action={
                  <Button 
                    color="inherit" 
                    size="small"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </Button>
                }
              >
                {connectionError}
              </Alert>
            ) : null}

            <Paper 
              elevation={2}
              sx={{ 
                p: 3, 
                mb: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: isVerifying ? 0.7 : 1,
                transition: 'opacity 0.2s'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar 
                  src={user?.imageUrl}
                  alt={user?.firstName || user?.username}
                  sx={{ 
                    width: 48, 
                    height: 48,
                    border: `2px solid ${theme.palette.primary.main}`
                  }}
                >
                  {user?.firstName?.charAt(0) || user?.username?.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 500 }}>
                    Welcome, {user?.firstName || user?.username}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user?.primaryEmailAddress?.emailAddress}
                  </Typography>
                </Box>
              </Box>

              <Button
                variant="outlined"
                onClick={handleSignOut}
                startIcon={<LogoutOutlinedIcon />}
                disabled={isVerifying}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: theme.palette.error.lighter,
                    borderColor: theme.palette.error.main,
                    color: theme.palette.error.main
                  }
                }}
              >
                Sign Out
              </Button>
            </Paper>

            {/* Display connection status */}
            <Typography variant="body2" color="text.secondary" align="center">
              {isVerifying ? 'Verifying connection...' : 
               connectionError ? 'Connection failed' : 
               'Connected to database'}
            </Typography>
          </Box>
        </Container>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
};

export default UserDashboard;