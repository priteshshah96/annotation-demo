// src/hooks/useApi.js
import { useAuth } from '@clerk/clerk-react';
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const REQUEST_TIMEOUT = 15000;

export class ApiError extends Error {
  constructor(message, status = 500, details) {
    super(message);
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
          'Content-Type': 'application/json'
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
      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408);
      }
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error.message || 'Unknown error');
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const api = {
    user: {
      sync: async () => {
        return fetchWithTimeout('/api/user/sync', {
          method: 'POST'
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