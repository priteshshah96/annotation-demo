import { useAuth } from '@clerk/clerk-react';
import { useState, useCallback, useRef } from 'react';

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
  const abortControllerRef = useRef(null);

  const fetchWithAuth = useCallback(async (url, options = {}, retryCount = 3) => {
    try {
      setIsLoading(true);
      setError(null);

      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();
      
      const token = await getToken();
      if (!token) {
        throw new ApiError('No authentication token available', 401);
      }

      // Get base URL from environment or default
      const baseUrl = process.env.VITE_API_URL || window.location.origin;
      const fullUrl = `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;

      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: abortControllerRef.current.signal,
        credentials: 'include'
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
      // Don't retry if request was aborted or unauthorized
      if (error.name === 'AbortError' || error.status === 401) {
        throw error;
      }

      // Implement retry logic
      if (retryCount > 0) {
        console.log(`Retrying request... (${retryCount} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchWithAuth(url, options, retryCount - 1);
      }

      const apiError = error instanceof ApiError ? error : new ApiError('Network error', 500, error.message);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  const api = {
    files: {
      getAll: (options = {}) => fetchWithAuth('/api/files', options),
      get: (id, options = {}) => fetchWithAuth(`/api/files/${id}`, options),
      upload: (data, options = {}) => fetchWithAuth('/api/files/upload', {
        method: 'POST',
        body: JSON.stringify(data),
        ...options
      }),
      delete: (id, options = {}) => fetchWithAuth(`/api/files/${id}`, {
        method: 'DELETE',
        ...options
      })
    },
    annotations: {
      get: (fileId, options = {}) => fetchWithAuth(`/api/annotations/${fileId}`, options),
      save: (data, options = {}) => fetchWithAuth('/api/annotations', {
        method: 'POST',
        body: JSON.stringify(data),
        ...options
      }),
      sync: (fileId, data, options = {}) => fetchWithAuth(`/api/annotations/${fileId}/sync`, {
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