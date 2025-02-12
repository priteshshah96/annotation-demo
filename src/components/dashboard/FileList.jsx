import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  Box, 
  Typography,
  List,
  ListItem,
  IconButton,
  Button,
  LinearProgress,
  Tooltip,
  Fade,
  Paper,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  PlayArrow as StartIcon,
  ArrowUpward as AscIcon,
  ArrowDownward as DescIcon,
} from '@mui/icons-material';
import FileUploader from './FileUploader';

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

  const stats = {
    paperCount: file.papers?.length || 0,
    eventCount: file.papers?.reduce((total, paper) => 
      total + (paper.events?.length || 0), 0) || 0
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
        </Box>

        <Fade in={isHovered || isSelected}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Annotate File">
              <Button
                variant="contained"
                size="small"
                onClick={() => onNavigate(`/annotate/${file._id}`)}
                startIcon={<StartIcon />}
                sx={{
                  minWidth: 100,
                  bgcolor: 'primary.main',
                  '&:hover': {
                    bgcolor: 'primary.dark'
                  }
                }}
              >
                Annotate
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
  const [sortField, setSortField] = useState('uploadDate');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleUpload = async (data) => {
    try {
      setIsUploading(true);
      if (onUpload) {
        await onUpload();
      }
    } catch (error) {
      console.error('File upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const getSortedFiles = () => {
    if (!files?.length) return [];

    return [...files].sort((a, b) => {
      let compareValue = 0;
      
      switch (sortField) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'uploadDate':
          compareValue = new Date(a.uploadDate) - new Date(b.uploadDate);
          break;
        case 'events':
          const aEvents = a.papers?.reduce((sum, paper) => sum + (paper.events?.length || 0), 0) || 0;
          const bEvents = b.papers?.reduce((sum, paper) => sum + (paper.events?.length || 0), 0) || 0;
          compareValue = aEvents - bEvents;
          break;
        default:
          compareValue = 0;
      }
      
      return sortDirection === 'asc' ? compareValue : -compareValue;
    });
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
      {/* Upload Section */}
      <Box sx={{ mb: 4 }}>
        <FileUploader
          onUpload={handleUpload}
          isUploading={isUploading}
          userId={userId}
          existingFiles={files}
        />
      </Box>

      {/* Files Section */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Your Files
        </Typography>

        {files?.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortField}
                label="Sort By"
                onChange={(e) => setSortField(e.target.value)}
              >
                <MenuItem value="uploadDate">Upload Date</MenuItem>
                <MenuItem value="name">File Name</MenuItem>
                <MenuItem value="events">Event Count</MenuItem>
              </Select>
            </FormControl>
            
            <IconButton 
              onClick={toggleSortDirection}
              size="small"
              color="primary"
            >
              {sortDirection === 'asc' ? <AscIcon /> : <DescIcon />}
            </IconButton>

            <Typography variant="body2" color="text.secondary">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        )}

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
            {getSortedFiles().map((file) => (
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