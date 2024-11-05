import React from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  LinearProgress, 
  IconButton, 
  Tooltip,
  Badge
} from '@mui/material';
import { 
  ArrowBack as BackIcon,
  CloudDone as SavedIcon,
  CloudQueue as SavingIcon,
  CloudOff as OfflineIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import PropTypes from 'prop-types';
import { useFileProgress } from '../../hooks/useFileProgress';

export const AnnotationHeader = ({ 
  onBack, 
  syncStatus, 
  fileName, 
  fileId 
}) => {
  const progress = useFileProgress(fileId);

  const getSyncIcon = () => {
    switch (syncStatus.status) {
      case 'saving':
        return <SavingIcon sx={{ 
          animation: 'spin 2s linear infinite',
          '@keyframes spin': {
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' }
          }
        }} />;
      case 'saved':
        return <SavedIcon color="success" />;
      case 'offline':
        return <OfflineIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return null;
    }
  };

  const getSyncTooltip = () => {
    switch (syncStatus.status) {
      case 'saving':
        return 'Saving changes...';
      case 'saved':
        return `Last saved: ${new Date(syncStatus.lastSync).toLocaleTimeString()}`;
      case 'offline':
        return 'Working offline - changes will sync when connected';
      case 'error':
        return 'Error saving changes - will retry automatically';
      default:
        return '';
    }
  };

  const getProgressColor = (value) => {
    if (value >= 100) return 'success.main';
    if (value >= 50) return 'primary.main';
    return 'primary.main';
  };

  return (
    <Box sx={{ 
      position: 'sticky', 
      top: 0, 
      bgcolor: 'background.default', 
      zIndex: 10,
      py: 2,
      borderBottom: 1,
      borderColor: 'divider',
      backdropFilter: 'blur(8px)',
      boxShadow: 'rgba(0, 0, 0, 0.05) 0px 1px 2px 0px'
    }}>
      {/* Header Content */}
      <Box 
        display="flex" 
        alignItems="center" 
        justifyContent="space-between" 
        mb={2}
        px={1}
      >
        {/* Left Side - Back Button & Title */}
        <Box display="flex" alignItems="center" gap={2}>
          <Tooltip title="Back to Dashboard">
            <IconButton 
              onClick={onBack} 
              size="small"
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
            >
              <BackIcon />
            </IconButton>
          </Tooltip>
          <Typography 
            variant="h4"
            sx={{
              fontSize: { xs: '1.5rem', sm: '2rem' },
              fontWeight: 500,
              color: 'text.primary'
            }}
          >
            {fileName || 'Annotation Tool'}
          </Typography>
        </Box>

        {/* Right Side - Sync Status */}
        {syncStatus.show && (
          <Tooltip title={getSyncTooltip()}>
            <Badge
              color={syncStatus.status === 'saved' ? 'success' : 'default'}
              variant="dot"
              sx={{ 
                mr: 2,
                '& .MuiBadge-badge': {
                  animation: syncStatus.status === 'saving' ? 'pulse 1.5s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.4 },
                    '100%': { opacity: 1 }
                  }
                }
              }}
            >
              {getSyncIcon()}
            </Badge>
          </Tooltip>
        )}
      </Box>

      {/* Progress Bar */}
      <Box 
        sx={{ 
          position: 'relative', 
          mb: 1,
          px: 1,
          mt: 1
        }}
      >
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ 
            height: 8,
            borderRadius: 4,
            bgcolor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              backgroundColor: getProgressColor(progress),
              transition: 'transform 0.4s ease, background-color 0.4s ease'
            }
          }} 
        />
        {/* Progress Label */}
        <Box
          sx={{
            position: 'absolute',
            right: 8,
            top: -24,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontWeight: 500
            }}
          >
            Progress:
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: getProgressColor(progress),
              fontWeight: 600
            }}
          >
            {Math.round(progress)}%
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

AnnotationHeader.propTypes = {
  onBack: PropTypes.func.isRequired,
  syncStatus: PropTypes.shape({
    show: PropTypes.bool.isRequired,
    status: PropTypes.oneOf(['saving', 'saved', 'error', 'offline']).isRequired,
    lastSync: PropTypes.string
  }).isRequired,
  fileName: PropTypes.string,
  fileId: PropTypes.string.isRequired
};

export default React.memo(AnnotationHeader);