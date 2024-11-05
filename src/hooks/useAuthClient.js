import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

export function useAuthClient() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  const api = {
    files: {
      getAll: () => fetchWithAuth('/api/files'),
      get: (id) => fetchWithAuth(`/api/files/${id}`),
      upload: (data) => fetchWithAuth('/api/files/upload', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
      delete: (id) => fetchWithAuth(`/api/files/${id}`, {
        method: 'DELETE'
      })
    },
    annotations: {
      get: (fileId) => fetchWithAuth(`/api/annotations?fileId=${fileId}`),
      save: (data) => fetchWithAuth('/api/annotations', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }
  };

  return {
    api,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}