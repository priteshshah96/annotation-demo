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
        const fileId = Math.random().toString(36).substring(7);
        
        try {
          setFiles(prev => [...prev, { file, id: fileId }]);
          
          const content = await file.text();
          const papers = JSON.parse(content);
          
          console.log('Parsed papers:', papers); // Log parsed papers
          
          const normalizedPapers = Array.isArray(papers) ? papers : [papers];
  
          // Process papers to extract relevant event_type and other fields
          const processedPapers = normalizedPapers.map(paper => ({
            ...paper,
            events: paper.events.map(event => {
              const eventType = new Map(); // Use a Map for dynamic event type fields
              const eventData = {};
          
              // Separate event_type fields from the rest
              for (const key in event) {
                if (key === "Text" || key === "Main Action" || key === "Arguments") {
                  eventData[key] = event[key]; // These are part of the event data
                } else if (event[key] !== "") { // Only include non-empty event type fields
                  eventType.set(key, event[key]); // Add to the eventType map
                }
              }
          
              return {
                eventType: Array.from(eventType.entries()), // Convert Map to array of key-value pairs
                ...eventData // Rest of the fields as event data
              };
            })
          }));
  
          // Calculate metadata
          const totalEvents = processedPapers.reduce((sum, paper) => 
            sum + (paper.events?.length || 0), 0);
  
          // Prepare upload data
          const uploadData = {
            name: file.name,
            papers: processedPapers, // Ensure papers property is included
            userId,
            metadata: {
              totalPapers: processedPapers.length,
              totalEvents,
              totalFields: totalEvents * 14 // Assuming 14 fields per event
            },
            progress: 0
          };
  
          console.log('Upload data structure:', JSON.stringify({
            name: uploadData.name,
            paperCount: uploadData.papers.length,
            firstPaper: uploadData.papers[0] ? {
              paper_code: uploadData.papers[0].paper_code,
              hasEvents: !!uploadData.papers[0].events
            } : null
          }));
  
          await fileApi.uploadFile(uploadData);
          
          setUploadProgress(prev => ({
            ...prev,
            [fileId]: 100
          }));
          
          if (onUpload) {
            await onUpload();
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
    </Box>
  );
};

FileUploader.propTypes = {
  onUpload: PropTypes.func.isRequired,
  isUploading: PropTypes.bool,
  userId: PropTypes.string.isRequired
};

export default FileUploader;