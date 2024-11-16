// src/hooks/useApi.js
import { useAuth } from '@clerk/clerk-react';
import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const REQUEST_TIMEOUT = 8000;

export class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = 'ApiError';
  }
}

export function useApi() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    // Cleanup any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create new abort controller
      abortControllerRef.current = new AbortController();
      
      const token = await getToken();
      if (!token) {
        throw new ApiError('Authentication required', 401);
      }

      // Setup timeout
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, REQUEST_TIMEOUT);

      const baseUrl = '/api/vercel';
      const fullUrl = `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;

      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: abortControllerRef.current.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        switch (response.status) {
          case 401:
          case 403:
            navigate('/sign-in');
            throw new ApiError('Authentication required', response.status);
          case 404:
            throw new ApiError('Resource not found', response.status);
          case 429:
            throw new ApiError('Rate limit exceeded', response.status);
          default:
            throw new ApiError(data.error || 'Request failed', response.status, data.details);
        }
      }

      return data;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408);
      }
      throw error;
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [getToken, navigate]);

  // API endpoints with simplified error handling
  const api = {
    files: {
      getAll: (options = {}) => fetchWithAuth('/files', options),
      get: (id, options = {}) => fetchWithAuth(`/files/${id}`, options),
      upload: (data, options = {}) => fetchWithAuth('/files/upload', {
        method: 'POST',
        body: JSON.stringify(data),
        ...options
      }),
      delete: (id, options = {}) => fetchWithAuth(`/files/${id}`, {
        method: 'DELETE',
        ...options
      })
    },
    annotations: {
      get: (fileId, options = {}) => fetchWithAuth(`/annotations/${fileId}`, options),
      save: (data, options = {}) => fetchWithAuth('/annotations', {
        method: 'POST',
        body: JSON.stringify(data),
        ...options
      }),
      sync: (fileId, data, options = {}) => fetchWithAuth(`/annotations/${fileId}/sync`, {
        method: 'POST',
        body: JSON.stringify(data),
        ...options
      })
    }
  };

  return {
    api,
    isLoading,
    error,
    clearError: () => setError(null),
    abortRequests: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  };
}