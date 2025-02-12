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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  KeyboardArrowDown as ExpandIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { fileApi } from '../../services/fileApi';

const FileUploader = ({ onUpload, isUploading = false, userId, existingFiles = [] }) => {
  const theme = useTheme();
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [duplicateDialog, setDuplicateDialog] = useState({
    open: false,
    fileName: '',
    fileData: null
  });

  const checkDuplicateFileName = (fileName) => {
    return existingFiles.some(file => file.name.toLowerCase() === fileName.toLowerCase());
  };

  const handleDuplicateConfirm = async () => {
    const { fileData } = duplicateDialog;
    await processFileUpload(fileData);
    setDuplicateDialog({ open: false, fileName: '', fileData: null });
  };

  const handleDuplicateCancel = () => {
    setDuplicateDialog({ open: false, fileName: '', fileData: null });
  };

  const processFileUpload = async (file) => {
    const fileId = Math.random().toString(36).substring(7);
    
    try {
      setFiles(prev => [...prev, { file, id: fileId }]);

      const content = await file.text();
      const papers = JSON.parse(content);
      const normalizedPapers = Array.isArray(papers) ? papers : [papers];
      
      const totalEvents = normalizedPapers.reduce((sum, paper) => 
        sum + (paper.events?.length || 0), 0);

      const uploadData = {
        name: file.name,
        papers: normalizedPapers,
        userId,
        metadata: {
          totalPapers: normalizedPapers.length,
          totalEvents
        }
      };

      await fileApi.uploadFile(uploadData);
      setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));

      if (onUpload) {
        await onUpload(uploadData);
      }

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
        [fileId]: error.message
      }));
    }
  };

  const handleFiles = async (selectedFiles) => {
    try {
      const fileArray = Array.from(selectedFiles);
      
      for (const file of fileArray) {
        const isDuplicate = checkDuplicateFileName(file.name);
        
        if (isDuplicate) {
          setDuplicateDialog({
            open: true,
            fileName: file.name,
            fileData: file
          });
          return;
        }
        
        await processFileUpload(file);
      }
    } catch (error) {
      console.error('Error handling files:', error);
    }
  };

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
            multiple={false}
          />
          
          <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.8 }} />
          
          <Typography variant="h6" gutterBottom>
            Drag & Drop JSON Files Here
          </Typography>
          
          <Typography variant="body2" color="text.secondary" paragraph>
            or click to browse
          </Typography>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            File must contain papers with paper_code, abstract, and events with Text field
          </Typography>
        </Paper>

        {files.length > 0 && (
          <List sx={{ mt: 2 }}>
            {files.map(({file, id}) => (
              <ListItem
                key={id}
                sx={{
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1
                }}
              >
                <ListItemIcon>
                  {uploadErrors[id] ? (
                    <ErrorIcon color="error" />
                  ) : uploadProgress[id] === 100 ? (
                    <SuccessIcon color="success" />
                  ) : (
                    <FileIcon color="primary" />
                  )}
                </ListItemIcon>
                
                <ListItemText
                  primary={file.name}
                  secondary={
                    uploadErrors[id] || 
                    `${(file.size / 1024).toFixed(1)} KB`
                  }
                  secondaryTypographyProps={{
                    color: uploadErrors[id] ? 'error' : 'text.secondary'
                  }}
                />

                {uploadProgress[id] !== undefined && (
                  <Box sx={{ width: '100px', ml: 2 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={uploadProgress[id]} 
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
                    setFiles(prev => prev.filter(f => f.id !== id));
                    setUploadErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors[id];
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

      {/* Duplicate File Dialog */}
      <Dialog
        open={duplicateDialog.open}
        onClose={handleDuplicateCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          color: 'warning.main' 
        }}>
          <WarningIcon color="warning" />
          Duplicate File Name
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            A file with the name "{duplicateDialog.fileName}" already exists.
          </Alert>
          <Typography>
            Do you want to upload this file anyway? The existing file will remain unchanged.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDuplicateCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDuplicateConfirm} variant="contained" color="warning">
            Upload Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

FileUploader.propTypes = {
  onUpload: PropTypes.func.isRequired,
  isUploading: PropTypes.bool,
  userId: PropTypes.string.isRequired,
  existingFiles: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
  }))
};

export default FileUploader;