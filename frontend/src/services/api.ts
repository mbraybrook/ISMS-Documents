import axios from 'axios';
import { config } from '../config';
import { authService } from './authService';
import { SimilarRisk } from '../types/risk';

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

// Similarity API functions
export const similarityApi = {
  /**
   * Find similar risks for an existing risk
   */
  findSimilarRisks: async (riskId: string, limit?: number): Promise<{ similarRisks: SimilarRisk[] }> => {
    const params = limit ? { limit } : {};
    const response = await api.post(`/api/risks/${riskId}/similar`, {}, { params });
    return response.data;
  },

  /**
   * Check similarity for a new risk being created/edited
   */
  checkSimilarity: async (data: {
    title: string;
    threatDescription?: string;
    description?: string;
    excludeId?: string;
  }): Promise<{ similarRisks: SimilarRisk[] }> => {
    const response = await api.post('/api/risks/check-similarity', data);
    return response.data;
  },
};

export default api;

