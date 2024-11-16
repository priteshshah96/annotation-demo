import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Container, 
  Typography, 
  Paper,
  CircularProgress,
  Divider,
  Box,
  Alert,
  Button
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

const FETCH_TIMEOUT = 8000;

const UserDashboard = () => {
  // Refs for cleanup
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);

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

  // Cleanup helper
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Navigation Handlers
  const handleNavigate = useCallback((path) => {
    if (mountedRef.current) {
      navigate(path);
    }
  }, [navigate]);

  // Sign Out Handler
  const handleSignOut = useCallback(async () => {
    try {
      cleanup();
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      // Force sign out on error
      signOut();
    }
  }, [signOut, cleanup]);

  // File Upload Handler
  const handleUpload = useCallback(async (file) => {
    if (isSyncing || isUploading) return;

    cleanup();
    abortControllerRef.current = new AbortController();

    try {
      setIsUploading(true);
      setError(null);

      // Setup timeout
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, FETCH_TIMEOUT);

      // Read and parse file
      const fileContent = await file.text();
      const parsedContent = JSON.parse(fileContent);

      // Upload file
      await fileApi.uploadFile({
        name: file.name,
        content: parsedContent
      }, { signal: abortControllerRef.current.signal });

      clearTimeout(timeoutId);

      if (mountedRef.current) {
        await fetchDashboardData();
        showSnackbar('File uploaded successfully', 'success');
      }
    } catch (error) {
      if (!mountedRef.current) return;

      console.error('Upload error:', error);
      if (error.name !== 'AbortError') {
        showSnackbar(error.message || 'Error uploading file', 'error');
      }
    } finally {
      if (mountedRef.current) {
        setIsUploading(false);
        abortControllerRef.current = null;
      }
    }
  }, [isSyncing, isUploading, showSnackbar, fetchDashboardData, cleanup]);

  // Menu Handlers
  const handleMenuOpen = useCallback((event, fileId) => {
    if (isSyncing) return;
    
    event.stopPropagation();
    setSelectedFileId(fileId);
    setMenuAnchorEl(event.currentTarget);
  }, [isSyncing]);

  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
    setSelectedFileId(null);
  }, []);

  // File Actions
  const handleDeleteFile = useCallback(async () => {
    if (isSyncing) return;

    cleanup();
    abortControllerRef.current = new AbortController();

    try {
      await fileApi.deleteFile(selectedFileId, { 
        signal: abortControllerRef.current.signal 
      });
      
      if (mountedRef.current) {
        await fetchDashboardData();
        showSnackbar('File deleted successfully', 'success');
      }
    } catch (error) {
      if (!mountedRef.current) return;
      
      if (error.name !== 'AbortError') {
        showSnackbar('Error deleting file', 'error');
      }
    } finally {
      if (mountedRef.current) {
        handleMenuClose();
        abortControllerRef.current = null;
      }
    }
  }, [selectedFileId, isSyncing, showSnackbar, handleMenuClose, fetchDashboardData, cleanup]);

  // Data Fetching
  const fetchDashboardData = useCallback(async () => {
    if (isSyncing || !mountedRef.current) return;

    cleanup();
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const [filesData, statsData] = await Promise.all([
        fileApi.getFiles({ signal: abortControllerRef.current.signal }),
        fileApi.getUserStats({ signal: abortControllerRef.current.signal })
      ]);

      if (mountedRef.current) {
        setFiles(filesData.files || []);
        setStats(statsData);
      }
    } catch (error) {
      if (!mountedRef.current) return;

      if (error.name !== 'AbortError') {
        console.error('Dashboard data fetch error:', error);
        setError('Error loading dashboard data');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [isSyncing, cleanup]);

  // Initial load effect
  useEffect(() => {
    if (isUserLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isUserLoaded, isSignedIn, navigate]);

  // Data loading effect
  useEffect(() => {
    if (isUserLoaded && isSignedIn && !isInitialSync && !isSyncing) {
      fetchDashboardData();
    }
  }, [isUserLoaded, isSignedIn, isInitialSync, isSyncing, fetchDashboardData]);

  // Cleanup effect
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

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

  if (syncError) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert 
            severity="error" 
            action={
              <Button color="inherit" size="small" onClick={() => syncUser()}>
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