import api from './api';

export const roleService = {
  getRoles: async () => {
    const res = await api.get('/roles');
    return res.data;
  },

  getRoleById: async (id) => {
    const res = await api.get(`/roles/${id}`);
    return res.data;
  },

  createRole: async (roleData) => {
    const res = await api.post('/roles', roleData);
    return res.data;
  },

  updateRole: async (id, roleData) => {
    const res = await api.put(`/roles/${id}`, roleData);
    return res.data;
  },

  deleteRole: async (id) => {
    const res = await api.delete(`/roles/${id}`);
    return res.data;
  },
};
