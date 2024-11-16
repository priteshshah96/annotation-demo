// src/lib/api.js

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Custom Error Classes
export class RetryableError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'RetryableError';
    this.status = status;
  }
}

export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

class ApiClient {
  constructor(options = {}) {
    this.baseUrl = this.getBaseUrl();
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries || MAX_RETRIES;
    this.retryDelay = options.retryDelay || RETRY_DELAY;
    
    // Log configuration on initialization
    console.log('API Client initialized:', {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      maxRetries: this.maxRetries
    });
  }

  getBaseUrl() {
    // Enhanced URL handling for Vercel deployment
    if (typeof window === 'undefined') {
      // Server-side
      return process.env.VERCEL_URL ? 
        `https://${process.env.VERCEL_URL}/api/vercel` : 
        'http://localhost:3000/api/vercel';
    }
    
    // Client-side
    const apiUrl = import.meta.env.VITE_API_URL || '/api/vercel';
    const origin = window.location.origin;
    console.log('Using API URL:', `${origin}${apiUrl}`);
    return `${origin}${apiUrl}`;
}

  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log(`Making request to: ${url}`, {
        method: options.method || 'GET',
        headers: options.headers
      });

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      console.error('Request failed:', {
        url,
        error: error.message,
        name: error.name
      });
      
      if (error.name === 'AbortError') {
        throw new ApiError('Request timed out', 408);
      }
      throw error;
    }
  }

  async fetchWithRetry(url, options = {}, retryCount = 0) {
    try {
      const response = await this.fetchWithTimeout(url, options);
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('API Error Response:', {
          status: response.status,
          data,
          url
        });
        
        // Check if error is retryable
        if (response.status >= 500 || response.status === 429) {
          throw new RetryableError(data.error || 'Server error', response.status);
        }
        
        throw new ApiError(data.error || 'Request failed', response.status, data.details);
      }

      return response;
    } catch (error) {
      if (error instanceof RetryableError && retryCount < this.maxRetries) {
        const nextRetry = retryCount + 1;
        console.log(`Retrying request (${nextRetry}/${this.maxRetries}):`, url);
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
        return this.fetchWithRetry(url, options, nextRetry);
      }
      throw error;
    }
  }

  async request(endpoint, options = {}) {
    try {
      const token = await window.Clerk?.session?.getToken();
      if (!token) {
        console.error('No authentication token available');
        throw new ApiError('Authentication required', 401);
      }

      const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      
      const requestOptions = {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      };

      console.log(`API Request: ${options.method || 'GET'} ${url}`);
      const response = await this.fetchWithRetry(url, requestOptions);
      const data = await response.json();
      
      return data;
    } catch (error) {
      console.error('API request failed:', {
        endpoint,
        error: error.message,
        status: error.status,
        details: error.details
      });
      throw error;
    }
  }

  // API Methods with enhanced error handling
  files = {
    getAll: async () => {
      try {
        return await this.request('/files');
      } catch (error) {
        console.error('Failed to get files:', error);
        throw error;
      }
    },
    get: async (id) => {
      try {
        return await this.request(`/files/${id}`);
      } catch (error) {
        console.error(`Failed to get file ${id}:`, error);
        throw error;
      }
    },
    upload: async (data) => {
      try {
        return await this.request('/files/upload', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      } catch (error) {
        console.error('Failed to upload file:', error);
        throw error;
      }
    },
    delete: async (id) => {
      try {
        return await this.request(`/files/${id}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.error(`Failed to delete file ${id}:`, error);
        throw error;
      }
    }
  };

  annotations = {
    get: async (fileId) => {
      try {
        return await this.request(`/annotations/${fileId}`);
      } catch (error) {
        console.error(`Failed to get annotations for file ${fileId}:`, error);
        throw error;
      }
    },
    save: async (data) => {
      try {
        return await this.request('/annotations', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      } catch (error) {
        console.error('Failed to save annotation:', error);
        throw error;
      }
    },
    sync: async (fileId, data) => {
      try {
        return await this.request(`/annotations/${fileId}/sync`, {
          method: 'POST',
          body: JSON.stringify(data)
        });
      } catch (error) {
        console.error(`Failed to sync annotations for file ${fileId}:`, error);
        throw error;
      }
    },
    reset: async (fileId) => {
      try {
        return await this.request(`/annotations/${fileId}/reset`, {
          method: 'POST'
        });
      } catch (error) {
        console.error(`Failed to reset annotations for file ${fileId}:`, error);
        throw error;
      }
    }
  };

  user = {
    sync: async () => {
      try {
        return await this.request('/user/sync', {
          method: 'POST'
        });
      } catch (error) {
        console.error('Failed to sync user:', error);
        throw error;
      }
    }
  };
}

export const api = new ApiClient();