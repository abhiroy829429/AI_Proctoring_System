// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Make an API request
 * @param {string} endpoint - The API endpoint (e.g., '/session/start')
 * @param {object} options - Fetch options
 * @returns {Promise<object>} - The parsed JSON response
 */
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Set default headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for session management
    });

    // Handle non-2xx responses
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Something went wrong');
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {};
    }

    return await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

// Session API
export const sessionApi = {
  start: (data) => apiRequest('/session/start', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  end: (sessionId) => apiRequest(`/session/${sessionId}/end`, {
    method: 'POST',
  }),
  get: (sessionId) => apiRequest(`/session/${sessionId}`),
};

// Events API
export const eventsApi = {
  log: (data) => apiRequest('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getBySession: (sessionId) => apiRequest(`/events/session/${sessionId}`),
};

// Add more API methods as needed
