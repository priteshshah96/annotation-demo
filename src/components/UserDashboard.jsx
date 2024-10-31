// UserDashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  Button, 
  LinearProgress,
  Box,
  Chip,
  Card,
  CardContent,
  CircularProgress,
  Snackbar,
  Alert,
  Input,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate } from 'react-router-dom';
import {
  calculateTotalSteps,
  validateFileStructure,
  calculateStats,
  cleanupFileData,
  getStoredFiles,
  clearAnnotations,
  exportAnnotations
} from './dashboardHelpers';

const UserDashboard = () => {
  const [assignedFiles, setAssignedFiles] = useState([]);
  const [userStats, setUserStats] = useState({ 
    totalAnnotations: 0, 
    completedFiles: 0,
    totalSentences: 0,
    totalEntities: 0,
    completedAnnotations: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const navigate = useNavigate();

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setSnackbar({
        open: true,
        message: 'Please upload a JSON file',
        severity: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      if (!text.trim()) {
        throw new Error('File is empty');
      }

      const jsonData = JSON.parse(text);
      validateFileStructure(jsonData);

      const fileData = {
        id: `file-${Date.now()}`,
        name: file.name,
        abstracts: jsonData,
        progress: 0,
        uploadDate: new Date().toISOString(),
        totalSteps: calculateTotalSteps({ abstracts: jsonData })
      };
      
      localStorage.setItem(`file-data-${fileData.id}`, JSON.stringify(fileData));
      
      // Update UI
      setAssignedFiles(prev => [...prev, fileData]);
      const newStats = calculateStats();
      setUserStats(newStats);
      
      // Clear the file input
      event.target.value = null;

      setSnackbar({
        open: true,
        message: 'File uploaded successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error processing file:', error);
      setSnackbar({
        open: true,
        message: `Error: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event, fileId) => {
    event.stopPropagation();
    setSelectedFileId(fileId);
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedFileId(null);
  };

  const handleDeleteFile = async (fileId, event) => {
    event.stopPropagation();
    
    try {
      await cleanupFileData(fileId);
      setAssignedFiles(prev => prev.filter(file => file.id !== fileId));
      
      // Update stats immediately
      const newStats = calculateStats();
      setUserStats(newStats);
      
      setSnackbar({
        open: true,
        message: 'File and associated annotations deleted',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error deleting file',
        severity: 'error'
      });
    }
    handleMenuClose();
  };

  const handleReannotate = async (fileId) => {
    try {
      await clearAnnotations(fileId);
      refreshData();
      
      setSnackbar({
        open: true,
        message: 'Annotations cleared. You can now re-annotate the file.',
        severity: 'success'
      });

      navigate(`/annotate/${fileId}`);
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error clearing annotations',
        severity: 'error'
      });
    }
    handleMenuClose();
  };

  const handleExport = async (fileId) => {
    try {
      const { data, filename } = await exportAnnotations(fileId);
      
      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSnackbar({
        open: true,
        message: 'Annotations exported successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error exporting annotations:', error);
      setSnackbar({
        open: true,
        message: 'Error exporting annotations',
        severity: 'error'
      });
    }
    handleMenuClose();
  };

  const handleAnnotate = (fileId) => {
    navigate(`/annotate/${fileId}`);
  };

  const refreshData = () => {
    const storedFiles = getStoredFiles();
    setAssignedFiles(storedFiles);
    const newStats = calculateStats();
    setUserStats(newStats);
  };

  useEffect(() => {
    refreshData();
    
    const handleStorageChange = (e) => {
      if (e.key && (e.key.startsWith('file-data-') || e.key.startsWith('annotation-'))) {
        refreshData();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 4 }}>
        Annotation Dashboard
      </Typography>
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 4 }}>
        <Card sx={{ flexGrow: 1, minWidth: '200px' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6">Total Annotations</Typography>
              <Tooltip title="Number of completed annotations across all files">
                <InfoIcon fontSize="small" color="action" />
              </Tooltip>
            </Box>
            <Typography variant="h4">{userStats.totalAnnotations}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flexGrow: 1, minWidth: '200px' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6">Completed Files</Typography>
              <Tooltip title="Files with 100% completion">
                <InfoIcon fontSize="small" color="action" />
              </Tooltip>
            </Box>
            <Typography variant="h4">{userStats.completedFiles}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flexGrow: 1, minWidth: '200px' }}>
          <CardContent>
            <Typography variant="h6">Total Sentences</Typography>
            <Typography variant="h4">{userStats.totalSentences}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flexGrow: 1, minWidth: '200px' }}>
          <CardContent>
            <Typography variant="h6">Total Entities</Typography>
            <Typography variant="h4">{userStats.totalEntities}</Typography>
          </CardContent>
        </Card>
      </Box>

      <Paper elevation={3} sx={{ padding: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5">
            Upload New File
          </Typography>
        </Box>
        <Box sx={{ mb: 4 }}>
          <Input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            sx={{ mb: 2 }}
            fullWidth
            disabled={loading}
          />
          <Typography variant="body2" color="text.secondary">
            Upload a JSON file containing abstracts and sentences for annotation
          </Typography>
        </Box>

        <Typography variant="h5" sx={{ mb: 2 }}>
          Your Files
        </Typography>
        
        {loading && <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {assignedFiles.length > 0 ? (
          <List>
            {assignedFiles.map((file) => (
              <ListItem 
                key={file.id} 
                divider 
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
                onClick={() => handleAnnotate(file.id)}
              >
                <ListItemText 
                  primary={
                    <Typography variant="subtitle1">
                      {file.name}
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        (Uploaded: {new Date(file.uploadDate).toLocaleDateString()})
                      </Typography>
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Progress: {file.progress?.toFixed(1) || 0}%
                        {file.progress === 100 && (
                          <Tooltip title="All annotations completed">
                            <InfoIcon fontSize="small" color="success" />
                          </Tooltip>
                        )}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={file.progress || 0} 
                        sx={{ 
                          mt: 1,
                          height: 8,
                          borderRadius: 1,
                          bgcolor: 'rgba(0, 0, 0, 0.1)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 1,
                            bgcolor: file.progress === 100 ? 'success.main' : 'primary.main'
                          }
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Total Items: {file.totalSteps} | Completed: {Math.round((file.progress * file.totalSteps) / 100)}
                      </Typography>
                    </Box>
                  }
                />
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip 
                    label={file.progress === 100 ? 'Completed' : 'In Progress'} 
                    color={file.progress === 100 ? 'success' : 'primary'} 
                    variant={file.progress === 100 ? 'filled' : 'outlined'}
                    sx={{ minWidth: 100 }}
                  />
                  
                  <IconButton
                    onClick={(e) => handleMenuOpen(e, file.id)}
                    size="small"
                    sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <MoreVertIcon />
                  </IconButton>

                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAnnotate(file.id);
                    }}
                    sx={{ 
                      minWidth: 100,
                      bgcolor: file.progress === 100 ? 'success.main' : 'primary.main',
                      '&:hover': {
                        bgcolor: file.progress === 100 ? 'success.dark' : 'primary.dark'
                      }
                    }}
                  >
                    {file.progress === 100 ? 'View' : 'Annotate'}
                  </Button>
                </Box>
              </ListItem>
            ))}
          </List>
        ) : (
          <Box 
            sx={{ 
              textAlign: 'center', 
              py: 6,
              bgcolor: 'grey.50',
              borderRadius: 2,
              border: '2px dashed',
              borderColor: 'grey.300'
            }}
          >
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Files Available
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Upload a JSON file to begin annotation.
            </Typography>
          </Box>
        )}
      </Paper>
      
      {/* File actions menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem 
          onClick={() => handleReannotate(selectedFileId)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <RefreshIcon fontSize="small" />
          Re-annotate
        </MenuItem>
        <MenuItem 
          onClick={() => handleExport(selectedFileId)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <DownloadIcon fontSize="small" />
          Export Annotations
        </MenuItem>
        <MenuItem 
          onClick={(e) => handleDeleteFile(selectedFileId, e)}
          sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <DeleteIcon fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          elevation={6}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default UserDashboard;