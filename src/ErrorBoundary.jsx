import React from 'react';
import { Box, Typography, Button, Alert, AlertTitle } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console
    console.error('Uncaught Error:', error, errorInfo);

    // Update state with full error information
    this.setState({ 
      hasError: true, 
      error, 
      errorInfo 
    });

    // Attempt to log error in production
    if (process.env.NODE_ENV === 'production') {
      try {
        fetch('/api/vercel/error/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            error: error.toString(),
            errorInfo: errorInfo,
            location: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }),
        }).catch(logError => {
          console.error('Failed to log error:', logError);
        });
      } catch (logError) {
        console.error('Error logging failed:', logError);
      }
    }
  }

  handleReload = () => {
    // Attempt to reload the page or navigate to a safe route
    try {
      window.location.href = '/';
    } catch (navigateError) {
      console.error('Navigation failed:', navigateError);
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
            backgroundColor: '#f5f5f5'
          }}
        >
          <Alert 
            severity="error" 
            sx={{ 
              width: '100%', 
              maxWidth: 600,
              boxShadow: 2 
            }}
          >
            <AlertTitle>Application Error</AlertTitle>
            <Typography variant="body1" sx={{ mb: 2 }}>
              An unexpected error occurred while loading the application.
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Error Details: {this.state.error?.message || 'Unknown error'}
            </Typography>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                variant="contained" 
                color="primary"
                onClick={this.handleReload}
              >
                Reload Application
              </Button>
              <Button 
                variant="outlined" 
                color="secondary"
                onClick={() => window.location.href = '/support'}
              >
                Contact Support
              </Button>
            </Box>
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;