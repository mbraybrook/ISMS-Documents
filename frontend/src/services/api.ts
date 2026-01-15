
import axios from 'axios';
import { config } from '../config';
import { authService } from './authService';
import { SimilarRisk, Risk } from '../types/risk';
import { Supplier, SupplierExitPlan } from '../types/supplier';
import { Control } from '../types/control';
import { RiskDashboardFilters, RiskDashboardSummary } from '../types/riskDashboard';

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
  getSupplierRisks: async (supplierId: string): Promise<Risk[]> => {
    const response = await api.get(`/api/suppliers/${supplierId}/risks`);
    return response.data;
  },

  linkSupplierRisk: async (supplierId: string, riskId: string): Promise<{ supplierId: string; riskId: string }> => {
    const response = await api.post(`/api/suppliers/${supplierId}/risks`, { riskId });
    return response.data;
  },

  unlinkSupplierRisk: async (supplierId: string, riskId: string): Promise<void> => {
    await api.delete(`/api/suppliers/${supplierId}/risks/${riskId}`);
  },

  suggestRisksForSupplier: async (supplierId: string, limit?: number): Promise<{
    suggestions: Array<{
      risk: Risk;
      similarityScore: number;
      matchedFields: string[];
    }>;
  }> => {
    const params = limit ? { limit } : {};
    const response = await api.post(`/api/suppliers/${supplierId}/suggest-risks`, {}, { params });
    return response.data;
  },

  getSupplierControls: async (supplierId: string): Promise<Control[]> => {
    const response = await api.get(`/api/suppliers/${supplierId}/controls`);
    return response.data;
  },

  linkSupplierControl: async (supplierId: string, controlId: string): Promise<{ supplierId: string; controlId: string }> => {
    const response = await api.post(`/api/suppliers/${supplierId}/controls`, { controlId });
    return response.data;
  },

  unlinkSupplierControl: async (supplierId: string, controlId: string): Promise<void> => {
    await api.delete(`/api/suppliers/${supplierId}/controls/${controlId}`);
  },

  // Compliance review methods
  // Review status

  // Exit plan methods
  getExitPlan: async (supplierId: string): Promise<SupplierExitPlan | null> => {
    const response = await api.get(`/api/suppliers/${supplierId}/exit-plan`);
    return response.data;
  },

  createExitPlan: async (supplierId: string, data: Partial<SupplierExitPlan>): Promise<SupplierExitPlan> => {
    const response = await api.post(`/api/suppliers/${supplierId}/exit-plan`, data);
    return response.data;
  },

  updateExitPlan: async (supplierId: string, data: Partial<SupplierExitPlan>): Promise<SupplierExitPlan> => {
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

// Risk Dashboard API functions
export const riskDashboardApi = {
  /**
   * Get risk dashboard summary with quarterly aggregation
   */
  getSummary: async (filters?: RiskDashboardFilters): Promise<RiskDashboardSummary> => {
    const response = await api.get('/api/dashboard/risk-dashboard/summary', {
      params: filters,
    });
    return response.data;
  },
};

// Acknowledgment API functions
export interface AcknowledgmentStats {
  dataAsOf: string | null;
  documents: Array<{
    documentId: string;
    documentTitle: string;
    documentVersion: string;
    requiresAcknowledgement: boolean;
    lastChangedDate: string | null;
    totalUsers: number;
    acknowledgedCount: number;
    notAcknowledgedCount: number;
    percentage: number;
    acknowledgedUsers: Array<{
      userId?: string | null;
      entraObjectId: string;
      email: string;
      displayName: string;
      acknowledgedAt: string;
      daysSinceRequired: number;
    }>;
    notAcknowledgedUsers: Array<{
      userId?: string | null;
      entraObjectId: string;
      email: string;
      displayName: string;
      daysSinceRequired: number;
    }>;
  }>;
  summary: {
    totalDocuments: number;
    totalUsers: number;
    averageAcknowledgmentRate: number;
  };
}

export interface DocumentAcknowledgmentDetails {
  dataAsOf: string | null;
  document: {
    documentId: string;
    documentTitle: string;
    documentVersion: string;
    requiresAcknowledgement: boolean;
    lastChangedDate: string | null;
    totalUsers: number;
    acknowledgedCount: number;
    notAcknowledgedCount: number;
    percentage: number;
  };
  acknowledgedUsers: Array<{
    userId?: string | null;
    entraObjectId: string;
    email: string;
    displayName: string;
    acknowledgedAt: string;
    daysSinceRequired: number;
  }>;
  notAcknowledgedUsers: Array<{
    userId?: string | null;
    entraObjectId: string;
    email: string;
    displayName: string;
    daysSinceRequired: number;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface EntraIdConfig {
  groupId: string | null;
  groupName: string | null;
  lastSyncedAt: string | null;
}

export const acknowledgmentApi = {
  /**
   * Get acknowledgment statistics for all documents or a specific document
   */
  getAcknowledgmentStats: async (
    documentId?: string,
    includeUsers: boolean = true
  ): Promise<AcknowledgmentStats> => {
    const params: { documentId?: string; includeUsers?: string } = {};
    if (documentId) {
      params.documentId = documentId;
    }
    if (!includeUsers) {
      params.includeUsers = 'false';
    }
    const response = await api.get('/api/acknowledgments/stats', { params });
    return response.data;
  },

  /**
   * Get detailed acknowledgment status for a specific document with pagination
   */
  getDocumentAcknowledgmentDetails: async (
    documentId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<DocumentAcknowledgmentDetails> => {
    const response = await api.get(`/api/acknowledgments/document/${documentId}`, {
      params: { page, pageSize },
    });
    return response.data;
  },

  /**
   * Get configured all-staff Entra ID group
   */
  getEntraIdConfig: async (): Promise<EntraIdConfig> => {
    const response = await api.get('/api/acknowledgments/entra-config');
    return response.data;
  },

  /**
   * Set all-staff Entra ID group (requires Graph token)
   */
  setEntraIdConfig: async (groupId: string): Promise<EntraIdConfig> => {
    const graphToken = await authService.getGraphAccessToken([
      'GroupMember.Read.All',
      'Group.Read.All',
    ]);
    if (!graphToken) {
      throw new Error('Unable to get Graph access token');
    }
    const response = await api.post(
      '/api/acknowledgments/entra-config',
      { groupId },
      {
        headers: {
          'x-graph-token': graphToken,
        },
      }
    );
    return response.data;
  },

  /**
   * Sync Entra ID users to cache
   * Uses app-only token (application permissions) - no user consent required
   * Backend automatically uses app-only token from Azure app credentials
   */
  syncEntraIdUsers: async (): Promise<{ synced: number; lastSyncedAt: string | null }> => {
    // No token needed - backend uses app-only token automatically
    // This avoids requiring user consent for delegated permissions
    const response = await api.post('/api/acknowledgments/entra-sync');
    return response.data;
  },
};

export default api;

