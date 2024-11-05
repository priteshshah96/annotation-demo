// src/components/dashboard/DashboardHeader.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton, 
  Avatar, 
  Tooltip,
  useTheme 
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const DashboardHeader = ({ 
  userName, 
  userEmail = '',
  avatarUrl = '',
  onSignOut, 
  onHelp = () => {}
}) => {
  const theme = useTheme();

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mt: 4, 
        mb: 4,
        [theme.breakpoints.down('sm')]: {
          flexDirection: 'column',
          gap: 2
        }
      }}
    >
      {/* Left side - Title */}
      <Typography 
        variant="h4" 
        sx={{ 
          fontWeight: 600,
          color: theme.palette.primary.main,
          [theme.breakpoints.down('sm')]: {
            fontSize: '1.75rem'
          }
        }}
      >
        Annotation Dashboard
      </Typography>

      {/* Right side - User info and actions */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          [theme.breakpoints.down('sm')]: {
            width: '100%',
            justifyContent: 'center'
          }
        }}
      >
        {/* Help Button */}
        <Tooltip title="View Documentation">
          <IconButton 
            onClick={onHelp}
            size="small"
            sx={{ 
              bgcolor: theme.palette.grey[100],
              '&:hover': {
                bgcolor: theme.palette.grey[200]
              }
            }}
          >
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* User Info */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          px: 2,
          py: 0.5,
          borderRadius: 2,
          bgcolor: theme.palette.grey[50],
          border: `1px solid ${theme.palette.grey[200]}`
        }}>
          <Avatar 
            src={avatarUrl}
            alt={userName}
            sx={{ 
              width: 32, 
              height: 32,
              border: `2px solid ${theme.palette.primary.main}`
            }}
          >
            {userName?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Box>
            <Typography 
              variant="subtitle2" 
              sx={{ 
                fontWeight: 600,
                lineHeight: 1.2 
              }}
            >
              {userName}
            </Typography>
            {userEmail && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: theme.palette.text.secondary,
                  display: 'block',
                  lineHeight: 1
                }}
              >
                {userEmail}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Sign Out Button */}
        <Button
          variant="outlined"
          onClick={onSignOut}
          startIcon={<LogoutIcon />}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            minWidth: 100,
            '&:hover': {
              bgcolor: theme.palette.error.lighter,
              borderColor: theme.palette.error.main,
              color: theme.palette.error.main
            }
          }}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );
};

DashboardHeader.propTypes = {
  userName: PropTypes.string.isRequired,
  userEmail: PropTypes.string,
  avatarUrl: PropTypes.string,
  onSignOut: PropTypes.func.isRequired,
  onHelp: PropTypes.func
};

export default DashboardHeader;