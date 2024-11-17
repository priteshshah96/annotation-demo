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

      const token = await window.Clerk?.session?.getToken();
      if (!token && !options.skipAuth) {
        throw new ApiError('Authentication required', 401);
      }

      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          error.message || `HTTP error! status: ${response.status}`,
          response.status,
          error.details
        );
      }

      const data = await response.json();

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

      throw error;
    }
  }

  shouldRetry(error) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.status) || error.name === 'AbortError';
  }

  // User endpoints
  user = {
    sync: () => this.request('/user/sync', { method: 'POST' }),
    getProfile: () => this.request('/user/profile', { method: 'GET', cache: true }),
  };

  // Files endpoints
  files = {
    list: () => this.request('/files', { method: 'GET', cache: true }),
    upload: (file, onProgress) => {
      const formData = new FormData();
      formData.append('file', file);

      return this.request('/files/upload', {
        method: 'POST',
        headers: {},
        body: formData,
        onProgress
      });
    },
    getProgress: (fileId) => this.request(`/files/${fileId}/progress`, { 
      method: 'GET',
      cache: true,
      cacheTime: 30000 // 30 seconds
    })
  };

  // Annotations endpoints
  annotations = {
    list: (fileId) => this.request(`/annotations/${fileId}`, { 
      method: 'GET',
      cache: true
    }),
    create: (fileId, data) => this.request(`/annotations/${fileId}`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (fileId, annotationId, data) => this.request(`/annotations/${fileId}/${annotationId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (fileId, annotationId) => this.request(`/annotations/${fileId}/${annotationId}`, {
      method: 'DELETE'
    })
  };
}

export const api = new ApiClient();