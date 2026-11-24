// ABAC policy requests use the shared API client so JWT and device headers are attached.
import api from './api';

export const abacPolicyService = {
  list: async () => (await api.get('/abac-policies')).data,
  create: async (payload) => (await api.post('/abac-policies', payload)).data,
  update: async (id, payload) => (await api.put('/abac-policies/' + id, payload)).data,
  remove: async (id) => (await api.delete('/abac-policies/' + id)).data,
  simulate: async (payload) => (await api.post('/abac-policies/simulate', payload)).data,
};
