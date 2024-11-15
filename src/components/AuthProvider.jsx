import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Container, 
  Typography, 
  Paper,
  CircularProgress,
  Divider,
  Box,
  Alert,
  Button,
  useTheme
} from '@mui/material';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import debounce from 'lodash/debounce';

// Components
import DashboardHeader from '../components/dashboard/DashboardHeader';
import StatsPanel from '../components/dashboard/StatsPanel';
import FileUploader from '../components/dashboard/FileUploader';
import FilesList from '../components/dashboard/FileList';
import FileActionsMenu from '../components/dashboard/FileActionsMenu';

// Services & Utilities
import { fileApi } from '../services/fileApi';
import { useSnackbar } from '../hooks/useSnackbar';
import { useAuthSync } from '../hooks/useAuthSync';

// Constants
const DEFAULT_STATS = {
  totalAnnotations: 0,
  completedFiles: 0,
  totalSentences: 0,
  totalEntities: 0,
  targetAnnotations: 0,
  totalFiles: 0,
  annotatedEntities: 0
};

const LoadingView = () => (
  <Container sx={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh' 
  }}>
    <CircularProgress />
  </Container>
);

const ErrorView = ({ error, onRetry }) => (
  <Container maxWidth="lg">
    <Box sx={{ mt: 4 }}>
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    </Box>
  </Container>
);

const UserDashboard = () => {
  const theme = useTheme();
  
  // Auth & Navigation
  const { user, isLoaded: isUserLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const { isInitialSync, isSyncing, error: syncError, syncUser } = useAuthSync();

  // State Management
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [error, setError] = useState(null);

  // Custom Hooks
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Memoized Values
  const currentUser = useMemo(() => ({
    name: user?.firstName || user?.username,
    email: user?.emailAddresses?.[0]?.emailAddress,
    avatar: user?.imageUrl
  }), [user]);

  // Navigation Handler
  const handleNavigate = useCallback((path) => {
    navigate(path);
  }, [navigate]);

  // Sign Out Handler
  const handleSignOut = useCallback(async () => {
    try {
      await syncUser();
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      showSnackbar('Error syncing before sign out', 'error');
      await signOut();
    }
  }, [syncUser, signOut, showSnackbar]);

  // File Upload Handler
  const handleUpload = useCallback(async (file) => {
    if (isSyncing) {
      showSnackbar('Please wait for sync to complete', 'warning');
      return;
    }

    try {
      setIsUploading(true);
      const fileContent = await file.text();
      const parsedContent = JSON.parse(fileContent);

      await fileApi.uploadFile({
        name: file.name,
        content: parsedContent
      });

      await fetchDashboardData();
      showSnackbar('File uploaded successfully', 'success');
    } catch (error) {
      console.error('Upload error:', error);
      showSnackbar(error.message || 'Error uploading file', 'error');
    } finally {
      setIsUploading(false);
    }
  }, [isSyncing, showSnackbar]);

  // Menu Handlers
  const handleMenuOpen = useCallback(
    debounce((event, fileId) => {
      if (isSyncing) {
        showSnackbar('Please wait for sync to complete', 'warning');
        return;
      }
      event.stopPropagation();
      setSelectedFileId(fileId);
      setMenuAnchorEl(event.currentTarget);
    }, 300),
    [isSyncing, showSnackbar]
  );

  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
    setSelectedFileId(null);
  }, []);

  // File Actions
  const handleDeleteFile = useCallback(async () => {
    if (isSyncing) {
      showSnackbar('Please wait for sync to complete', 'warning');
      return;
    }

    try {
      await fileApi.deleteFile(selectedFileId);
      await fetchDashboardData();
      showSnackbar('File deleted successfully', 'success');
    } catch (error) {
      console.error('Delete error:', error);
      showSnackbar('Error deleting file', 'error');
    }
    handleMenuClose();
  }, [selectedFileId, isSyncing, showSnackbar, handleMenuClose]);

  const handleExportFile = useCallback(async () => {
    if (isSyncing) {
      showSnackbar('Please wait for sync to complete', 'warning');
      return;
    }

    try {
      const response = await fileApi.getFile(selectedFileId);
      const blob = new Blob([JSON.stringify(response.file, null, 2)], {
        type: 'application/json'
      });
      
      // Use URL.createObjectURL safely
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `annotations_${selectedFileId}.json`;
      link.click();
      URL.revokeObjectURL(url); // Clean up

      showSnackbar('Export successful', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showSnackbar('Error exporting file', 'error');
    }
    handleMenuClose();
  }, [selectedFileId, isSyncing, showSnackbar, handleMenuClose]);

  const handleResetAnnotations = useCallback(() => {
    if (isSyncing) {
      showSnackbar('Please wait for sync to complete', 'warning');
      return;
    }

    try {
      handleNavigate(`/annotate/${selectedFileId}`);
      showSnackbar('Navigating to annotation page...', 'info');
    } catch (error) {
      console.error('Navigation error:', error);
      showSnackbar('Error navigating to annotation page', 'error');
    }
    handleMenuClose();
  }, [selectedFileId, isSyncing, showSnackbar, handleNavigate, handleMenuClose]);

  // Data Fetching
  const fetchDashboardData = useCallback(async () => {
    if (isSyncing) return;

    try {
      setLoading(true);
      setError(null);

      const [filesData, statsData] = await Promise.all([
        fileApi.getFiles(),
        fileApi.getUserStats()
      ]);

      setFiles(filesData.files || []);
      setStats(statsData);
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      setError('Error loading dashboard data');
      showSnackbar('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [isSyncing, showSnackbar]);

  // Effects
  useEffect(() => {
    if (isUserLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isUserLoaded, isSignedIn, navigate]);

  useEffect(() => {
    let mounted = true;

    if (isUserLoaded && isSignedIn && !isInitialSync && !isSyncing) {
      fetchDashboardData();
    }

    return () => {
      mounted = false;
    };
  }, [isUserLoaded, isSignedIn, isInitialSync, isSyncing, fetchDashboardData]);

  // Render Loading State
  if (!isUserLoaded || isInitialSync) {
    return <LoadingView />;
  }

  // Render Error State
  if (syncError) {
    return <ErrorView error={syncError} onRetry={syncUser} />;
  }

  return (
    <Container maxWidth="lg">
      <DashboardHeader
        userName={currentUser.name}
        userEmail={currentUser.email}
        avatarUrl={currentUser.avatar}
        onSignOut={handleSignOut}
        isSyncing={isSyncing}
      />

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <StatsPanel stats={stats} loading={loading || isSyncing} />

      <Paper 
        elevation={3} 
        sx={{ 
          padding: 3,
          backgroundColor: theme.palette.background.paper,
          transition: 'all 0.3s ease-in-out'
        }}
      >
        <FileUploader
          onUpload={handleUpload}
          isUploading={isUploading}
          disabled={isSyncing}
        />

        <Divider sx={{ my: 3 }} />

        <FilesList
          files={files}
          onMenuOpen={handleMenuOpen}
          onNavigate={handleNavigate}
          selectedFileId={selectedFileId}
          loading={loading}
          disabled={isSyncing}
        />

        <FileActionsMenu
          anchorEl={menuAnchorEl}
          onClose={handleMenuClose}
          onDelete={handleDeleteFile}
          onExport={handleExportFile}
          onReset={handleResetAnnotations}
          onNavigate={handleNavigate}
          file={files.find(f => f._id === selectedFileId)}
          disabledActions={!selectedFileId || isSyncing ? 
            ['export', 'delete', 'reset', 'view'] : 
            []
          }
        />
      </Paper>

      {SnackbarComponent}
    </Container>
  );
};

export default UserDashboard;