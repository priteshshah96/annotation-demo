// src/hooks/useApi.js
import { useAuth } from '@clerk/clerk-react';
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { enqueueSnackbar } from './useSnackbar';

const REQUEST_TIMEOUT = 15000;

class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function useApi() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const handleApiError = (error) => {
    console.error('[API Error]:', error);
    let message = error.message || 'An unexpected error occurred';
    let variant = 'error';

    if (error.status === 401) {
      message = 'Please sign in to continue';
      navigate('/sign-in');
    } else if (error.status === 408) {
      message = 'Request timed out. Please try again.';
      variant = 'warning';
    } else if (error.status === 429) {
      message = 'Too many requests. Please try again later.';
      variant = 'warning';
    }

    enqueueSnackbar(message, {
      variant,
      autoHideDuration: 5000,
      preventDuplicate: true
    });

    setError(error);
  };

  const fetchWithTimeout = async (url, options = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        navigate('/sign-in');
        throw new ApiError('Authentication required', 401);
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, REQUEST_TIMEOUT);

      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || 'Request failed',
          response.status,
          errorData.details
        );
      }

      const data = await response.json().catch(() => ({}));
      return data;
    } catch (error) {
      handleApiError(error);
      throw error;
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const api = {
    user: {
      sync: async () => {
        return fetchWithTimeout('/api/vercel/v1/auth/sync', {
          method: 'POST'
        });
      }
    },
    annotations: {
      get: async (fileId) => {
        return fetchWithTimeout(`/api/vercel/v1/annotations/${fileId}`);
      },
      save: async (data) => {
        return fetchWithTimeout(`/api/vercel/v1/annotations/${data.fileId}`, {
          method: 'POST',
          body: JSON.stringify(data)
        });
      },
      sync: async (fileId, data) => {
        return fetchWithTimeout(`/api/vercel/v1/annotations/${fileId}/sync`, {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }
    }
  };

  return {
    api,
    isLoading,
    error
  };
}