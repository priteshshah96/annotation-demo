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

export const api = {
  // User endpoints
  user: {
    sync: async (token) => {
      const response = await fetch(`${BASE_URL}/user/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new ApiError('Failed to sync user', response.status);
      }

      return response.json();
    },

    verify: async (token) => {
      const response = await fetch(`${BASE_URL}/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new ApiError('Failed to verify user', response.status);
      }

      return response.json();
    }
  },

  // Files endpoints
  files: {
    list: async (token) => {
      const response = await fetch(`${BASE_URL}/files`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new ApiError('Failed to list files', response.status);
      }

      return response.json();
    }
  }
};