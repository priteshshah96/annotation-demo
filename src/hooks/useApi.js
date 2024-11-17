// src/hooks/useApi.js
import { useAuth } from '@clerk/clerk-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const REQUEST_TIMEOUT = 8000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

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
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const log = (message, data = {}) => {
    console.log(`[useApi] ${message}`, data);
  };

  const fetchWithAuth = useCallback(async (url, options = {}, retryCount = 0) => {
    if (abortControllerRef.current) {
      log("Aborting previous request");
      abortControllerRef.current.abort();
    }

    try {
      if (!mountedRef.current) return null;
      setIsLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        log("Token missing, redirecting to sign-in");
        navigate('/sign-in');
        throw new ApiError('Authentication required', 401);
      }

      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          log("Request timeout triggered");
          abortControllerRef.current.abort();
        }
      }, REQUEST_TIMEOUT);

      const baseUrl = '/api/vercel';
      const fullUrl = `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;

      log("Making API request", { url: fullUrl, retryCount });

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

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        log("API response error", { status: response.status, data });

        // Handle specific error cases
        switch (response.status) {
          case 401:
          case 403:
            navigate('/sign-in');
            throw new ApiError('Authentication required', response.status);
          case 404:
            throw new ApiError('Resource not found', response.status);
          case 429:
            if (retryCount < MAX_RETRIES) {
              log(`Rate limit hit, retrying (${retryCount + 1}/${MAX_RETRIES})`);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
              return fetchWithAuth(url, options, retryCount + 1);
            }
            throw new ApiError('Rate limit exceeded', response.status);
          case 500:
          case 502:
          case 503:
          case 504:
            if (retryCount < MAX_RETRIES) {
              log(`Server error, retrying (${retryCount + 1}/${MAX_RETRIES})`);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
              return fetchWithAuth(url, options, retryCount + 1);
            }
            throw new ApiError('Server error', response.status);
          default:
            throw new ApiError(data.error || 'Request failed', response.status, data.details);
        }
      }

      log("API request successful");
      return {
        success: true,
        ...data
      };

    } catch (error) {
      if (!mountedRef.current) return null;

      if (error.name === 'AbortError') {
        log("Request aborted");
        throw new ApiError('Request timeout', 408);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      log("Error during API request", { error });
      throw new ApiError(error.message || 'Unknown error', 500);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [getToken, navigate]);

  const api = {
    user: {
      sync: async () => fetchWithAuth('/user/sync', { method: 'POST' })
    },
    files: {
      getAll: async () => fetchWithAuth('/files'),
      get: async (id) => fetchWithAuth(`/files/${id}`),
      upload: async (data) => fetchWithAuth('/files/upload', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
      delete: async (id) => fetchWithAuth(`/files/${id}`, {
        method: 'DELETE'
      }),
      getUserStats: async () => fetchWithAuth('/files/stats')
    },
    annotations: {
      get: async (fileId) => fetchWithAuth(`/annotations/${fileId}`),
      save: async (data) => fetchWithAuth('/annotations', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
      sync: async (fileId, data) => fetchWithAuth(`/annotations/${fileId}/sync`, {
        method: 'POST',
        body: JSON.stringify(data)
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
        log("Aborting all pending requests");
        abortControllerRef.current.abort();
      }
    }
  };
}