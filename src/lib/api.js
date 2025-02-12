// src/lib/api.js
import { useAuth } from '@clerk/clerk-react';

class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function fetchWithAuth(url, options = {}) {
  try {
    const fullUrl = url.startsWith('/') ? url : `/${url}`;

    // Get token using Clerk
    const token = await window.Clerk.session?.getToken();
    
    if (!token) {
      throw new ApiError('Authentication required', 401);
    }

    // Prepare headers
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add request debugging
    console.log('Making API request:', {
      url: fullUrl,
      method: options.method || 'GET',
      headers: { ...headers, Authorization: 'Bearer [REDACTED]' }
    });

    // Make request
    const response = await fetch(fullUrl, {
      ...options,
      headers
    });

    // Add response debugging
    console.log('API Response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url
    });

    // Parse response
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle non-200 responses
    if (!response.ok) {
      console.error('API error response:', {
        status: response.status,
        data
      });
      throw new ApiError(
        data.error || 'API request failed',
        response.status,
        data.details
      );
    }

    return data;
  } catch (error) {
    // Re-throw ApiErrors
    if (error instanceof ApiError) {
      console.error('API Error:', {
        name: error.name,
        message: error.message,
        status: error.status,
        details: error.details
      });
      throw error;
    }

    // Convert other errors to ApiError
    console.error('Network error:', error);
    throw new ApiError(
      'Network error',
      500,
      error.message
    );
  }
}

// API client with organized endpoints
export const api = {
  files: {
    getAll: () => fetchWithAuth('/api/files'),
    get: (id) => fetchWithAuth(`/api/files/${id}`),
    upload: (data) => fetchWithAuth('/api/files/upload', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    delete: (id) => fetchWithAuth(`/api/files/${id}`, {
      method: 'DELETE'
    }),
    // Add this new method
    updateStatus: (fileId, status) => fetchWithAuth(`/api/files/${fileId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(status)
    })
},
  
  annotations: {
    get: (fileId) => fetchWithAuth(`/api/annotations/${fileId}`),
    save: (data) => fetchWithAuth('/api/annotations', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    sync: (fileId, data) => fetchWithAuth(`/api/annotations/${fileId}/sync`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    reset: (fileId) => fetchWithAuth(`/api/annotations/${fileId}/reset`, {
      method: 'POST'
    })
  }
};