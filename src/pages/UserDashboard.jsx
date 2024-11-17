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
import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import FileList from '../components/dashboard/FileList';
import FileUploader from '../components/dashboard/FileUploader';
import StatsPanel from '../components/dashboard/StatsPanel';
import DashboardHeader from '../components/dashboard/DashboardHeader';

const UserDashboard = () => {
  const theme = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
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
    let mounted = true;
    const verifyConnection = async () => {
      try {
        setIsVerifying(true);
        setConnectionError(null);

        const token = await getToken();
        if (!token) {
          throw new Error('Authentication required');
        }

        const response = await api.user.sync();
        console.log('Sync response:', response);

        if (mounted && response.success) {
          setConnectionError(null);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Connection verification failed:', error);
        if (mounted) {
          setConnectionError(error.message);
          if (error.message.includes('authentication') || error.status === 401) {
            navigate('/sign-in');
          }
        }
        return false;
      } finally {
        if (mounted) {
          setIsVerifying(false);
        }
      }
    };

    if (user?.id) {
      verifyConnection();
    }

    return () => {
      mounted = false;
    };
  }, [user?.id, api.user, getToken, navigate]);

  // Fetch files and stats
  const fetchDashboardData = useCallback(async () => {
    if (isVerifying || connectionError) return;

    try {
      const [filesResponse, statsResponse] = await Promise.all([
        api.files.getAll(),
        api.files.getUserStats()
      ]);

      if (filesResponse.success) {
        setFiles(filesResponse.files || []);
      }
      if (statsResponse.success) {
        setStats(statsResponse.data || stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setConnectionError(error.message);
      if (error.status === 401) {
        navigate('/sign-in');
      }
    }
  }, [isVerifying, connectionError, api.files, navigate, stats]);

  useEffect(() => {
    if (!isVerifying && !connectionError) {
      fetchDashboardData();
    }
  }, [isVerifying, connectionError, fetchDashboardData]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/sign-in');
    } catch (error) {
      console.error('Sign out error:', error);
      navigate('/sign-in');
    }
  };

  const handleFileUpload = async (file) => {
    try {
      const response = await api.files.upload(file);
      if (response.success) {
        await fetchDashboardData();
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
          const response = await api.files.delete(fileId);
          if (response.success) {
            setFiles(files.filter(f => f._id !== fileId));
            await fetchDashboardData();
          }
          break;
        case 'navigate':
          navigate(`/annotate/${fileId}`);
          break;
      }
    } catch (error) {
      console.error('File action error:', error);
      setConnectionError(error.message);
    }
  };

  if (!user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <SignedIn>
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <DashboardHeader
            userName={user?.firstName || user?.username}
            userEmail={user?.primaryEmailAddress?.emailAddress}
            avatarUrl={user?.imageUrl}
            onSignOut={handleSignOut}
          />

          {/* Error Display */}
          {connectionError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {connectionError}
            </Alert>
          )}

          {/* Loading State */}
          {(isVerifying || isApiLoading) ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <StatsPanel stats={stats} />
              <Box sx={{ mt: 4 }}>
                <FileUploader onUpload={handleFileUpload} />
              </Box>
              <Box sx={{ mt: 4 }}>
                <FileList 
                  files={files} 
                  onAction={handleFileAction}
                  loading={isApiLoading}
                />
              </Box>
            </>
          )}
        </Box>
      </Container>
    </SignedIn>
  );
};

export default UserDashboard;