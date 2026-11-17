import api from './api';

export const permissionService = {
  getPermissions: async () => {
    const res = await api.get('/permissions');
    return res.data;
  },

  getPermissionMatrix: async () => {
    const res = await api.get('/permissions/matrix');
    return res.data;
  },

  createPermission: async (data) => {
    const res = await api.post('/permissions', data);
    return res.data;
  },
};
