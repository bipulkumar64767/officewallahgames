const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api/v1';
const AUTH_API_BASE_URL = import.meta.env.VITE_AUTH_API_BASE_URL || 'http://localhost:8082/api/v1/auth';

const api = {
  get: async (endpoint) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  },
  post: async (endpoint, data) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  },
};

export const getGamesCatalog = async () => {
  const response = await api.get('/games/catalog');
  if (response && response.data) {
    return response.data;
  }
  return response;
};

export const authApi = {
  createGuestSession: async () => {
    const response = await fetch(`${AUTH_API_BASE_URL}/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Auth API error: ${response.status}`);
    const result = await response.json();
    if (result && result.data) {
      return result.data;
    }
    return result;
  },

  login: async (username, password) => {
    const response = await fetch(`${AUTH_API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw new Error(`Auth API error: ${response.status}`);
    const result = await response.json();
    if (result && result.data) {
      return result.data;
    }
    return result;
  },

  getMe: async (token) => {
    const response = await fetch(`${AUTH_API_BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error(`Auth API error: ${response.status}`);
    const result = await response.json();
    return result && result.data ? result.data : result;
  },
};

export default api;
