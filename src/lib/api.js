const BASE_URL = import.meta.env.VITE_API_URL || '/api/vercel';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
      const token = await window.Clerk?.session?.getToken();
      if (!token) {
        throw new ApiError('Authentication required', 401);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new ApiError(
          data.error || 'Request failed',
          response.status,
          data.details
        );
        
        // Retry on 5xx errors and 429 (rate limit)
        if ((response.status >= 500 || response.status === 429) && retryCount < MAX_RETRIES) {
          console.log(`Retrying request (${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
          return this.request(endpoint, options, retryCount + 1);
        }

        throw error;
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
        throw new ApiError('Request timeout', 408);
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError(error.message);
    }
  }

  // User endpoints
  user = {
    sync: async () => {
      return this.request('/user/sync', { method: 'POST' });
    }
  };

  // Files endpoints
  files = {
    getAll: async () => {
      return this.request('/files', { cache: true });
    },
    get: async (fileId) => {
      return this.request(`/files/${fileId}`, { cache: true });
    },
    upload: async (data) => {
      return this.request('/files/upload', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    delete: async (fileId) => {
      return this.request(`/files/${fileId}`, {
        method: 'DELETE'
      });
    },
    getUserStats: async () => {
      return this.request('/files/stats', { cache: true });
    }
  };

  // Annotations endpoints
  annotations = {
    get: async (fileId) => {
      return this.request(`/annotations/${fileId}`, { cache: true });
    },
    save: async (data) => {
      return this.request('/annotations', {
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
}

export const api = new ApiClient();