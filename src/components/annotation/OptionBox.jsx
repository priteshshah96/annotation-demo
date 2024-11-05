import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import PropTypes from 'prop-types';

// Use default parameters directly in the function arguments instead of defaultProps
export const OptionBox = ({ 
  text, 
  isSelected = false, // Default parameter here
  onClick, 
  disabled = false  // Default parameter here
}) => {
  const theme = useTheme();

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled && onClick) {
        onClick();
      }
    }
  };

  return (
    <Box
      onClick={disabled ? undefined : onClick}
      onKeyPress={handleKeyPress}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-pressed={isSelected}
      sx={{
        padding: 2,
        margin: 1,
        border: '1px solid',
        borderColor: isSelected 
          ? theme.palette.primary.main
          : theme.palette.divider,
        borderRadius: 2,
        backgroundColor: isSelected 
          ? alpha(theme.palette.primary.main, 0.08)
          : theme.palette.background.paper,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: theme.transitions.create([
          'background-color',
          'border-color',
          'transform'
        ], {
          duration: theme.transitions.duration.shorter
        }),
        '&:hover': disabled ? {} : {
          backgroundColor: isSelected 
            ? alpha(theme.palette.primary.main, 0.12)
            : alpha(theme.palette.primary.main, 0.04),
          transform: 'translateY(-1px)',
          boxShadow: theme.shadows[1]
        },
        '&:active': disabled ? {} : {
          transform: 'translateY(0)',
          boxShadow: 'none'
        },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2
        },
        opacity: disabled ? 0.6 : 1,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Typography 
        variant="body1"
        sx={{
          color: isSelected 
            ? theme.palette.primary.main 
            : theme.palette.text.primary,
          fontWeight: isSelected ? 500 : 400,
          position: 'relative',
          userSelect: 'none'
        }}
      >
        {text}
      </Typography>

      {isSelected && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: theme.palette.primary.main,
          }}
        />
      )}
    </Box>
  );
};

OptionBox.propTypes = {
  text: PropTypes.string.isRequired,
  isSelected: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

// Remove defaultProps
// OptionBox.defaultProps = {
//   isSelected: false,
//   disabled: false
// };

export default React.memo(OptionBox);