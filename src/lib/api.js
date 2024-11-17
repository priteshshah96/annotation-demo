const BASE_URL = '/api/vercel';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

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
  }

  async request(endpoint, options = {}, retryCount = 0) {
    try {
      const token = await window.Clerk?.session?.getToken();
      if (!token) {
        throw new ApiError('Authentication required', 401);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

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
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
          return this.request(endpoint, options, retryCount + 1);
        }

        throw error;
      }

      return await response.json();
    } catch (error) {
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
      return this.request('/files');
    },
    get: async (fileId) => {
      return this.request(`/files/${fileId}`);
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
      return this.request('/files/stats');
    }
  };

  // Annotations endpoints
  annotations = {
    get: async (fileId) => {
      return this.request(`/annotations/${fileId}`);
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