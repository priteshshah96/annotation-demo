// src/lib/api.js
const BASE_URL = import.meta.env.VITE_API_URL || '/api/vercel/v1';
const REQUEST_TIMEOUT = 10000;

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

  async request(endpoint, options = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

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

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Request timed out', 408);
      }
      throw error;
    }
  }

  // User endpoints
  user = {
    sync: async (token) => {
      return this.request('/user/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    },

    verify: async (token) => {
      return this.request('/auth/verify', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
  };

  // Files endpoints
  files = {
    list: async (token) => {
      return this.request('/files', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    },

    get: async (token, fileId) => {
      return this.request(`/files/${fileId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    },

    upload: async (token, file) => {
      const formData = new FormData();
      formData.append('file', file);

      return this.request('/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
    },

    delete: async (token, fileId) => {
      return this.request(`/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
  };
}

export const api = new ApiClient();