// src/hooks/useApi.js
import { useAuth } from '@clerk/clerk-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const REQUEST_TIMEOUT = 15000; // Increased timeout
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

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
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ApiError('Request failed', response.status);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const api = {
    user: {
      sync: async () => {
        const token = await getToken();
        return fetchWithTimeout('/api/vercel/user/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
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