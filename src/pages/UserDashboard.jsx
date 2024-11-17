import { useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Paper, 
  Box,
  Avatar,
  Button,
  CircularProgress
} from '@mui/material';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useAuth } from '../components/providers/AuthProvider';
import { useSnackbar } from 'notistack';
import FileList from '../components/FileList';

const UserDashboard = () => {
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const { user, files, isLoading, refreshUserData } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const handleSignOut = async () => {
    try {
      await signOut();
      // Let ClerkProvider handle the navigation
    } catch (error) {
      console.error('Sign out error:', error);
      enqueueSnackbar('Error signing out. Please try again.', { 
        variant: 'error'
      });
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar src={user?.imageUrl} />
            <Typography variant="h4">
              Welcome, {user?.firstName || 'User'}!
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
            Your Files
          </Typography>
          <FileList 
            files={files} 
            onRefresh={refreshUserData}
            onNavigate={(path) => navigate(path)}
          />
        </Paper>
      </Box>
    </Container>
  );
};

export default UserDashboard;