import { useAuth } from '@clerk/clerk-react';
import { useState, useCallback } from 'react';

class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = 'ApiError';
  }
}

export function useApi() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = await getToken();
      if (!token) {
        throw new ApiError('No authentication token available', 401);
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
        throw new ApiError(
          data.error || 'API request failed',
          response.status,
          data.details
        );
      }

      return data;
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('Network error', 500, error.message);
      setError(apiError);
      throw apiError;
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