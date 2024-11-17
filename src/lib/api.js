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
      if (!token) {
        throw new ApiError('Authentication required', 401);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `HTTP error ${response.status}`,
          response.status,
          errorData.details
        );
      }

      const data = await response.json().catch(() => ({}));
      
      if (cacheKey) {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408);
      }
      
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
        return this.request(endpoint, options, retryCount + 1);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(error.message || 'Unknown error');
    }
  }

  // API endpoints
  user = {
    sync: async () => {
      return this.request('/auth/sync', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  };

  annotations = {
    get: async (fileId) => {
      return this.request(`/annotations/${fileId}`, { cache: true });
    },
    
    save: async (data) => {
      return this.request(`/annotations/${data.fileId}`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    
    sync: async (fileId, data) => {
      return this.request(`/annotations/${fileId}/sync`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    
    reset: async (fileId) => {
      return this.request(`/annotations/${fileId}/reset`, {
        method: 'POST'
      });
    }
  };

  files = {
    getAll: async () => {
      return this.request('/files', { cache: true });
    },
    
    get: async (fileId) => {
      return this.request(`/files/${fileId}`, { cache: true });
    },
    
    delete: async (fileId) => {
      return this.request(`/files/${fileId}`, {
        method: 'DELETE'
      });
    }
  };
}

export const api = new ApiClient();