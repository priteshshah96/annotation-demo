// src/components/dashboard/FileList.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  List,
  ListItem,
  ListItemText,
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

const FileListItem = ({ 
  file, 
  onNavigate, 
  onMenuOpen, 
  isSelected,
  showProgress = true 
}) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              {file.name}
            </Typography>
            <Chip
              label={file.progress === 100 ? 'Completed' : 'In Progress'}
              color={file.progress === 100 ? 'success' : 'primary'}
              size="small"
              variant={file.progress === 100 ? 'filled' : 'outlined'}
            />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'text.secondary' }}>
            <Typography variant="caption">
              {formatFileSize(file.size || 0)}
            </Typography>
            <Typography variant="caption">
              Uploaded: {formatDate(file.uploadDate)}
            </Typography>
          </Box>

          {showProgress && (
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flexGrow: 1, maxWidth: '300px' }}>
                <LinearProgress
                  variant="determinate"
                  value={file.progress}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: `${getStatusColor(file.progress)}15`,
                    '& .MuiLinearProgress-bar': {
                      bgcolor: getStatusColor(file.progress)
                    }
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: getStatusColor(file.progress) }}>
                {Math.round(file.progress)}%
              </Typography>
            </Box>
          )}
        </Box>

        <Fade in={isHovered || isSelected}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={file.progress === 100 ? "View Annotations" : "Continue Annotating"}>
              <Button
                variant="contained"
                size="small"
                onClick={() => onNavigate(`/annotate/${file._id}`)}
                startIcon={file.progress === 100 ? <ViewIcon /> : <StartIcon />}
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
  selectedFileId = null
}) => {
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
    size: PropTypes.number,
    uploadDate: PropTypes.string.isRequired,
    lastModified: PropTypes.string,
    progress: PropTypes.number.isRequired,
  })).isRequired,
  onNavigate: PropTypes.func.isRequired,
  onMenuOpen: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  selectedFileId: PropTypes.string
};

export default FileList;