const BASE_URL = '/api/vercel';

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
        throw new ApiError(
          data.error || 'Request failed',
          response.status,
          data.details
        );
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

    get: async (id) => {
      return this.request(`/files/${id}`);
    },

    upload: async (data) => {
      return this.request('/files/upload', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    delete: async (id) => {
      return this.request(`/files/${id}`, {
        method: 'DELETE'
      });
    }
  };
}

export const api = new ApiClient();