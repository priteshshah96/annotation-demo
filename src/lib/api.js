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
    // Update baseUrl logic for Vercel
    this.baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL 
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : process.env.VITE_API_URL 
      || window.location.origin;
    
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries || MAX_RETRIES;
    this.retryDelay = options.retryDelay || RETRY_DELAY;
  }

  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
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
        
        // Check if error is retryable
        if (response.status >= 500 || response.status === 429) {
          throw new RetryableError(data.error || 'Server error', response.status);
        }
        
        throw new ApiError(data.error || 'Request failed', response.status, data.details);
      }

      return response;
    } catch (error) {
      if (error instanceof RetryableError && retryCount < this.maxRetries) {
        console.log(`Retrying request (${retryCount + 1}/${this.maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  async request(endpoint, options = {}) {
    const token = await window.Clerk.session?.getToken();
    if (!token) {
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

    try {
      console.log(`Making API request to ${endpoint}...`);
      const response = await this.fetchWithRetry(url, requestOptions);
      const data = await response.json();
      console.log(`API response from ${endpoint}:`, { status: response.status });
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

  // API Methods
  files = {
    getAll: () => this.request('/api/files'),
    get: (id) => this.request(`/api/files/${id}`),
    upload: (data) => this.request('/api/files/upload', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    delete: (id) => this.request(`/api/files/${id}`, {
      method: 'DELETE'
    })
  };

  annotations = {
    get: (fileId) => this.request(`/api/annotations/${fileId}`),
    save: (data) => this.request('/api/annotations', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    sync: (fileId, data) => this.request(`/api/annotations/${fileId}/sync`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    reset: (fileId) => this.request(`/api/annotations/${fileId}/reset`, {
      method: 'POST'
    })
  };

  user = {
    sync: () => this.request('/api/user/sync', {
      method: 'POST'
    })
  };
}

export const api = new ApiClient();