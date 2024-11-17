import React from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { 
  Container, 
  Typography, 
  Paper, 
  Box,
  Avatar,
  Button,
  IconButton,
  useTheme
} from '@mui/material';
import { LogoutOutlined as LogoutIcon } from '@mui/icons-material';

const UserDashboard = () => {
  const theme = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Paper 
          elevation={2}
          sx={{ 
            p: 3, 
            mb: 4,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
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
            color="primary"
            onClick={handleSignOut}
            startIcon={<LogoutIcon />}
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

        {/* Dashboard Content */}
        <Paper 
          elevation={1}
          sx={{ 
            p: 3,
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography variant="h6" gutterBottom>
            Dashboard Content
          </Typography>
          <Typography color="text.secondary">
            Your dashboard content will appear here
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default UserDashboard;