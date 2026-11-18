import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('securegate_token');
    const deviceId = localStorage.getItem('securegate_device_id');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (deviceId) config.headers['X-SecureGate-Device'] = deviceId;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token if expired or invalid
      if (localStorage.getItem('securegate_token')) {
        localStorage.removeItem('securegate_token');
        localStorage.removeItem('securegate_user');
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
