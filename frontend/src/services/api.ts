import axios from 'axios';
import { config } from '../config';
import { authService } from './authService';
import { SimilarRisk } from '../types/risk';
import { Supplier } from '../types/supplier';

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

// Supplier API functions
export const supplierApi = {
  /**
   * Get all suppliers with optional filters
   */
  getSuppliers: async (filters?: {
    supplierType?: string;
    criticality?: string;
    pciStatus?: string;
    iso27001Status?: string;
    status?: string;
    performanceRating?: string;
    search?: string;
  }): Promise<Supplier[]> => {
    const params = filters || {};
    const response = await api.get('/api/suppliers', { params });
    return response.data;
  },

  /**
   * Get a single supplier by ID
   */
  getSupplier: async (id: string): Promise<Supplier> => {
    const response = await api.get(`/api/suppliers/${id}`);
    return response.data;
  },

  /**
   * Create a new supplier
   */
  createSupplier: async (data: Partial<Supplier>): Promise<Supplier> => {
    const response = await api.post('/api/suppliers', data);
    return response.data;
  },

  /**
   * Update an existing supplier
   */
  updateSupplier: async (id: string, data: Partial<Supplier>): Promise<Supplier> => {
    const response = await api.put(`/api/suppliers/${id}`, data);
    return response.data;
  },

  /**
   * Archive a supplier (set status to INACTIVE)
   */
  archiveSupplier: async (id: string): Promise<Supplier> => {
    const response = await api.patch(`/api/suppliers/${id}/archive`);
    return response.data;
  },

  // Link methods
  getSupplierRisks: async (supplierId: string): Promise<any[]> => {
    const response = await api.get(`/api/suppliers/${supplierId}/risks`);
    return response.data;
  },

  linkSupplierRisk: async (supplierId: string, riskId: string): Promise<any> => {
    const response = await api.post(`/api/suppliers/${supplierId}/risks`, { riskId });
    return response.data;
  },

  unlinkSupplierRisk: async (supplierId: string, riskId: string): Promise<void> => {
    await api.delete(`/api/suppliers/${supplierId}/risks/${riskId}`);
  },

  suggestRisksForSupplier: async (supplierId: string, limit?: number): Promise<{
    suggestions: Array<{
      risk: any;
      similarityScore: number;
      matchedFields: string[];
    }>;
  }> => {
    const params = limit ? { limit } : {};
    const response = await api.post(`/api/suppliers/${supplierId}/suggest-risks`, {}, { params });
    return response.data;
  },

  getSupplierControls: async (supplierId: string): Promise<any[]> => {
    const response = await api.get(`/api/suppliers/${supplierId}/controls`);
    return response.data;
  },

  linkSupplierControl: async (supplierId: string, controlId: string): Promise<any> => {
    const response = await api.post(`/api/suppliers/${supplierId}/controls`, { controlId });
    return response.data;
  },

  unlinkSupplierControl: async (supplierId: string, controlId: string): Promise<void> => {
    await api.delete(`/api/suppliers/${supplierId}/controls/${controlId}`);
  },

  // Compliance review methods
  // Review status

  // Exit plan methods
  getExitPlan: async (supplierId: string): Promise<any> => {
    const response = await api.get(`/api/suppliers/${supplierId}/exit-plan`);
    return response.data;
  },

  createExitPlan: async (supplierId: string, data: any): Promise<any> => {
    const response = await api.post(`/api/suppliers/${supplierId}/exit-plan`, data);
    return response.data;
  },

  updateExitPlan: async (supplierId: string, data: any): Promise<any> => {
    const response = await api.put(`/api/suppliers/${supplierId}/exit-plan`, data);
    return response.data;
  },

  deleteExitPlan: async (supplierId: string): Promise<void> => {
    await api.delete(`/api/suppliers/${supplierId}/exit-plan`);
  },
};

// SharePoint API functions
export const sharePointApi = {
  /**
   * Get all SharePoint sites the user has access to
   */
  getSites: async (): Promise<Array<{ id: string; displayName: string; name: string; webUrl: string }>> => {
    const graphToken = await authService.getGraphAccessToken();
    if (!graphToken) {
      throw new Error('Unable to get Graph access token');
    }
    const response = await api.get('/api/sharepoint/sites', {
      headers: {
        'x-graph-token': graphToken,
      },
    });
    return response.data.sites || [];
  },
};

export default api;

