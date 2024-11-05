import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Paper,
  Box,
  Divider,
  IconButton,
  Chip
} from '@mui/material';
import { ArrowBack, ExpandMore, ExpandLess } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import FileProgressViewer from './FileProgressViewer';

const FileViewer = () => {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [fileData, setFileData] = useState(null);
  const [expandedAbstracts, setExpandedAbstracts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFileData = () => {
      try {
        // First load file metadata
        const fileDataKey = `file-data-${fileId}`;
        const rawFileData = localStorage.getItem(fileDataKey);
        if (!rawFileData) throw new Error('File data not found');
        
        const fileMetadata = JSON.parse(rawFileData);

        // Then load annotations
        const annotations = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith(`annotation-${fileId}`)) {
            const data = JSON.parse(localStorage.getItem(key));
            annotations[key] = {
              ...data,
              abstractIndex: parseInt(key.split('-')[2]),
              sentenceIndex: parseInt(key.split('-')[3]),
              entityIndex: key.split('-')[4]
            };
          }
        }

        setFileData({
          metadata: fileMetadata,
          annotations: annotations
        });
      } catch (error) {
        console.error('Error loading file data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFileData();
  }, [fileId]);

  const toggleAbstract = (abstractIndex) => {
    setExpandedAbstracts(prev => ({
      ...prev,
      [abstractIndex]: !prev[abstractIndex]
    }));
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '50vh' 
        }}>
          <Typography>Loading annotations...</Typography>
        </Box>
      </Container>
    );
  }

  if (!fileData) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 3 }}>
          <Typography color="error">
            No annotation data found for this file.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <IconButton onClick={() => navigate('/')}>
              <ArrowBack />
            </IconButton>
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5">
            {fileData.metadata.name || 'Annotation Review'}
          </Typography>
        </Box>

        <FileProgressViewer fileId={fileId} />

        <Paper sx={{ p: 3 }}>
          {Object.entries(fileData.annotations)
            .sort((a, b) => {
              const aIndices = a[1].abstractIndex * 1000 + a[1].sentenceIndex;
              const bIndices = b[1].abstractIndex * 1000 + b[1].sentenceIndex;
              return aIndices - bIndices;
            })
            .map(([key, annotation]) => {
              const isExpanded = expandedAbstracts[annotation.abstractIndex];

              return (
                <Box key={key} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <IconButton 
                      onClick={() => toggleAbstract(annotation.abstractIndex)}
                      size="small"
                    >
                      {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                    <Typography variant="h6">
                      Abstract {annotation.abstractIndex + 1}, 
                      {annotation.entityIndex === '--1' 
                        ? ` Sentence ${annotation.sentenceIndex + 1}`
                        : ` Entity ${parseInt(annotation.entityIndex) + 1}`
                      }
                    </Typography>
                  </Box>

                  <Box sx={{ 
                    pl: 4, 
                    borderLeft: '2px solid',
                    borderColor: 'primary.main',
                    ml: 2 
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ mr: 1 }}>
                        {annotation.entityIndex === '--1' ? 'Sentence' : 'Entity'} Type:
                      </Typography>
                      <Chip 
                        label={annotation.answer} 
                        color="primary" 
                        variant="outlined"
                      />
                    </Box>
                    
                    <Typography variant="caption" color="text.secondary">
                      Last modified: {new Date(annotation.timestamp).toLocaleString()}
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 2 }} />
                </Box>
              );
            })}
        </Paper>
      </Box>
    </Container>
  );
};

export default FileViewer;