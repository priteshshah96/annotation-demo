import React, { useState, useEffect, useCallback } from 'react';
import { 
  Container, 
  Typography, 
  Paper, 
  Button, 
  Box,
  Collapse,
  IconButton,
  CircularProgress,
  LinearProgress,
  Snackbar,
  Alert
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useParams, useNavigate } from 'react-router-dom';

const sentenceQuestions = [
  { text: "What is the background or the main problem discussed by this research?", entity: "Background/Introduction" },
  { text: "What methods or approaches are used to conduct the research?", entity: "Methods/Approach" },
  { text: "What are the key findings or outcomes of this study?", entity: "Results/Findings" },
  { text: "What are the implications of these findings, and what future directions are suggested?", entity: "Conclusions/Implications" },
  { text: "Not sure", entity: "Not sure" }
];

const entityQuestions = [
  { text: "What is the main focus or who/what is performing the action in the sentence?", entity: "Agent/Subject" },
  { text: "What is receiving the action or being acted upon in the sentence?", entity: "Object/Recipient" },
  { text: "What is the result or effect of the action or focus in the sentence?", entity: "Outcome/Effect" },
  { text: "What background conditions or circumstances are relevant to the action or subject in the sentence?", entity: "Context/Condition" },
  { text: "Not sure", entity: "Not sure" }
];

const OptionBox = ({ text, isSelected, onClick }) => (
  <Box 
    onClick={onClick}
    sx={{
      padding: 2,
      margin: 1,
      border: '1px solid #ccc',
      borderRadius: 2,
      backgroundColor: isSelected ? '#e3f2fd' : 'white',
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: isSelected ? '#e3f2fd' : '#f5f5f5',
      },
      transition: 'background-color 0.2s'
    }}
  >
    <Typography>{text}</Typography>
  </Box>
);

const UserAnnotationDashboard = () => {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [fileData, setFileData] = useState(null);
  const [currentAbstractIndex, setCurrentAbstractIndex] = useState(0);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [currentEntityIndex, setCurrentEntityIndex] = useState(-1);
  const [selectedSentenceAnswer, setSelectedSentenceAnswer] = useState('');
  const [selectedEntityAnswer, setSelectedEntityAnswer] = useState('');
  const [expandAbstract, setExpandAbstract] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [autoSaveIndicator, setAutoSaveIndicator] = useState({ show: false, status: 'saved' }); // 'saving' | 'saved' | 'error'

  // Load previous annotations for current position
  const loadCurrentAnnotation = useCallback(() => {
    if (!fileData) return;
  
    const annotationKey = `annotation-${fileId}-${currentAbstractIndex}-${currentSentenceIndex}-${currentEntityIndex}`;
    const savedAnnotation = localStorage.getItem(annotationKey);
    
    if (savedAnnotation) {
      const { answer } = JSON.parse(savedAnnotation);
      
      // Find the question text that corresponds to the saved entity value
      if (currentEntityIndex === -1) {
        const question = sentenceQuestions.find(q => q.entity === answer);
        setSelectedSentenceAnswer(question ? question.text : '');
      } else {
        const question = entityQuestions.find(q => q.entity === answer);
        setSelectedEntityAnswer(question ? question.text : '');
      }
    } else {
      // Clear selections if no saved annotation exists
      if (currentEntityIndex === -1) {
        setSelectedSentenceAnswer('');
      } else {
        setSelectedEntityAnswer('');
      }
    }
  }, [fileData, fileId, currentAbstractIndex, currentSentenceIndex, currentEntityIndex]);

  // Find the first unanswered question
  const findFirstUnanswered = useCallback((fileData) => {
    for (let abstractIdx = 0; abstractIdx < fileData.abstracts.length; abstractIdx++) {
      const abstract = fileData.abstracts[abstractIdx];
      
      for (let sentenceIdx = 0; sentenceIdx < abstract.sentences.length; sentenceIdx++) {
        const sentence = abstract.sentences[sentenceIdx];
        
        // Check sentence-level annotation
        const sentenceKey = `annotation-${fileId}-${abstractIdx}-${sentenceIdx}--1`;
        if (!localStorage.getItem(sentenceKey)) {
          return { abstractIdx, sentenceIdx, entityIdx: -1 };
        }
        
        // Check entity-level annotations
        for (let entityIdx = 0; entityIdx < sentence.scientific_entities.length; entityIdx++) {
          const entityKey = `annotation-${fileId}-${abstractIdx}-${sentenceIdx}-${entityIdx}`;
          if (!localStorage.getItem(entityKey)) {
            return { abstractIdx, sentenceIdx, entityIdx };
          }
        }
      }
    }
    
    // If everything is answered, return the last position
    return {
      abstractIdx: fileData.abstracts.length - 1,
      sentenceIdx: fileData.abstracts[fileData.abstracts.length - 1].sentences.length - 1,
      entityIdx: fileData.abstracts[fileData.abstracts.length - 1]
        .sentences[fileData.abstracts[fileData.abstracts.length - 1].sentences.length - 1]
        .scientific_entities.length - 1
    };
  }, [fileId]);

  // Load file data and resume progress
  useEffect(() => {
    const loadFileData = async () => {
      try {
        const data = localStorage.getItem(`file-data-${fileId}`);
        if (!data) {
          throw new Error('File not found');
        }

        const parsedData = JSON.parse(data);
        setFileData(parsedData);

        // Check for last saved position
        const lastPosition = localStorage.getItem(`last-position-${fileId}`);
        if (lastPosition) {
          // Resume from last saved position
          const { abstractIndex, sentenceIndex, entityIndex } = JSON.parse(lastPosition);
          setCurrentAbstractIndex(abstractIndex);
          setCurrentSentenceIndex(sentenceIndex);
          setCurrentEntityIndex(entityIndex);
        } else {
          // Find first unanswered question
          const firstUnanswered = findFirstUnanswered(parsedData);
          setCurrentAbstractIndex(firstUnanswered.abstractIdx);
          setCurrentSentenceIndex(firstUnanswered.sentenceIdx);
          setCurrentEntityIndex(firstUnanswered.entityIdx);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadFileData();
  }, [fileId, findFirstUnanswered]);

  // Load saved annotation when position changes
  useEffect(() => {
    if (fileData) {
      loadCurrentAnnotation();
    }
  }, [fileData, currentAbstractIndex, currentSentenceIndex, currentEntityIndex, loadCurrentAnnotation]);

  // Auto-save function
  const autoSave = useCallback((answer) => {
    if (!fileData) return;

    setAutoSaveIndicator({ show: true, status: 'saving' });
    
    try {
      const annotationKey = `annotation-${fileId}-${currentAbstractIndex}-${currentSentenceIndex}-${currentEntityIndex}`;
      
      localStorage.setItem(annotationKey, JSON.stringify({
        answer,
        timestamp: new Date().toISOString()
      }));

      // Save current position
      localStorage.setItem(`last-position-${fileId}`, JSON.stringify({
        abstractIndex: currentAbstractIndex,
        sentenceIndex: currentSentenceIndex,
        entityIndex: currentEntityIndex
      }));

      setAutoSaveIndicator({ show: true, status: 'saved' });
      
      // Hide the indicator after 2 seconds
      setTimeout(() => {
        setAutoSaveIndicator({ show: false, status: 'saved' });
      }, 2000);
    } catch (error) {
      console.error('Auto-save error:', error);
      setAutoSaveIndicator({ show: true, status: 'error' });
    }
  }, [fileId, currentAbstractIndex, currentSentenceIndex, currentEntityIndex, fileData]);

  // Handle answer selection with auto-save
  const handleAnswerSelect = (answer) => {
    // Save answer immediately when selected
    const annotationKey = `annotation-${fileId}-${currentAbstractIndex}-${currentSentenceIndex}-${currentEntityIndex}`;
    
    // Find the corresponding entity value from the questions array
    const selectedQuestion = currentEntityIndex === -1 
      ? sentenceQuestions.find(q => q.text === answer)
      : entityQuestions.find(q => q.text === answer);
  
    // Save the entity value instead of the question text
    localStorage.setItem(annotationKey, JSON.stringify({
      answer: selectedQuestion.entity,
      timestamp: new Date().toISOString()
    }));
  
    // Update the UI state
    if (currentEntityIndex === -1) {
      setSelectedSentenceAnswer(answer);
    } else {
      setSelectedEntityAnswer(answer);
    }
  
    // Show auto-save indicator
    setAutoSaveIndicator({ show: true, status: 'saving' });
    setTimeout(() => {
      setAutoSaveIndicator({ show: true, status: 'saved' });
      setTimeout(() => {
        setAutoSaveIndicator({ show: false, status: 'saved' });
      }, 2000);
    }, 500);
  
    // Save current position
    localStorage.setItem(`last-position-${fileId}`, JSON.stringify({
      abstractIndex: currentAbstractIndex,
      sentenceIndex: currentSentenceIndex,
      entityIndex: currentEntityIndex
    }));
  };

  // Calculate total steps for progress
  const calculateTotalSteps = useCallback((data) => {
    if (!data?.abstracts) return 0;
    return data.abstracts.reduce((total, abstract) => {
      return total + abstract.sentences.reduce((sentTotal, sentence) => {
        return sentTotal + sentence.scientific_entities.length + 1; // +1 for sentence itself
      }, 0);
    }, 0);
  }, []);

  // Calculate current step
  const calculateCurrentStep = useCallback(() => {
    if (!fileData?.abstracts) return 0;
    let steps = 0;
    
    // Count completed abstracts
    for (let i = 0; i < currentAbstractIndex; i++) {
      steps += fileData.abstracts[i].sentences.reduce((total, sentence) => {
        return total + sentence.scientific_entities.length + 1;
      }, 0);
    }
    
    // Count completed sentences in current abstract
    for (let i = 0; i < currentSentenceIndex; i++) {
      steps += fileData.abstracts[currentAbstractIndex].sentences[i].scientific_entities.length + 1;
    }
    
    // Add current sentence progress
    if (currentEntityIndex >= 0) {
      steps += currentEntityIndex + 1;
    }
    
    return steps;
  }, [fileData, currentAbstractIndex, currentSentenceIndex, currentEntityIndex]);

  useEffect(() => {
    const loadFileData = () => {
      try {
        const data = localStorage.getItem(`file-data-${fileId}`);
        if (data) {
          const parsedData = JSON.parse(data);
          setFileData(parsedData);
          
          // Load last saved position if exists
          const lastPosition = localStorage.getItem(`last-position-${fileId}`);
          if (lastPosition) {
            const { abstractIndex, sentenceIndex, entityIndex } = JSON.parse(lastPosition);
            setCurrentAbstractIndex(abstractIndex);
            setCurrentSentenceIndex(sentenceIndex);
            setCurrentEntityIndex(entityIndex);
          }
        } else {
          setError('File not found');
        }
      } catch (err) {
        setError('Error loading file data');
        console.error('Error loading file:', err);
      } finally {
        setLoading(false);
      }
    };
    loadFileData();
  }, [fileId]);

  // Update progress
  useEffect(() => {
    if (fileData) {
      const totalSteps = calculateTotalSteps(fileData);
      const currentStep = calculateCurrentStep();
      const newProgress = Math.min((currentStep * 100) / totalSteps, 100);
      setProgress(newProgress);
      
      // Save progress to localStorage
      const storedFile = JSON.parse(localStorage.getItem(`file-data-${fileId}`));
      if (storedFile) {
        storedFile.progress = newProgress;
        localStorage.setItem(`file-data-${fileId}`, JSON.stringify(storedFile));
      }
      
      // Save current position
      localStorage.setItem(`last-position-${fileId}`, JSON.stringify({
        abstractIndex: currentAbstractIndex,
        sentenceIndex: currentSentenceIndex,
        entityIndex: currentEntityIndex
      }));
    }
  }, [fileData, currentAbstractIndex, currentSentenceIndex, currentEntityIndex, calculateTotalSteps, calculateCurrentStep, fileId]);

  const handleNextQuestion = () => {
    if (!fileData) return;
  
    const currentAbstract = fileData.abstracts[currentAbstractIndex];
    const scientificEntities = currentAbstract.sentences[currentSentenceIndex].scientific_entities;
  
    // Clear selected answers when moving to next question
    setSelectedSentenceAnswer('');
    setSelectedEntityAnswer('');
  
    if (currentEntityIndex === -1) {
      if (scientificEntities.length > 0) {
        setCurrentEntityIndex(0);
      } else {
        moveToNextSentence();
      }
    } else if (currentEntityIndex < scientificEntities.length - 1) {
      setCurrentEntityIndex(currentEntityIndex + 1);
    } else {
      moveToNextSentence();
    }
  };

  const moveToNextSentence = () => {
    const currentAbstract = fileData.abstracts[currentAbstractIndex];
    
    if (currentSentenceIndex < currentAbstract.sentences.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
      setCurrentEntityIndex(-1);
    } else if (currentAbstractIndex < fileData.abstracts.length - 1) {
      setCurrentAbstractIndex(currentAbstractIndex + 1);
      setCurrentSentenceIndex(0);
      setCurrentEntityIndex(-1);
    } else {
      setSnackbar({
        open: true,
        message: "Congratulations! You have completed all annotations for this file.",
        severity: 'success'
      });
      setTimeout(() => navigate('/'), 2000);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl">
        <Typography variant="h6" color="error" gutterBottom>
          {error}
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Return to Dashboard
        </Button>
      </Container>
    );
  }

  if (!fileData || !fileData.abstracts || fileData.abstracts.length === 0) {
    return (
      <Container maxWidth="xl">
        <Typography variant="h6" gutterBottom>
          No file data available for annotation.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Return to Dashboard
        </Button>
      </Container>
    );
  }

  const currentAbstract = fileData.abstracts[currentAbstractIndex];
  const currentSentence = currentAbstract.sentences[currentSentenceIndex];
  const questions = currentEntityIndex === -1 ? sentenceQuestions : entityQuestions;

  return (
    <Container maxWidth="xl">
      <Box sx={{ position: 'sticky', top: 0, bgcolor: 'background.default', zIndex: 1, py: 2 }}>
        <Button 
          variant="outlined" 
          onClick={() => navigate('/')}
          sx={{ position: 'absolute', top: 16, right: 16 }}
        >
          Back to Dashboard
        </Button>
        <Typography variant="h4" gutterBottom>
          Annotation Tool
        </Typography>
        <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />
        
        {/* Auto-save indicator */}
        {autoSaveIndicator.show && (
          <Box sx={{ 
            position: 'fixed', 
            top: 16, 
            right: 100, 
            bgcolor: 'background.paper',
            px: 2,
            py: 1,
            borderRadius: 1,
            boxShadow: 1
          }}>
            <Typography variant="body2" color={
              autoSaveIndicator.status === 'saving' ? 'primary' :
              autoSaveIndicator.status === 'saved' ? 'success.main' :
              'error.main'
            }>
              {autoSaveIndicator.status === 'saving' ? 'Saving...' :
               autoSaveIndicator.status === 'saved' ? 'Changes saved' :
               'Error saving changes'}
            </Typography>
          </Box>
        )}
      </Box>

      <Paper elevation={3} sx={{ padding: 2, marginBottom: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Abstract {currentAbstractIndex + 1} of {fileData.abstracts.length}: {currentAbstract.paper_code}
          </Typography>
          <IconButton onClick={() => setExpandAbstract(!expandAbstract)}>
            {expandAbstract ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        <Collapse in={expandAbstract}>
          <Typography variant="body1" sx={{ marginTop: 1, whiteSpace: 'pre-wrap' }}>
            {currentAbstract.abstract}
          </Typography>
        </Collapse>
      </Paper>

      <Paper elevation={3} sx={{ padding: 2, marginBottom: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Current sentence ({currentSentenceIndex + 1} of {currentAbstract.sentences.length}):
        </Typography>
        <Typography variant="body1" sx={{ marginBottom: 2, bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
          {currentSentence.text}
        </Typography>

        {currentEntityIndex >= 0 && currentSentence.scientific_entities[currentEntityIndex] && (
          <>
            <Typography variant="subtitle1" gutterBottom>
              Current scientific entity ({currentEntityIndex + 1} of {currentSentence.scientific_entities.length}):
            </Typography>
            <Typography variant="body1" sx={{ marginBottom: 2, fontWeight: 'bold', color: 'primary.main' }}>
              {currentSentence.scientific_entities[currentEntityIndex].entity}
            </Typography>
          </>
        )}

        <Typography variant="subtitle1" gutterBottom>
          {currentEntityIndex === -1 ? 
            "Which of the following best describes this sentence?" : 
            "Which of the following best describes this entity?"
          }
        </Typography>

        {questions.map((question, index) => (
          <OptionBox
            key={index}
            text={question.text}
            isSelected={
              currentEntityIndex === -1 ? 
                selectedSentenceAnswer === question.text : 
                selectedEntityAnswer === question.text
            }
            onClick={() => handleAnswerSelect(question.text)}
      />
        ))}

        <Box display="flex" justifyContent="space-between" marginTop={2}>
          <Button 
            variant="outlined" 
            onClick={() => {
              if (currentEntityIndex > 0) {
                setCurrentEntityIndex(currentEntityIndex - 1);
              } else if (currentEntityIndex === 0) {
                setCurrentEntityIndex(-1);
              } else if (currentSentenceIndex > 0) {
                setCurrentSentenceIndex(currentSentenceIndex - 1);
                const prevSentence = fileData.abstracts[currentAbstractIndex].sentences[currentSentenceIndex - 1];
                setCurrentEntityIndex(prevSentence.scientific_entities.length - 1);
              } else if (currentAbstractIndex > 0) {
                setCurrentAbstractIndex(currentAbstractIndex - 1);
                const prevAbstract = fileData.abstracts[currentAbstractIndex - 1];
                setCurrentSentenceIndex(prevAbstract.sentences.length - 1);
                setCurrentEntityIndex(prevAbstract.sentences[prevAbstract.sentences.length - 1].scientific_entities.length - 1);
              }
              setSelectedSentenceAnswer('');
              setSelectedEntityAnswer('');
            }}
            disabled={currentAbstractIndex === 0 && currentSentenceIndex === 0 && currentEntityIndex === -1}
          >
            Previous
          </Button>
          <Button 
            variant="contained" 
            onClick={handleNextQuestion}
            disabled={
              (currentEntityIndex === -1 && !selectedSentenceAnswer) || 
              (currentEntityIndex !== -1 && !selectedEntityAnswer)
            }
          >
            Next
          </Button>
        </Box>
      </Paper>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          elevation={6}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default UserAnnotationDashboard;