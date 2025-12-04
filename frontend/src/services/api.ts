import axios from 'axios';
import { config } from '../config';
import { authService } from './authService';
import { SimilarRisk } from '../types/risk';
import { Supplier, SupplierRiskAssessment, SupplierCriticalityAssessment } from '../types/supplier';

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

  /**
   * Start a review for a supplier
   */
  startReview: async (id: string): Promise<Supplier> => {
    const response = await api.post(`/api/suppliers/${id}/start-review`);
    return response.data;
  },

  /**
   * Get assessment history for a supplier
   */
  getAssessmentHistory: async (id: string): Promise<any[]> => {
    const response = await api.get(`/api/suppliers/${id}/assessment-history`);
    return response.data;
  },

  // Risk Assessment methods
  createRiskAssessment: async (supplierId: string, data: Partial<SupplierRiskAssessment>): Promise<SupplierRiskAssessment> => {
    const response = await api.post(`/api/suppliers/${supplierId}/risk-assessments`, data);
    return response.data;
  },

  updateRiskAssessment: async (supplierId: string, id: string, data: Partial<SupplierRiskAssessment>): Promise<SupplierRiskAssessment> => {
    const response = await api.put(`/api/suppliers/${supplierId}/risk-assessments/${id}`, data);
    return response.data;
  },

  getRiskAssessments: async (supplierId: string): Promise<SupplierRiskAssessment[]> => {
    const response = await api.get(`/api/suppliers/${supplierId}/risk-assessments`);
    return response.data;
  },

  getRiskAssessment: async (supplierId: string, id: string): Promise<SupplierRiskAssessment> => {
    const response = await api.get(`/api/suppliers/${supplierId}/risk-assessments/${id}`);
    return response.data;
  },

  submitRiskAssessment: async (supplierId: string, id: string): Promise<SupplierRiskAssessment> => {
    const response = await api.post(`/api/suppliers/${supplierId}/risk-assessments/${id}/submit`);
    return response.data;
  },

  approveRiskAssessment: async (supplierId: string, id: string): Promise<SupplierRiskAssessment> => {
    const response = await api.post(`/api/suppliers/${supplierId}/risk-assessments/${id}/approve`);
    return response.data;
  },

  rejectRiskAssessment: async (supplierId: string, id: string, rejectionReason: string): Promise<SupplierRiskAssessment> => {
    const response = await api.post(`/api/suppliers/${supplierId}/risk-assessments/${id}/reject`, { rejectionReason });
    return response.data;
  },

  // Criticality Assessment methods
  createCriticalityAssessment: async (supplierId: string, data: Partial<SupplierCriticalityAssessment>): Promise<SupplierCriticalityAssessment> => {
    const response = await api.post(`/api/suppliers/${supplierId}/criticality-assessments`, data);
    return response.data;
  },

  updateCriticalityAssessment: async (supplierId: string, id: string, data: Partial<SupplierCriticalityAssessment>): Promise<SupplierCriticalityAssessment> => {
    const response = await api.put(`/api/suppliers/${supplierId}/criticality-assessments/${id}`, data);
    return response.data;
  },

  getCriticalityAssessments: async (supplierId: string): Promise<SupplierCriticalityAssessment[]> => {
    const response = await api.get(`/api/suppliers/${supplierId}/criticality-assessments`);
    return response.data;
  },

  getCriticalityAssessment: async (supplierId: string, id: string): Promise<SupplierCriticalityAssessment> => {
    const response = await api.get(`/api/suppliers/${supplierId}/criticality-assessments/${id}`);
    return response.data;
  },

  submitCriticalityAssessment: async (supplierId: string, id: string): Promise<SupplierCriticalityAssessment> => {
    const response = await api.post(`/api/suppliers/${supplierId}/criticality-assessments/${id}/submit`);
    return response.data;
  },

  approveCriticalityAssessment: async (supplierId: string, id: string): Promise<SupplierCriticalityAssessment> => {
    const response = await api.post(`/api/suppliers/${supplierId}/criticality-assessments/${id}/approve`);
    return response.data;
  },

  rejectCriticalityAssessment: async (supplierId: string, id: string, rejectionReason: string): Promise<SupplierCriticalityAssessment> => {
    const response = await api.post(`/api/suppliers/${supplierId}/criticality-assessments/${id}/reject`, { rejectionReason });
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
  getComplianceReviews: async (supplierId: string): Promise<any[]> => {
    const response = await api.get(`/api/suppliers/${supplierId}/compliance-reviews`);
    return response.data;
  },

  getComplianceReview: async (supplierId: string, reviewId: string): Promise<any> => {
    const response = await api.get(`/api/suppliers/${supplierId}/compliance-reviews/${reviewId}`);
    return response.data;
  },

  createComplianceReview: async (supplierId: string, data: any): Promise<any> => {
    const response = await api.post(`/api/suppliers/${supplierId}/compliance-reviews`, data);
    return response.data;
  },

  updateComplianceReview: async (supplierId: string, reviewId: string, data: any): Promise<any> => {
    const response = await api.put(`/api/suppliers/${supplierId}/compliance-reviews/${reviewId}`, data);
    return response.data;
  },

  completeComplianceReview: async (supplierId: string, reviewId: string, data: any): Promise<any> => {
    const response = await api.post(`/api/suppliers/${supplierId}/compliance-reviews/${reviewId}/complete`, data);
    return response.data;
  },

  // Certificate methods
  getCertificates: async (supplierId: string): Promise<any[]> => {
    const response = await api.get(`/api/suppliers/${supplierId}/certificates`);
    return response.data;
  },

  addCertificate: async (supplierId: string, data: any): Promise<any> => {
    const response = await api.post(`/api/suppliers/${supplierId}/certificates`, data);
    return response.data;
  },

  updateCertificate: async (supplierId: string, certificateId: string, data: any): Promise<any> => {
    const response = await api.put(`/api/suppliers/${supplierId}/certificates/${certificateId}`, data);
    return response.data;
  },

  deleteCertificate: async (supplierId: string, certificateId: string): Promise<void> => {
    await api.delete(`/api/suppliers/${supplierId}/certificates/${certificateId}`);
  },

  getExpiringCertificates: async (daysBeforeExpiry?: number): Promise<any[]> => {
    const params = daysBeforeExpiry ? { daysBeforeExpiry } : {};
    const response = await api.get('/api/suppliers/certificates/expiring', { params });
    return response.data;
  },

  // Review status
  getReviewStatus: async (supplierId: string): Promise<any> => {
    const response = await api.get(`/api/suppliers/${supplierId}/review-status`);
    return response.data;
  },

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

