import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Paper,
  Box,
  Divider,
  IconButton,
  Chip,
  Tooltip
} from '@mui/material';
import { ArrowBack, ExpandMore, ExpandLess } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import FileProgressViewer from './FileProgressViewer';

const FileViewer = () => {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [fileData, setFileData] = useState(null);
  const [expandedAbstracts, setExpandedAbstracts] = useState({});

  useEffect(() => {
    const loadAnnotations = () => {
      // Load file data from localStorage or server
      const annotations = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(`annotation-${fileId}`)) {
          const [_, __, abstractIndex, sentenceIndex, entityIndex] = key.split('-');
          const data = JSON.parse(localStorage.getItem(key));
          annotations[key] = data;
        }
      }
      return annotations;
    };

    const annotations = loadAnnotations();
    setFileData(annotations);
  }, [fileId]);

  const toggleAbstract = (abstractIndex) => {
    setExpandedAbstracts(prev => ({
      ...prev,
      [abstractIndex]: !prev[abstractIndex]
    }));
  };

  if (!fileData) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5">Annotation Review</Typography>
        </Box>

        <FileProgressViewer fileId={fileId} />

        <Paper sx={{ p: 3 }}>
          {Object.entries(fileData).map(([key, annotation]) => {
            const [_, __, abstractIndex, sentenceIndex, entityIndex] = key.split('-');
            const isExpandable = expandedAbstracts[abstractIndex];

            return (
              <Box key={key} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <IconButton onClick={() => toggleAbstract(abstractIndex)}>
                    {isExpandable ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                  <Typography variant="h6">
                    Abstract {parseInt(abstractIndex) + 1}
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
                      {entityIndex === '--1' ? 'Sentence' : 'Entity'} Type:
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