// src/components/annotation/AnnotationContent.jsx
import React, { memo } from 'react';
import { Paper, Box, Typography, IconButton, Collapse, Tooltip, Chip, useTheme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PropTypes from 'prop-types';
import { alpha } from '@mui/material/styles';


const AbstractHeader = memo(({ abstractIndex, totalAbstracts, paperCode, expanded, onToggleExpand }) => {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Box display="flex" alignItems="center" gap={2}>
        <Typography variant="h6">
          Abstract {abstractIndex + 1} of {totalAbstracts}
        </Typography>
        <Tooltip title="Paper identifier">
          <Chip
            label={paperCode}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Tooltip>
      </Box>
      <Tooltip title={expanded ? "Collapse abstract" : "Expand abstract"}>
        <IconButton onClick={onToggleExpand}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Tooltip>
    </Box>
  );
});

const SentenceSection = memo(({ sentence, sentenceIndex, totalSentences }) => {
  return (
    <Box sx={{ mt: 3 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Typography variant="subtitle1" component="div">
          Current sentence
        </Typography>
        <Chip 
          label={`${sentenceIndex + 1} of ${totalSentences}`}
          size="small"
          color="secondary"
          variant="outlined"
        />
      </Box>
      <Paper 
        variant="outlined"
        sx={{ 
          p: 2,
          bgcolor: 'grey.50',
          border: '2px solid',
          borderColor: 'primary.light'
        }}
      >
        <Typography variant="body1">
          {sentence.text}
        </Typography>
      </Paper>
    </Box>
  );
});

const EntitySection = memo(({ entity, entityIndex, totalEntities }) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ mt: 3 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Typography variant="subtitle1" component="div">
          Scientific entity
        </Typography>
        <Chip 
          label={`${entityIndex + 1} of ${totalEntities}`}
          size="small"
          color="info"
          variant="outlined"
        />
      </Box>
      <Paper 
        variant="outlined"
        sx={{ 
          p: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.05),
          border: '2px solid',
          borderColor: 'primary.main'
        }}
      >
        <Typography 
          variant="body1"
          sx={{ 
            fontWeight: 500,
            color: 'primary.main'
          }}
        >
          {entity.entity}
        </Typography>
      </Paper>
    </Box>
  );
});

const AnnotationContent = ({
  abstract,
  sentence,
  entity,
  expanded,
  onToggleExpand,
  abstractIndex,
  totalAbstracts,
  sentenceIndex,
  totalSentences,
  entityIndex,
  totalEntities
}) => {
  const theme = useTheme();

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        padding: 2, 
        marginBottom: 2,
        transition: theme.transitions.create(['box-shadow', 'transform'], {
          duration: theme.transitions.duration.standard
        })
      }}
    >
      <AbstractHeader 
        abstractIndex={abstractIndex}
        totalAbstracts={totalAbstracts}
        paperCode={abstract.paper_code}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
      />
      
      <Collapse in={expanded}>
        <Typography 
          variant="body1" 
          sx={{ 
            marginTop: 2,
            marginBottom: 1,
            whiteSpace: 'pre-wrap',
            backgroundColor: theme.palette.grey[50],
            padding: 2,
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
            transition: theme.transitions.create('all', {
              duration: theme.transitions.duration.standard
            })
          }}
        >
          {abstract.abstract}
        </Typography>
      </Collapse>

      <SentenceSection 
        sentence={sentence}
        sentenceIndex={sentenceIndex}
        totalSentences={totalSentences}
      />

      {entityIndex >= 0 && entity && (
        <EntitySection 
          entity={entity}
          entityIndex={entityIndex}
          totalEntities={totalEntities}
        />
      )}
    </Paper>
  );
};

AbstractHeader.propTypes = {
  abstractIndex: PropTypes.number.isRequired,
  totalAbstracts: PropTypes.number.isRequired,
  paperCode: PropTypes.string.isRequired,
  expanded: PropTypes.bool.isRequired,
  onToggleExpand: PropTypes.func.isRequired
};

SentenceSection.propTypes = {
  sentence: PropTypes.shape({
    text: PropTypes.string.isRequired
  }).isRequired,
  sentenceIndex: PropTypes.number.isRequired,
  totalSentences: PropTypes.number.isRequired
};

EntitySection.propTypes = {
  entity: PropTypes.shape({
    entity: PropTypes.string.isRequired
  }).isRequired,
  entityIndex: PropTypes.number.isRequired,
  totalEntities: PropTypes.number.isRequired
};

AnnotationContent.propTypes = {
  abstract: PropTypes.shape({
    paper_code: PropTypes.string.isRequired,
    abstract: PropTypes.string.isRequired
  }).isRequired,
  sentence: PropTypes.shape({
    text: PropTypes.string.isRequired
  }).isRequired,
  entity: PropTypes.shape({
    entity: PropTypes.string.isRequired
  }),
  expanded: PropTypes.bool.isRequired,
  onToggleExpand: PropTypes.func.isRequired,
  abstractIndex: PropTypes.number.isRequired,
  totalAbstracts: PropTypes.number.isRequired,
  sentenceIndex: PropTypes.number.isRequired,
  totalSentences: PropTypes.number.isRequired,
  entityIndex: PropTypes.number.isRequired,
  totalEntities: PropTypes.number.isRequired
};

export default memo(AnnotationContent);