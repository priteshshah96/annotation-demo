import { useUser, useClerk, SignedIn, useAuth } from '@clerk/clerk-react';
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
import { useApi } from '../hooks/useApi';

const UserDashboard = () => {
  const theme = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { api, isLoading: isApiLoading, error: apiError } = useApi();
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [connectionError, setConnectionError] = useState(null);

  // Verify connection and sync user
  useEffect(() => {
    const verifyConnection = async () => {
      try {
        const token = await getToken();
        if (!token) {
          navigate('/sign-in');
          return;
        }

        await api.user.sync();
        setConnectionError(null);
        setIsVerifying(false);
      } catch (error) {
        console.error('Connection verification failed:', error);
        setConnectionError(error.message);
        if (error.status === 401) {
          navigate('/sign-in');
        }
      }
    };

    verifyConnection();
  }, [api.user, getToken, navigate]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/sign-in');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (isVerifying) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (connectionError) {
    return (
      <Container>
        <Alert severity="error" sx={{ mt: 4 }}>
          {connectionError}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar src={user?.imageUrl} />
            <Typography variant="h4">
              Welcome, {user?.firstName}!
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<LogoutOutlinedIcon />}
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </Box>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Annotation Dashboard
          </Typography>
          <Typography>
            Start annotating your documents by uploading a file or selecting from your existing documents.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default UserDashboard;