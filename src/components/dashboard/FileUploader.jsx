// src/components/dashboard/FileUploader.jsx
import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { 
  Box, 
  Typography, 
  Button, 
  LinearProgress, 
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Collapse,
  useTheme 
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  KeyboardArrowDown as ExpandIcon
} from '@mui/icons-material';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['.json'];

const FileUploader = ({ 
  onUpload, 
  isUploading = false, 
  multiple = false,
  maxFiles = 5
}) => {
  const theme = useTheme();
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});

  // Handle file selection
  const handleFiles = async (selectedFiles) => {
    const newFiles = Array.from(selectedFiles).slice(0, maxFiles);
    
    // Validate files
    const validatedFiles = newFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      status: validateFile(file)
    }));

    setFiles(prevFiles => [...prevFiles, ...validatedFiles]);

    // Automatically upload valid files
    for (const fileData of validatedFiles) {
      if (fileData.status.valid) {
        await uploadFile(fileData);
      }
    }
  };

  // File validation
  const validateFile = (file) => {
    if (!ACCEPTED_TYPES.some(type => file.name.toLowerCase().endsWith(type))) {
      return {
        valid: false,
        error: 'Invalid file type. Please upload JSON files only.'
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit.`
      };
    }

    return { valid: true, error: null };
  };

  // File upload
  const uploadFile = async (fileData) => {
    try {
      setUploadProgress(prev => ({
        ...prev,
        [fileData.id]: 0
      }));

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          [fileData.id]: Math.min((prev[fileData.id] || 0) + 10, 90)
        }));
      }, 200);

      // Actual file upload
      const result = await onUpload(fileData.file);

      clearInterval(progressInterval);
      setUploadProgress(prev => ({
        ...prev,
        [fileData.id]: 100
      }));

      // Remove file from list after successful upload
      setTimeout(() => {
        setFiles(prev => prev.filter(f => f.id !== fileData.id));
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileData.id];
          return newProgress;
        });
      }, 2000);

      return result;

    } catch (error) {
      setUploadErrors(prev => ({
        ...prev,
        [fileData.id]: error.message
      }));
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileData.id];
        return newProgress;
      });
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  // Render file status icon
  const FileStatusIcon = ({ fileData }) => {
    if (uploadErrors[fileData.id]) {
      return <ErrorIcon color="error" />;
    }
    if (uploadProgress[fileData.id] === 100) {
      return <SuccessIcon color="success" />;
    }
    if (!fileData.status.valid) {
      return <ErrorIcon color="error" />;
    }
    return <FileIcon color="primary" />;
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 2 
      }}>
        <Typography variant="h6">Upload Files</Typography>
        <IconButton 
          size="small" 
          onClick={() => setExpanded(!expanded)}
          sx={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          <ExpandIcon />
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        {/* Drop Zone */}
        <Paper
          variant="outlined"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          sx={{
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragActive ? 'action.hover' : 'background.paper',
            border: `2px dashed ${dragActive ? theme.palette.primary.main : theme.palette.divider}`,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'action.hover',
              borderColor: theme.palette.primary.main
            }
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            accept={ACCEPTED_TYPES.join(',')}
            onChange={(e) => handleFiles(e.target.files)}
            style={{ display: 'none' }}
          />
          
          <UploadIcon 
            sx={{ 
              fontSize: 48, 
              color: theme.palette.primary.main,
              mb: 2,
              opacity: 0.8
            }} 
          />
          
          <Typography variant="h6" gutterBottom>
            Drag & Drop Files Here
          </Typography>
          
          <Typography variant="body2" color="text.secondary" paragraph>
            or click to browse
          </Typography>
          
          <Typography variant="caption" color="text.secondary">
            Supports JSON files up to {MAX_FILE_SIZE / (1024 * 1024)}MB
          </Typography>
        </Paper>

        {/* File List */}
        {files.length > 0 && (
          <List sx={{ mt: 2 }}>
            {files.map((fileData) => (
              <ListItem
                key={fileData.id}
                sx={{
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1
                }}
              >
                <ListItemIcon>
                  <FileStatusIcon fileData={fileData} />
                </ListItemIcon>
                
                <ListItemText
                  primary={fileData.file.name}
                  secondary={
                    uploadErrors[fileData.id] || 
                    fileData.status.error || 
                    `${(fileData.file.size / 1024).toFixed(1)} KB`
                  }
                  secondaryTypographyProps={{
                    color: uploadErrors[fileData.id] || fileData.status.error ? 
                      'error' : 'text.secondary'
                  }}
                />

                {uploadProgress[fileData.id] !== undefined && (
                  <Box sx={{ width: '100px', ml: 2 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={uploadProgress[fileData.id]} 
                      sx={{
                        height: 6,
                        borderRadius: 3
                      }}
                    />
                  </Box>
                )}

                <IconButton 
                  size="small" 
                  onClick={() => {
                    setFiles(prev => prev.filter(f => f.id !== fileData.id));
                    setUploadErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors[fileData.id];
                      return newErrors;
                    });
                  }}
                  sx={{ ml: 1 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </ListItem>
            ))}
          </List>
        )}
      </Collapse>
    </Box>
  );
};

FileUploader.propTypes = {
  onUpload: PropTypes.func.isRequired,
  isUploading: PropTypes.bool,
  multiple: PropTypes.bool,
  maxFiles: PropTypes.number
};

FileUploader.propTypes = {
  onUpload: PropTypes.func.isRequired,
  isUploading: PropTypes.bool,
  multiple: PropTypes.bool,
  maxFiles: PropTypes.number
};

export default FileUploader;

