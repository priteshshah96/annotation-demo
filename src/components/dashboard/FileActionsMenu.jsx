import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  useTheme,
  alpha,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  DeleteOutline as DeleteIcon,
  DownloadOutlined as DownloadIcon,
  RestartAltOutlined as ResetIcon,
  VisibilityOutlined as ViewIcon,
  ErrorOutline as WarningIcon,
} from '@mui/icons-material';
import { useResetAnnotations } from '../../hooks/useResetAnnotations';
import { annotationApi } from '../../services/annotationApi';

const EVENT_TYPES = [
  'Background/Introduction',
  'Methods/Approach',
  'Results/Findings',
  'Conclusions/Implications',
];

const ConfirmationDialog = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  severity = 'error',
  loading = false,
}) => {
  const theme = useTheme();

  const getSeverityColor = () => {
    switch (severity) {
      case 'error':
        return theme.palette.error;
      case 'warning':
        return theme.palette.warning;
      default:
        return theme.palette.info;
    }
  };

  const color = getSeverityColor();

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: 400,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: alpha(color.main, 0.1),
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <WarningIcon sx={{ color: color.main }} />
        <Typography variant="h6" component="span" sx={{ color: color.main }}>
          {title}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Typography>{message}</Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: 'grey.50' }}>
        <Button
          onClick={onCancel}
          variant="outlined"
          disabled={loading}
          sx={{ minWidth: 100 }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={severity}
          disabled={loading}
          sx={{
            minWidth: 100,
            position: 'relative',
          }}
        >
          {loading && (
            <CircularProgress
              size={24}
              sx={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                marginLeft: '-12px',
                marginTop: '-12px',
              }}
            />
          )}
          <span style={{ opacity: loading ? 0 : 1 }}>{confirmText}</span>
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const FileActionsMenu = ({
  anchorEl,
  onClose,
  onDelete,
  onNavigate,
  file,
  disabledActions = [],
}) => {
  const { resetAnnotations, isResetting } = useResetAnnotations(file?._id);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    action: null,
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    severity: 'error',
  });

  const handleAction = async (action) => {
    switch (action) {
      case 'view':
        if (onNavigate && file?._id) {
          // Navigate to annotation dashboard with view mode query parameter
          onNavigate(`/annotate/${file._id}?mode=view`);
          onClose();
        }
        break;

      case 'delete':
        setConfirmDialog({
          open: true,
          action: 'delete',
          title: 'Delete File',
          message: `Are you sure you want to delete "${file?.name}"? This action cannot be undone.`,
          confirmText: 'Delete',
          cancelText: 'Cancel',
          severity: 'error',
        });
        break;

      case 'download':
        try {
          const response = await annotationApi.getFileWithAnnotations(file._id);
          if (!response?.file) {
            throw new Error('Failed to get annotations');
          }

          const downloadData = {
            papers: response.file.papers.map((paper) => ({
              paper_code: paper.paper_code || '',
              abstract: paper.abstract || '',
              events: paper.events.map((event) => {
                const activeEventType = EVENT_TYPES.find((type) => type in event);
                const baseData = {};
                if (activeEventType) {
                  baseData[activeEventType] = event[activeEventType] || '';
                }

                Object.assign(baseData, {
                  Text: event.Text || '',
                  'Main Action': event['Main Action'] || '',
                  Arguments: {
                    Agent: event.Arguments?.Agent || [],
                    Object: {
                      'Primary Object': event.Arguments?.Object?.['Primary Object'] || [],
                      'Primary Modifier': event.Arguments?.Object?.['Primary Modifier'] || [],
                      'Secondary Object': event.Arguments?.Object?.['Secondary Object'] || [],
                      'Secondary Modifier': event.Arguments?.Object?.['Secondary Modifier'] || [],
                    },
                    Context: event.Arguments?.Context || [],
                    Purpose: event.Arguments?.Purpose || [],
                    Method: event.Arguments?.Method || [],
                    Results: event.Arguments?.Results || [],
                    Analysis: event.Arguments?.Analysis || [],
                    Challenge: event.Arguments?.Challenge || [],
                    Ethical: event.Arguments?.Ethical || [],
                    Implications: event.Arguments?.Implications || [],
                    Contradictions: event.Arguments?.Contradictions || [],
                  },
                });

                return baseData;
              }),
            })),
          };

          const jsonString = JSON.stringify(downloadData, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const outputFilename = file.name.replace(/\.json$/, '') + '_annotated.json';

          link.href = url;
          link.download = outputFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Error downloading annotations:', error);
        }
        onClose();
        break;

      case 'reset':
        setConfirmDialog({
          open: true,
          action: 'reset',
          title: 'Reset Annotations',
          message: `Are you sure you want to reset all annotations for "${file?.name}"? This action cannot be undone.`,
          confirmText: 'Reset',
          cancelText: 'Cancel',
          severity: 'warning',
        });
        break;

      default:
        onClose();
    }
  };

  const handleConfirm = async () => {
    try {
      switch (confirmDialog.action) {
        case 'delete':
          await onDelete();
          break;
        case 'reset':
          await resetAnnotations();
          if (file?._id) {
            onNavigate(`/annotate/${file._id}`);
          }
          break;
      }
      setConfirmDialog({ ...confirmDialog, open: false });
      onClose();
    } catch (error) {
      console.error('Action error:', error);
    }
  };

  const handleCancel = () => {
    setConfirmDialog({ ...confirmDialog, open: false });
  };

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={onClose}
        PaperProps={{
          elevation: 3,
          sx: {
            width: 220,
            '& .MuiList-root': {
              py: 1,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
        <MenuItem
          onClick={() => handleAction('view')}
          disabled={disabledActions.includes('view')}
        >
          <ListItemIcon>
            <ViewIcon />
          </ListItemIcon>
          <ListItemText primary="View Annotations" />
        </MenuItem>

        <MenuItem
          onClick={() => handleAction('download')}
          disabled={disabledActions.includes('download')}
        >
          <ListItemIcon>
            <DownloadIcon />
          </ListItemIcon>
          <ListItemText primary="Download Annotations" />
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        <MenuItem
          onClick={() => handleAction('reset')}
          disabled={disabledActions.includes('reset')}
        >
          <ListItemIcon>
            <ResetIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Reset Annotations"
            primaryTypographyProps={{
              color: 'warning.main',
            }}
          />
        </MenuItem>

        <MenuItem
          onClick={() => handleAction('delete')}
          disabled={disabledActions.includes('delete')}
        >
          <ListItemIcon>
            <DeleteIcon color="error" />
          </ListItemIcon>
          <ListItemText
            primary="Delete File"
            primaryTypographyProps={{
              color: 'error.main',
            }}
          />
        </MenuItem>
      </Menu>

      <ConfirmationDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        severity={confirmDialog.severity}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        loading={isResetting}
      />
    </>
  );
};

FileActionsMenu.propTypes = {
  anchorEl: PropTypes.any,
  onClose: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onNavigate: PropTypes.func.isRequired,
  file: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    progress: PropTypes.shape({
      paperIndex: PropTypes.number.isRequired,
      eventIndex: PropTypes.number.isRequired,
    }),
  }),
  disabledActions: PropTypes.arrayOf(PropTypes.string),
};

export default FileActionsMenu;