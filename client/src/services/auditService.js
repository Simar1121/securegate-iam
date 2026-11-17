import api from './api';

export const auditService = {
  getLogs: async (params = {}) => {
    const res = await api.get('/audit-logs', { params });
    return res.data;
  },

  getStats: async () => {
    const res = await api.get('/audit-logs/stats');
    return res.data;
  },
};
