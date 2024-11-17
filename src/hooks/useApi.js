// src/hooks/useApi.js
import { useAuth } from '@clerk/clerk-react';
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const REQUEST_TIMEOUT = 15000;

export class ApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
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
        throw new ApiError('Request failed', response.status);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout');
      }
      throw error;
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