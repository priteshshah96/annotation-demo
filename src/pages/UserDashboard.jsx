// src/pages/UserDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Container, 
  Typography, 
  Paper,
  CircularProgress,
  Divider,
  Box,
  Alert
} from '@mui/material';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

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

const UserDashboard = () => {
  // Auth & Navigation
  const { user, isLoaded: isUserLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const { isInitialSync, isSyncing, error: syncError, syncUser } = useAuthSync();

  // State Management
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState({
    totalAnnotations: 0,
    completedFiles: 0,
    totalSentences: 0,
    totalEntities: 0,
    targetAnnotations: 0,
    totalFiles: 0,
    annotatedEntities: 0
  });
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [error, setError] = useState(null);

  // Custom Hooks
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Navigation Handlers
  const handleNavigate = (path) => {
    navigate(path);
  };

  // Sign Out Handler
  const handleSignOut = async () => {
    try {
      // Perform final sync before signing out
      await syncUser();
      await signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
      showSnackbar('Error syncing before sign out', 'error');
      // Sign out anyway
      await signOut();
    }
  };

  // File Upload Handler
  const handleUpload = async (file) => {
    if (isSyncing) {
      showSnackbar('Please wait for sync to complete', 'warning');
      return;
    }

    try {
      setIsUploading(true);
      
      // Read file content
      const fileContent = await file.text();
      const parsedContent = JSON.parse(fileContent);

      // Upload file
      await fileApi.uploadFile({
        name: file.name,
        content: parsedContent
      });

      await fetchDashboardData();
      showSnackbar('File uploaded successfully', 'success');
    } catch (error) {
      console.error('File upload error:', error);
      showSnackbar(error.message || 'Error uploading file', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Menu Handlers
  const handleMenuOpen = (event, fileId) => {
    if (isSyncing) {
      showSnackbar('Please wait for sync to complete', 'warning');
      return;
    }
    event.stopPropagation();
    setSelectedFileId(fileId);
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedFileId(null);
  };

  // File Actions
  const handleDeleteFile = async () => {
    if (isSyncing) {
      showSnackbar('Please wait for sync to complete', 'warning');
      return;
    }

    try {
      await fileApi.deleteFile(selectedFileId);
      await fetchDashboardData();
      showSnackbar('File deleted successfully', 'success');
    } catch (error) {
      showSnackbar('Error deleting file', 'error');
    }
    handleMenuClose();
  };

  const handleExportFile = async () => {
    if (isSyncing) {
      showSnackbar('Please wait for sync to complete', 'warning');
      return;
    }

    try {
      const response = await fileApi.getFile(selectedFileId);
      
      // Create and trigger download
      const blob = new Blob([JSON.stringify(response.file, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `annotations_${selectedFileId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSnackbar('Export successful', 'success');
    } catch (error) {
      showSnackbar('Error exporting file', 'error');
    }
    handleMenuClose();
  };

  const handleResetAnnotations = async () => {
    if (isSyncing) {
      showSnackbar('Please wait for sync to complete', 'warning');
      return;
    }

    try {
      handleNavigate(`/annotate/${selectedFileId}`);
      showSnackbar('Navigating to annotation page...', 'info');
    } catch (error) {
      showSnackbar('Error navigating to annotation page', 'error');
    }
    handleMenuClose();
  };

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
      setError('Error loading dashboard data');
      console.error('Dashboard data fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [isSyncing]);

  // Effects
  useEffect(() => {
    if (isUserLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isUserLoaded, isSignedIn, navigate]);

  useEffect(() => {
    if (isUserLoaded && isSignedIn && !isInitialSync && !isSyncing) {
      fetchDashboardData();
    }
  }, [isUserLoaded, isSignedIn, isInitialSync, isSyncing, fetchDashboardData]);

  // Loading States
  if (!isUserLoaded || isInitialSync) {
    return (
      <Container sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress />
      </Container>
    );
  }

  // Error States
  if (syncError) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert 
            severity="error" 
            action={
              <Button color="inherit" size="small" onClick={syncUser}>
                Retry
              </Button>
            }
          >
            {syncError}
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <DashboardHeader
        userName={user?.firstName || user?.username}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        avatarUrl={user?.imageUrl}
        onSignOut={handleSignOut}
        isSyncing={isSyncing}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <StatsPanel stats={stats} loading={loading || isSyncing} />

      <Paper elevation={3} sx={{ padding: 3 }}>
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