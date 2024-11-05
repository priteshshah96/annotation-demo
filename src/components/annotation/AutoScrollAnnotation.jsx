import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import PropTypes from 'prop-types';

const AutoScrollAnnotation = ({ 
  children,
  currentPosition,
  offset = 100
}) => {
  const contentRef = useRef(null);
  const lastPositionRef = useRef(currentPosition);

  useEffect(() => {
    const hasPositionChanged = 
      currentPosition.abstractIndex !== lastPositionRef.current.abstractIndex ||
      currentPosition.sentenceIndex !== lastPositionRef.current.sentenceIndex ||
      currentPosition.entityIndex !== lastPositionRef.current.entityIndex;

    if (hasPositionChanged && contentRef.current) {
      const scrollContainer = contentRef.current;
      const questionSection = scrollContainer.querySelector('[data-question-section]');
      
      if (questionSection) {
        setTimeout(() => {
          const containerHeight = window.innerHeight;
          const scrollToY = questionSection.offsetTop - (containerHeight / 3);
          
          window.scrollTo({
            top: scrollToY,
            behavior: 'smooth'
          });
        }, 100);
      }
      
      lastPositionRef.current = currentPosition;
    }
  }, [currentPosition]);

  return (
    <Box
      ref={contentRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        width: '100%',
        minHeight: '100%'
      }}
    >
      {children}
    </Box>
  );
};

AutoScrollAnnotation.propTypes = {
  children: PropTypes.node.isRequired,
  currentPosition: PropTypes.shape({
    abstractIndex: PropTypes.number.isRequired,
    sentenceIndex: PropTypes.number.isRequired,
    entityIndex: PropTypes.number.isRequired
  }).isRequired,
  offset: PropTypes.number
};

export default AutoScrollAnnotation;