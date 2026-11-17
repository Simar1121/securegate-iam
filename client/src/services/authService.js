import api from './api';

export const authService = {
  login: async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },

  register: async (userData) => {
    const res = await api.post('/auth/register', userData);
    return res.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    }
    localStorage.removeItem('securegate_token');
    localStorage.removeItem('securegate_user');
  },

  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },

  changePassword: async (passwords) => {
    const res = await api.put('/auth/change-password', passwords);
    return res.data;
  },

  updateProfile: async (profileData) => {
    const res = await api.put('/auth/update-profile', profileData);
    return res.data;
  },
};
