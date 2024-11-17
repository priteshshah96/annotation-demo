const BASE_URL = import.meta.env.VITE_API_URL || '/api/vercel/v1';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT = 10000; // 10 seconds

class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

class ApiClient {
  constructor() {
    this.baseUrl = BASE_URL;
    this.cache = new Map();
  }

  async request(endpoint, options = {}, retryCount = 0) {
    const cacheKey = options.cache ? `${endpoint}-${JSON.stringify(options)}` : null;
    
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || REQUEST_TIMEOUT);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.error || `HTTP error! status: ${response.status}`,
          response.status,
          data.details
        );
      }

      if (cacheKey) {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Request timed out', 408);
      }

      if (retryCount < MAX_RETRIES && this.shouldRetry(error)) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
        return this.request(endpoint, options, retryCount + 1);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(error.message || 'Request failed', 500);
    }
  }

  shouldRetry(error) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.status) || error.name === 'AbortError';
  }

  // User endpoints
  user = {
    sync: async (token) => {
      const response = await this.request('/user/sync', { 
        method: 'POST',
        cache: false,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response?.user) {
        throw new ApiError('Invalid user data received from server');
      }
      
      return response;
    },
    
    getProfile: async (token) => {
      const response = await this.request('/user/profile', { 
        method: 'GET',
        cache: true,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response?.user) {
        throw new ApiError('Invalid profile data received from server');
      }
      
      return response;
    }
  };

  // Files endpoints
  files = {
    list: (token) => this.request('/files', { 
      method: 'GET',
      cache: true,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }),
    
    upload: (token, file, onProgress) => {
      const formData = new FormData();
      formData.append('file', file);

      return this.request('/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        onProgress
      });
    },
    
    getProgress: (token, fileId) => this.request(`/files/${fileId}/progress`, { 
      method: 'GET',
      cache: true,
      cacheTime: 30000, // 30 seconds
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
  };

  // Annotations endpoints
  annotations = {
    list: (token, fileId) => this.request(`/annotations/${fileId}`, { 
      method: 'GET',
      cache: true,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }),
    
    create: (token, fileId, data) => this.request(`/annotations/${fileId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    }),
    
    update: (token, fileId, annotationId, data) => this.request(`/annotations/${fileId}/${annotationId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    }),
    
    delete: (token, fileId, annotationId) => this.request(`/annotations/${fileId}/${annotationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
  };
}

export const api = new ApiClient();