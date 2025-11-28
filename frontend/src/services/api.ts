import axios from 'axios';
import { config } from '../config';
import { authService } from './authService';

const api = axios.create({
  baseURL: config.apiUrl,
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await authService.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

