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
import { useApi } from '../hooks/useApi';
import FileList from '../components/dashboard/FileList';
import FileUploader from '../components/dashboard/FileUploader';
import StatsPanel from '../components/dashboard/StatsPanel';
import DashboardHeader from '../components/dashboard/DashboardHeader';

const UserDashboard = () => {
  const theme = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const { api, isLoading: isApiLoading, error: apiError } = useApi();
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState({
    totalAnnotations: 0,
    completedFiles: 0,
    totalFiles: 0,
    totalSentences: 0,
    totalEntities: 0,
    targetAnnotations: 0,
    annotatedEntities: 0
  });

  // Verify connection and sync user
  useEffect(() => {
    const verifyConnection = async () => {
      try {
        setIsVerifying(true);
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
  }, [user, api.user]);

  // Fetch files and stats
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Only fetch if user is synced
        if (!isVerifying && !connectionError) {
          const [filesResponse, statsResponse] = await Promise.all([
            api.files.getAll(),
            api.files.getUserStats()
          ]);

          if (filesResponse.success) {
            setFiles(filesResponse.files);
          }
          if (statsResponse) {
            setStats(statsResponse);
          }
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setConnectionError(error.message);
      }
    };

    fetchData();
  }, [isVerifying, connectionError, api.files]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      navigate('/sign-in');
    }
  };

  const handleFileUpload = async (file) => {
    try {
      const response = await api.files.upload(file);
      if (response.success) {
        // Refresh files list
        const filesResponse = await api.files.getAll();
        if (filesResponse.success) {
          setFiles(filesResponse.files);
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
      setConnectionError(error.message);
    }
  };

  const handleFileAction = async (fileId, action) => {
    try {
      switch (action) {
        case 'delete':
          await api.files.delete(fileId);
          setFiles(files.filter(f => f._id !== fileId));
          break;
        case 'navigate':
          navigate(`/annotate/${fileId}`);
          break;
        // Add other actions as needed
      }
    } catch (error) {
      console.error('File action error:', error);
      setConnectionError(error.message);
    }
  };

  return (
    <SignedIn>
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          {/* Header */}
          <DashboardHeader
            userName={user?.firstName || user?.username}
            userEmail={user?.primaryEmailAddress?.emailAddress}
            avatarUrl={user?.imageUrl}
            onSignOut={handleSignOut}
          />

          {/* Loading State */}
          {(isVerifying || isApiLoading) && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Error State */}
          {(connectionError || apiError) && (
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
              {connectionError || apiError}
            </Alert>
          )}

          {/* Dashboard Content */}
          {!isVerifying && !connectionError && (
            <>
              {/* Stats Panel */}
              <StatsPanel stats={stats} loading={isApiLoading} />

              {/* File Uploader */}
              <FileUploader onUpload={handleFileUpload} />

              {/* Files List */}
              <FileList
                files={files}
                onNavigate={(fileId) => handleFileAction(fileId, 'navigate')}
                onDelete={(fileId) => handleFileAction(fileId, 'delete')}
                loading={isApiLoading}
                error={apiError}
              />
            </>
          )}
        </Box>
      </Container>
    </SignedIn>
  );
};

export default UserDashboard;