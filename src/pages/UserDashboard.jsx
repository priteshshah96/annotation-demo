import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  CircularProgress,
  Divider
} from '@mui/material';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

// Components
import DashboardHeader from '../components/dashboard/DashboardHeader';
import StatsPanel from '../components/dashboard/StatsPanel';
import FileUploader from '../components/dashboard/FileUploader';
import FileList from '../components/dashboard/FileList';
import FileActionsMenu from '../components/dashboard/FileActionsMenu';

// Services & Utilities
import { fileApi } from '../services/fileApi';
import { useSnackbar } from '../hooks/useSnackbar';

const UserDashboard = () => {
  // Auth & Navigation
  const { user, isLoaded: isUserLoaded, isSignedIn } = useUser();
  const { userId } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  // State Management
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  // Custom Hooks
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Navigation Handlers
  const handleNavigate = (path) => {
    navigate(path);
  };

  // File Upload Handler
  const handleUpload = async (data) => {
    try {
      setIsUploading(true);
      await fileApi.uploadFile(data);
      await fetchDashboardData(); // Refresh the file list after upload
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
    try {
      await fileApi.deleteFile(selectedFileId);
      await fetchDashboardData(); // Refresh the file list after deletion
      showSnackbar('File deleted successfully', 'success');
    } catch (error) {
      showSnackbar('Error deleting file', 'error');
    }
    handleMenuClose();
  };

  const handleExportFile = async () => {
    try {
      const response = await fileApi.getFile(selectedFileId);
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
    try {
      handleNavigate(`/annotate/${selectedFileId}`);
      showSnackbar('Navigating to annotation page...', 'info');
    } catch (error) {
      showSnackbar('Error navigating to annotation page', 'error');
    }
    handleMenuClose();
  };

  // Data Fetching
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fileApi.getFiles();
      const filesWithData = response.files?.map(file => ({
        ...file,
        abstracts: file.abstracts || [],
        progress: file.progress || 0
      })) || [];
      setFiles(filesWithData);
    } catch (error) {
      showSnackbar('Error loading dashboard data', 'error');
      console.error('Dashboard data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    if (isUserLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isUserLoaded, isSignedIn, navigate]);

  useEffect(() => {
    if (isUserLoaded && isSignedIn) {
      fetchDashboardData();

      const handleAnnotationUpdate = () => {
        fetchDashboardData();
      };

      window.addEventListener('annotationUpdate', handleAnnotationUpdate);
      return () => {
        window.removeEventListener('annotationUpdate', handleAnnotationUpdate);
      };
    }
  }, [isUserLoaded, isSignedIn]);

  // Loading State
  if (!isUserLoaded || loading) {
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

  return (
    <Container maxWidth="lg">
      <DashboardHeader
        userName={user?.firstName || user?.username}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        avatarUrl={user?.imageUrl}
        onSignOut={signOut}
      />

      <StatsPanel files={files} loading={loading} />

      <Paper elevation={3} sx={{ padding: 3 }}>
        <FileUploader
          onUpload={handleUpload}
          isUploading={isUploading}
          userId={userId} // Pass userId to FileUploader
        />

        <Divider sx={{ my: 3 }} />

        <FileList
          files={files}
          onMenuOpen={handleMenuOpen}
          onNavigate={handleNavigate}
          selectedFileId={selectedFileId}
          loading={loading}
          userId={userId} // Pass userId to FileList
        />

        <FileActionsMenu
          anchorEl={menuAnchorEl}
          onClose={handleMenuClose}
          onDelete={handleDeleteFile}
          onExport={handleExportFile}
          onReset={handleResetAnnotations}
          onNavigate={handleNavigate}
          file={files.find(f => f._id === selectedFileId)}
          disabledActions={!selectedFileId ? ['export', 'delete', 'reset', 'view'] : []}
        />
      </Paper>

      {SnackbarComponent}
    </Container>
  );
};

export default UserDashboard;