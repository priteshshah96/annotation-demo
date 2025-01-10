// FileUploader.jsx - Simplified to match model
import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { 
  Box, 
  Typography, 
  LinearProgress, 
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Collapse,
  useTheme,
  Button 
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  KeyboardArrowDown as ExpandIcon
} from '@mui/icons-material';
import { fileApi } from '../../services/fileApi';

const FileUploader = ({ onUpload, isUploading = false, userId }) => {
  const theme = useTheme();
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});

  const handleFiles = async (selectedFiles) => {
    try {
      const fileArray = Array.from(selectedFiles);

      for (const file of fileArray) {
        try {
          const fileId = Math.random().toString(36).substring(7);
          setFiles(prev => [...prev, { file, id: fileId }]);

          const content = await file.text();
          const parsedContent = JSON.parse(content);

          await fileApi.uploadFile({
            name: file.name,
            content: parsedContent,
            userId
          });

          setUploadProgress(prev => ({
            ...prev,
            [fileId]: 100
          }));

          // Call onUpload callback
          if (onUpload) {
            await onUpload();
          }

          // Remove file from list after successful upload
          setTimeout(() => {
            setFiles(prev => prev.filter(f => f.id !== fileId));
            setUploadProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[fileId];
              return newProgress;
            });
          }, 2000);

        } catch (error) {
          console.error('Error processing file:', error);
          setUploadErrors(prev => ({
            ...prev,
            [file.name]: error.message
          }));
        }
      }
    } catch (error) {
      console.error('Error handling files:', error);
    }
  };

  // ... rest of the UI component code remains the same ...
  
  return (
    <Box sx={{ width: '100%' }}>
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
        <Paper
          variant="outlined"
          onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files) {
              handleFiles(e.dataTransfer.files);
            }
          }}
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
            accept=".json"
            onChange={(e) => handleFiles(e.target.files)}
            style={{ display: 'none' }}
          />
          
          <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.8 }} />
          
          <Typography variant="h6" gutterBottom>
            Drag & Drop JSON Files Here
          </Typography>
          
          <Typography variant="body2" color="text.secondary" paragraph>
            or click to browse
          </Typography>
        </Paper>

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
                  {uploadErrors[fileData.id] ? (
                    <ErrorIcon color="error" />
                  ) : uploadProgress[fileData.id] === 100 ? (
                    <SuccessIcon color="success" />
                  ) : (
                    <FileIcon color="primary" />
                  )}
                </ListItemIcon>
                
                <ListItemText
                  primary={fileData.file.name}
                  secondary={
                    uploadErrors[fileData.id] || 
                    `${(fileData.file.size / 1024).toFixed(1)} KB`
                  }
                  secondaryTypographyProps={{
                    color: uploadErrors[fileData.id] ? 'error' : 'text.secondary'
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
  userId: PropTypes.string.isRequired
};

export default FileUploader;