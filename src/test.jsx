// test.jsx
import React, { useState } from 'react';
import { 
  Container, 
  Typography, 
  Button, 
  Paper, 
  Box, 
  CircularProgress, 
  Alert,
  Divider
} from '@mui/material';
import { useAuth, useUser } from '@clerk/clerk-react';

const TestPage = () => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [dbResult, setDbResult] = useState(null);
  const [filesResult, setFilesResult] = useState(null);
  const [error, setError] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    setDbResult(null);
    setFilesResult(null);
    setTokenInfo(null);

    try {
      // Test database connection
      console.log('Testing database connection...');
      const dbResponse = await fetch('/api/test-connection');
      if (!dbResponse.ok) {
        throw new Error(`Database test failed with status: ${dbResponse.status}`);
      }
      const dbData = await dbResponse.json();
      setDbResult(dbData);
      console.log('Database test result:', dbData);

      // Get and log token info
      const token = await getToken();
      console.log('Auth token obtained');
      setTokenInfo({
        tokenExists: !!token,
        tokenLength: token?.length,
        tokenPrefix: token?.substring(0, 10) + '...',
        userId: user?.id // Add user ID for verification
      });

      // Test files API with detailed logging
      console.log('Testing files API...');
      console.log('User ID:', user?.id);
      console.log('Token prefix:', token?.substring(0, 10));
      
      const filesResponse = await fetch('/api/files', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Files API response status:', filesResponse.status);
      const filesData = await filesResponse.json();
      console.log('Files API raw response:', filesData);
      
      if (!filesResponse.ok) {
        throw new Error(`Files API error: ${filesData.error || filesResponse.statusText}`);
      }

      setFilesResult(filesData);

    } catch (err) {
      console.error('Test error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        code: err.code
      });
      setError({
        message: err.message,
        stack: err.stack,
        type: err.constructor.name,
        details: err.details || 'No additional details available',
        code: err.code
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          API Tests
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Current User ID: {user?.id || 'Not logged in'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            User Email: {user?.emailAddresses?.[0]?.emailAddress || 'No email'}
          </Typography>
        </Box>

        <Button 
          variant="contained" 
          onClick={testConnection}
          disabled={loading}
          sx={{ mb: 3 }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={24} sx={{ mr: 1, color: 'white' }} />
              Testing...
            </Box>
          ) : (
            'Run Tests'
          )}
        </Button>

        {/* Rest of the component remains the same */}
        {/* ... */}
      </Box>
    </Container>
  );
};

export default TestPage;