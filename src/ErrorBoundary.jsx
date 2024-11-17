import React from 'react';
import { Box, Typography, Button } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
    // Additional logging or error reporting can be added here
    // For example, sending error details to a monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Send error details to an external logging service
      fetch('/api/logError', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: error.toString(),
          errorInfo,
          location: window.location.href,
        }),
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: 2,
            p: 3,
          }}
        >
          <Typography variant="h5" color="error">
            Something went wrong loading the application
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {this.state.error?.message || 'Unknown error occurred'}
          </Typography>
          <Button
            variant="contained"
            onClick={() => window.location.reload()}
          >
            Reload Application
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;