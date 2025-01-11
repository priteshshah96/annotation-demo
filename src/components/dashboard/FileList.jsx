// FileList.jsx
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
import FileUploader from './FileUploader';
import { fileApi } from '../../services/fileApi';

// FileListItem Component
const FileListItem = ({ file, onNavigate, onMenuOpen, isSelected }) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate stats once
  const stats = {
    paperCount: file.papers?.length || 0,
    eventCount: file.papers?.reduce((total, paper) => 
      total + (paper.events?.length || 0), 0) || 0,
    progress: file.progress || 0,
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
              label={stats.progress === 100 ? 'Completed' : 'In Progress'}
              color={stats.progress === 100 ? 'success' : 'primary'}
              size="small"
              variant={stats.progress === 100 ? 'filled' : 'outlined'}
            />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'text.secondary' }}>
            {stats.paperCount > 0 && (
              <Typography variant="caption">
                {`${stats.paperCount} Paper${stats.paperCount !== 1 ? 's' : ''}`}
              </Typography>
            )}
            {stats.eventCount > 0 && (
              <Typography variant="caption">
                {`${stats.eventCount} Event${stats.eventCount !== 1 ? 's' : ''}`}
              </Typography>
            )}
            <Typography variant="caption">
              Uploaded: {formatDate(file.uploadDate)}
            </Typography>
          </Box>

          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flexGrow: 1, maxWidth: '300px' }}>
              <LinearProgress
                variant="determinate"
                value={stats.progress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: theme.palette.grey[100],
                  '& .MuiLinearProgress-bar': {
                    bgcolor: stats.progress === 100 ? 
                      theme.palette.success.main : 
                      theme.palette.primary.main
                  }
                }}
              />
            </Box>
            <Typography 
              variant="caption" 
              sx={{ 
                color: stats.progress === 100 ? 
                  theme.palette.success.main : 
                  theme.palette.primary.main 
              }}
            >
              {stats.progress}%
            </Typography>
          </Box>
        </Box>

        <Fade in={isHovered || isSelected}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={stats.progress === 100 ? "View Annotations" : "Continue Annotating"}>
              <Button
                variant="contained"
                size="small"
                onClick={() => onNavigate(`/annotate/${file._id}`)}
                startIcon={stats.progress === 100 ? <ViewIcon /> : <StartIcon />}
                sx={{
                  minWidth: 100,
                  bgcolor: stats.progress === 100 ? 'success.main' : 'primary.main',
                  '&:hover': {
                    bgcolor: stats.progress === 100 ? 'success.dark' : 'primary.dark'
                  }
                }}
              >
                {stats.progress === 100 ? 'View' : 'Annotate'}
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

// Main FileList Component
const FileList = ({
  files,
  onNavigate,
  onMenuOpen,
  loading = false,
  error = null,
  selectedFileId = null,
  userId,
  onUpload
}) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (data) => {
    try {
      setIsUploading(true);
      await fileApi.uploadFile({
        ...data,
        userId
      });
      if (onUpload) {
        await onUpload();
      }
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

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <FileUploader
          onUpload={handleUpload}
          isUploading={isUploading}
          userId={userId}
        />
      </Box>

      {!files?.length ? (
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
      ) : (
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
      )}
    </Box>
  );
};

FileList.propTypes = {
  files: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    papers: PropTypes.arrayOf(PropTypes.shape({
      events: PropTypes.array
    })),
    uploadDate: PropTypes.string.isRequired,
    progress: PropTypes.number
  })).isRequired,
  onNavigate: PropTypes.func.isRequired,
  onMenuOpen: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  selectedFileId: PropTypes.string,
  userId: PropTypes.string.isRequired,
  onUpload: PropTypes.func
};

export default FileList;