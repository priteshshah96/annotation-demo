// src/pages/UserAnnotationDashboard.jsx
import React, { useEffect, useCallback, memo, useRef, useMemo, useState } from 'react';
import { 
  Container, 
  Typography, 
  Button, 
  Box,
  CircularProgress,
  Paper,
  alpha,
  useTheme
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAnnotation } from '../hooks/useAnnotation';
import { useAnnotationSync } from '../hooks/useAnnotationSync';
import { useSnackbar } from '../hooks/useSnackbar';
import AnnotationContent from '../components/annotation/AnnotationContent';
import AnnotationHeader from '../components/annotation/AnnotationHeader';
import OptionBox from '../components/annotation/OptionBox';
import AutoScrollAnnotation from '../components/annotation/AutoScrollAnnotation';

// Constants for question types
const QUESTIONS = {
  sentence: [
    { 
      text: "What is the background or the main problem discussed by this research?", 
      entity: "Background/Introduction" 
    },
    { 
      text: "What methods or approaches are used to conduct the research?", 
      entity: "Methods/Approach" 
    },
    { 
      text: "What are the key findings or outcomes of this study?", 
      entity: "Results/Findings" 
    },
    { 
      text: "What are the implications of these findings, and what future directions are suggested?", 
      entity: "Conclusions/Implications" 
    },
    { 
      text: "Not sure", 
      entity: "Not sure" 
    }
  ],
  entity: [
    { 
      text: "What is the main focus or who/what is performing the action in the sentence?", 
      entity: "Agent/Subject" 
    },
    { 
      text: "What is receiving the action or being acted upon in the sentence?", 
      entity: "Object/Recipient" 
    },
    { 
      text: "What is the result or effect of the action or focus in the sentence?", 
      entity: "Outcome/Effect" 
    },
    { 
      text: "What background conditions or circumstances are relevant to the action or subject in the sentence?", 
      entity: "Context/Condition" 
    },
    { 
      text: "Not sure", 
      entity: "Not sure" 
    }
  ]
};

// Loading Component
const LoadingView = memo(() => (
  <Container 
    sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      bgcolor: 'background.default'
    }}
  >
    <CircularProgress />
  </Container>
));

// Error Component
const ErrorView = memo(({ error, onBack }) => (
  <Container 
    maxWidth="xl" 
    sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: 2, 
      pt: 4 
    }}
  >
    <Typography variant="h6" color="error" align="center" gutterBottom>
      {error}
    </Typography>
    <Button 
      variant="contained" 
      onClick={onBack}
      sx={{ minWidth: 200 }}
    >
      Return to Dashboard
    </Button>
  </Container>
));

// Navigation Buttons Component
const NavigationButtons = memo(({ 
  onPrevious, 
  onNext, 
  onComplete, 
  isFirstQuestion, 
  hasSelection, 
  isLastItem,
  isCompleting
}) => {
  const theme = useTheme();

  return (
    <Box 
      display="flex" 
      justifyContent="space-between" 
      marginTop={2}
      gap={2}
    >
      <Button 
        variant="outlined" 
        onClick={onPrevious}
        disabled={isFirstQuestion || isCompleting}
        sx={{ 
          minWidth: 120,
          '&:not(:disabled):hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.04)
          }
        }}
      >
        Previous
      </Button>
      <Button 
        variant="contained" 
        onClick={isLastItem ? onComplete : onNext}
        disabled={!hasSelection || isCompleting}
        color={isLastItem ? "success" : "primary"}
        sx={{ 
          minWidth: 120,
          position: 'relative'
        }}
      >
        {isCompleting ? (
          <>
            <CircularProgress 
              size={24} 
              sx={{ 
                color: 'white',
                position: 'absolute',
                left: '50%',
                marginLeft: '-12px'
              }} 
            />
            <Box sx={{ opacity: 0 }}>
              {isLastItem ? 'Complete' : 'Next'}
            </Box>
          </>
        ) : (
          isLastItem ? 'Complete' : 'Next'
        )}
      </Button>
    </Box>
  );
});

// Questions List Component
const QuestionsList = memo(({ questions, selectedAnswer, onAnswerSelect, disabled }) => (
  <Box>
    {questions.map((question, index) => (
      <OptionBox
        key={`${question.entity}-${index}`}
        text={question.text}
        isSelected={selectedAnswer === question.entity}
        onClick={() => onAnswerSelect(question)}
        disabled={disabled}
      />
    ))}
  </Box>
));

// Main Component
const UserAnnotationDashboard = () => {
  const mountedRef = useRef(true);
  const theme = useTheme();
  const navigate = useNavigate();
  const { fileId } = useParams();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  
  const {
    currentPosition,
    selections,
    fileData,
    progress,
    expandAbstract,
    setExpandAbstract,
    loading,
    error,
    moveNext,
    movePrevious,
    loadFileData,
    handleAnswerSelect,
    isFirstQuestion,
    isLastQuestion,
    isLastItem
  } = useAnnotation(fileId);

  const { syncStatus, syncAnnotation } = useAnnotationSync(fileId);

  const handleBack = useCallback(() => {
    if (isCompleting) return;
    navigate('/', { replace: true });
  }, [navigate, isCompleting]);

  // In UserAnnotationDashboard.jsx
const handleCompletion = useCallback(async () => {
  if (!mountedRef.current || isCompleting) return;
    
  try {
    setIsCompleting(true);
    showSnackbar('Finalizing annotations...', 'info');
    
    // Final sync of annotations
    await syncAnnotation();
    
    // Clear local storage position and file cache
    localStorage.removeItem(`last-position-${fileId}`);
    localStorage.removeItem(`file-data-${fileId}`);

    if (!mountedRef.current) return;
    
    showSnackbar('Annotations completed!', 'success');
    
    // Small delay to show completion state
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (mountedRef.current) {
      // Force navigation to dashboard
      window.location.href = '/';  // Use direct navigation instead of react-router
    }
  } catch (error) {
    console.error('Completion error:', error);
    if (mountedRef.current) {
      setIsCompleting(false);
      showSnackbar('Error completing annotations. Please try again.', 'error');
    }
  }
}, [syncAnnotation, fileId, showSnackbar, isCompleting]);


  // Initial data load
  useEffect(() => {
    if (isInitialLoad && fileId && mountedRef.current) {
      loadFileData();
      setIsInitialLoad(false);
    }
  }, [loadFileData, fileId, isInitialLoad]);

  // Auto-sync effect
  useEffect(() => {
    let syncInterval;
    if (!loading && fileData && mountedRef.current && !isCompleting) {
      syncInterval = setInterval(() => {
        if (mountedRef.current) {
          syncAnnotation().catch(console.error);
        }
      }, 30000);
    }
    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [syncAnnotation, loading, fileData, isCompleting]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Memoized current data
  const currentData = useMemo(() => {
    if (!fileData?.abstracts?.length) return null;

    const currentAbstract = fileData.abstracts[currentPosition.abstractIndex];
    const currentSentence = currentAbstract.sentences[currentPosition.sentenceIndex];
    const currentEntity = currentPosition.entityIndex >= 0 
      ? currentSentence.scientific_entities[currentPosition.entityIndex] 
      : null;
    
    return {
      abstract: currentAbstract,
      sentence: currentSentence,
      entity: currentEntity,
      questions: currentPosition.entityIndex === -1 ? QUESTIONS.sentence : QUESTIONS.entity,
      selectedAnswer: currentPosition.entityIndex === -1 
        ? selections.sentenceAnswer 
        : selections.entityAnswer
    };
  }, [fileData, currentPosition, selections]);

  if (loading || isInitialLoad) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView error={error} onBack={handleBack} />;
  }

  if (!currentData) {
    return <ErrorView error="No file data available for annotation." onBack={handleBack} />;
  }

  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflow: 'hidden' }}>
      <Container maxWidth="xl" sx={{ flex: 1, pb: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <AnnotationHeader 
          onBack={handleBack}
          progress={progress}
          syncStatus={syncStatus}
          fileName={fileData.name}
          
        />
  
        <AutoScrollAnnotation currentPosition={currentPosition}>
          <AnnotationContent 
            abstract={currentData.abstract}
            sentence={currentData.sentence}
            entity={currentData.entity}
            expanded={expandAbstract}
            onToggleExpand={() => setExpandAbstract(!expandAbstract)}
            abstractIndex={currentPosition.abstractIndex}
            totalAbstracts={fileData.abstracts.length}
            sentenceIndex={currentPosition.sentenceIndex}
            totalSentences={currentData.abstract.sentences.length}
            entityIndex={currentPosition.entityIndex}
            totalEntities={currentData.sentence.scientific_entities.length}
          />

        <Paper 
          elevation={3}
          data-question-section
          sx={{ 
            padding: 3,
            position: 'sticky',
            bottom: 16,
            backgroundColor: 'background.paper',
            zIndex: 1,
            borderRadius: 2,
            transition: 'transform 0.2s ease-in-out',
            border: `1px solid ${theme.palette.divider}`
          }}
        >
          <Typography 
            variant="subtitle1" 
            gutterBottom
            sx={{ 
              fontWeight: 500,
              color: theme.palette.text.primary
            }}
          >
            {currentPosition.entityIndex === -1 
              ? "Which of the following best describes this sentence?" 
              : "Which of the following best describes this entity?"}
          </Typography>

          <QuestionsList
            questions={currentData.questions}
            selectedAnswer={currentData.selectedAnswer}
            onAnswerSelect={handleAnswerSelect}
            disabled={isCompleting}
          />

          <NavigationButtons
            onPrevious={movePrevious}
            onNext={moveNext}
            onComplete={handleCompletion}
            isFirstQuestion={isFirstQuestion}
            isLastItem={isLastItem}
            hasSelection={Boolean(currentData.selectedAnswer)}
            isCompleting={isCompleting}
          />
        </Paper>
      </AutoScrollAnnotation>
    </Container>
    {SnackbarComponent}
  </Box>
);
};

export default memo(UserAnnotationDashboard);