import { useUser, useClerk, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Paper, 
  Box,
  Avatar,
  Button,
  useTheme 
} from '@mui/material';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';

const UserDashboard = () => {
  const theme = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      // Let Clerk handle the redirect
    } catch (error) {
      console.error('Sign out error:', error);
      // Fallback navigation if needed
      navigate('/sign-in');
    }
  };

  return (
    <>
      <SignedIn>
        <Container maxWidth="lg">
          {/* Your dashboard content */}
          <Box sx={{ py: 4 }}>
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
                onClick={handleSignOut}
                startIcon={<LogoutOutlinedIcon />}
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