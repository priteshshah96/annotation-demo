// src/hooks/useSnackbar.jsx
import { useState } from 'react';
import { Snackbar, Alert } from '@mui/material';

export const useSnackbar = () => {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const hideSnackbar = () => {
    setSnackbar(prev => ({
      ...prev,
      open: false
    }));
  };

  const SnackbarComponent = (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={6000}
      onClose={hideSnackbar}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={hideSnackbar}
        severity={snackbar.severity}
        variant="filled"
        elevation={6}
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
  );

  return {
    showSnackbar,
    hideSnackbar,
    SnackbarComponent
  };
};

export default useSnackbar;