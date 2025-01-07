import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  List,
  ListItem,
  Box,
  Typography,
  Chip,
  IconButton,
  Button,
  LinearProgress,
  Tooltip,
  Fade,
  Paper,
  useTheme
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  PlayArrow as StartIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import FileUploader from './FileUploader'; // Import FileUploader
import { fileApi } from '../../services/fileApi'; // Import fileApi

const FileListItem = ({ 
  file, 
  onNavigate, 
  onMenuOpen, 
  isSelected,
  showProgress = true 
}) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (progress) => {
    if (progress === 100) return theme.palette.success.main;
    if (progress > 0) return theme.palette.primary.main;
    return theme.palette.grey[500];
  };

  // Calculate counts
  const abstractCount = file.abstracts?.length || 0;
  const eventCount = file.abstracts?.reduce((total, abstract) => {
    return total + (abstract.events?.length || 0);
  }, 0) || 0;

  // Calculate progress dynamically
  const completedSteps = file.annotations ? Object.keys(file.annotations).length : 0;
  const progress = file.totalSteps > 0 ? Math.round((completedSteps / file.totalSteps) * 100) : 0;

  return (
    <Paper
      elevation={isHovered ? 2 : 0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        mb: 1,
        transition: 'all 0.2s ease-in-out',
        borderRadius: 1,
        border: 1,
        borderColor: isHovered ? 'primary.main' : 'divider',
        bgcolor: isSelected ? 'action.selected' : 'background.paper',
      }}
    >
      <ListItem sx={{ px: 2, py: 1.5 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {/* File Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              {file.name}
            </Typography>
            <Chip
              label={progress === 100 ? 'Completed' : 'In Progress'}
              color={progress === 100 ? 'success' : 'primary'}
              size="small"
              variant={progress === 100 ? 'filled' : 'outlined'}
            />
          </Box>
          
          {/* File Stats */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'text.secondary' }}>
            {abstractCount > 0 && (
              <Typography variant="caption">
                {`${abstractCount} Abstract${abstractCount !== 1 ? 's' : ''}`}
              </Typography>
            )}
            {eventCount > 0 && (
              <Typography variant="caption">
                {`${eventCount} Event${eventCount !== 1 ? 's' : ''}`}
              </Typography>
            )}
            <Typography variant="caption">
              Uploaded: {formatDate(file.uploadDate)}
            </Typography>
          </Box>

          {/* Progress Bar */}
          {showProgress && (
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flexGrow: 1, maxWidth: '300px' }}>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: `${getStatusColor(progress)}15`,
                    '& .MuiLinearProgress-bar': {
                      bgcolor: getStatusColor(progress)
                    }
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: getStatusColor(progress) }}>
                {Math.round(progress)}%
              </Typography>
            </Box>
          )}
        </Box>

        {/* Action Buttons */}
        <Fade in={isHovered || isSelected}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={progress === 100 ? "View Annotations" : "Continue Annotating"}>
              <Button
                variant="contained"
                size="small"
                onClick={() => onNavigate(`/annotate/${file._id}`)}
                startIcon={progress === 100 ? <ViewIcon /> : <StartIcon />}
                sx={{
                  minWidth: 100,
                  bgcolor: progress === 100 ? 'success.main' : 'primary.main',
                  '&:hover': {
                    bgcolor: progress === 100 ? 'success.dark' : 'primary.dark'
                  }
                }}
              >
                {progress === 100 ? 'View' : 'Annotate'}
              </Button>
            </Tooltip>

            <IconButton
              size="small"
              onClick={(e) => onMenuOpen(e, file._id)}
              sx={{
                color: 'action.active',
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <MoreIcon />
            </IconButton>
          </Box>
        </Fade>
      </ListItem>
    </Paper>
  );
};

const FileList = ({
  files,
  onNavigate,
  onMenuOpen,
  loading = false,
  error = null,
  selectedFileId = null,
  userId // Add userId prop
}) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (data) => {
    try {
      setIsUploading(true);
      await fileApi.uploadFile({
        ...data,
        userId // Ensure userId is passed
      });
      onNavigate('/'); // Navigate back to the dashboard after upload
    } catch (error) {
      console.error('File upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, color: 'text.secondary' }}>
          Loading files...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'error.main' }}>
        <Typography variant="subtitle1" gutterBottom>
          Error loading files
        </Typography>
        <Typography variant="body2">
          {error}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => window.location.reload()}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  if (!files?.length) {
    return (
      <Box sx={{ 
        textAlign: 'center', 
        py: 6,
        bgcolor: 'grey.50',
        borderRadius: 2,
        border: '2px dashed',
        borderColor: 'grey.300'
      }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Files Available
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Upload a JSON file to begin annotation.
        </Typography>
        <FileUploader
          onUpload={handleUpload}
          isUploading={isUploading}
          userId={userId}
        />
      </Box>
    );
  }

  return (
    <List sx={{ mt: 2 }}>
      {files.map((file) => (
        <FileListItem
          key={file._id}
          file={file}
          onNavigate={onNavigate}
          onMenuOpen={onMenuOpen}
          isSelected={selectedFileId === file._id}
        />
      ))}
    </List>
  );
};

FileList.propTypes = {
  files: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    abstracts: PropTypes.arrayOf(PropTypes.shape({
      events: PropTypes.array
    })),
    uploadDate: PropTypes.string.isRequired,
    progress: PropTypes.number,
    totalSteps: PropTypes.number,
    annotations: PropTypes.object
  })).isRequired,
  onNavigate: PropTypes.func.isRequired,
  onMenuOpen: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  selectedFileId: PropTypes.string,
  userId: PropTypes.string.isRequired // Add userId prop type
};

export default FileList;