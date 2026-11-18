import api from './api';

export const deviceService = {
  getMyDevices: async () => {
    const response = await api.get('/devices');
    return response.data;
  },
  revokeMyDevice: async (deviceId) => {
    const response = await api.delete(`/devices/${deviceId}`);
    return response.data;
  },
};
