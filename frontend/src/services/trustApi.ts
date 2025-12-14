import axios, { AxiosError } from 'axios';
import { config } from '../config';
import apiInternal from './api'; // Main API client for internal user auth (Entra ID)
import type {
  ExternalUser,
  TrustCategoryGroup,
  TrustDocSetting,
  TrustAuditLog,
  TrustDocument,
  UserDetails,
} from '../types/trust';

const API_URL = `${config.apiUrl}/api/trust`;

// Get JWT token from localStorage
const getToken = (): string | null => {
  return localStorage.getItem('trust_token');
};

// Set JWT token in localStorage
const setToken = (token: string): void => {
  localStorage.setItem('trust_token', token);
  // Also store expiry if provided
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp) {
      localStorage.setItem('trust_token_exp', payload.exp.toString());
    }
  } catch (e) {
    // Ignore parsing errors
  }
};

// Clear token from localStorage
const clearToken = (): void => {
  localStorage.removeItem('trust_token');
  localStorage.removeItem('trust_token_exp');
};

// Check if token is expired
const isTokenExpired = (): boolean => {
  const exp = localStorage.getItem('trust_token_exp');
  if (!exp) return true;
  const expiryTime = parseInt(exp, 10) * 1000;
  return Date.now() >= expiryTime;
};

// Create axios instance with auth interceptor
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token && !isTokenExpired()) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const trustApi = {
  // Authentication
  async register(email: string, password: string, companyName: string): Promise<ExternalUser> {
    const response = await axios.post(`${API_URL}/register`, {
      email,
      password,
      companyName,
    });
    return response.data;
  },

  async login(email: string, password: string): Promise<{ token: string; user: ExternalUser }> {
    const response = await axios.post(`${API_URL}/login`, {
      email,
      password,
    });
    if (response.data.token) {
      setToken(response.data.token);
    }
    return response.data;
  },

  logout(): void {
    clearToken();
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await axios.post(`${API_URL}/forgot-password`, { email });
    return response.data;
  },

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const response = await axios.post(`${API_URL}/reset-password`, {
      token,
      newPassword,
    });
    return response.data;
  },

  async getMe(): Promise<ExternalUser> {
    const response = await api.get('/me');
    return response.data;
  },

  // Documents - returns both public and private (if authenticated)
  async getDocuments(): Promise<TrustCategoryGroup[]> {
    // Use the trust API endpoint which handles conditional auth
    const url = `${API_URL}/documents`;
    const response = await axios.get(url, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    });
    return response.data;
  },

  // Legacy methods for backwards compatibility
  async getPublicDocuments(): Promise<TrustCategoryGroup[]> {
    const response = await axios.get(`${API_URL}/documents`);
    return response.data;
  },

  async getPrivateDocuments(): Promise<TrustCategoryGroup[]> {
    const response = await api.get('/documents/private');
    return response.data;
  },

  async downloadDocument(docId: string, token?: string): Promise<{ blob: Blob; filename: string }> {
    try {
      const url = token
        ? `${API_URL}/download/${docId}?token=${token}`
        : `${API_URL}/download/${docId}`;

      
      const response = await axios.get(url, {
        responseType: 'blob',
        headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
        timeout: 60000, // 60 second timeout for large files
      });

      
      // Extract filename from Content-Disposition header
      let filename = 'document';
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        // Try RFC 5987 encoded filename first (filename*=UTF-8''...)
        const encodedMatch = contentDisposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/);
        if (encodedMatch) {
          filename = decodeURIComponent(encodedMatch[1]);
        } else {
          // Fall back to regular filename
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, '');
          }
        }
      }

      // Get content type from response headers
      // All documents are now converted to PDF, so default to PDF
      const contentType = response.headers['content-type'] || 'application/pdf';

      // Axios with responseType: 'blob' should return a Blob
      // However, we need to ensure it's properly created with the correct MIME type
      let blob: Blob;
      
      if (response.data instanceof Blob) {
        // Already a Blob - but we should ensure it has the correct type
        // If the type is generic, update it from headers
        if (response.data.type === '' || response.data.type === 'application/octet-stream') {
          blob = new Blob([response.data], { type: contentType });
        } else {
          blob = response.data;
        }
      } else {
        // Convert to Blob with proper MIME type from headers
        if (response.data instanceof ArrayBuffer) {
          blob = new Blob([response.data], { type: contentType });
        } else {
          // For other types, create blob with correct type
          blob = new Blob([response.data], { type: contentType });
        }
      }

      // Validate blob size
      if (blob.size === 0) {
        throw new Error('Received empty file from server');
      }

      
      return { blob, filename };
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      console.error('[TRUST-API] Download error:', axiosError);
      console.error('[TRUST-API] Error details:', {
        message: axiosError.message,
        response: axiosError.response ? {
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          data: axiosError.response.data,
          headers: axiosError.response.headers,
        } : null,
      });
      
      // If it's an error response with JSON data, try to extract the error message
      if (axiosError.response?.data) {
        // If the response is a blob (error response), try to read it as text
        if (axiosError.response.data instanceof Blob) {
          try {
            const errorText = await axiosError.response.data.text();
            const errorJson = JSON.parse(errorText);
            throw new Error(errorJson.error || errorJson.message || 'Download failed');
          } catch (parseError) {
            // If parsing fails, use the original error
            throw new Error(axiosError.response?.statusText || 'Download failed');
          }
        } else if (typeof axiosError.response.data === 'object' && axiosError.response.data && 'error' in axiosError.response.data) {
          const errorData = axiosError.response.data as { error: string };
          throw new Error(errorData.error);
        }
      }
      
      throw error;
    }
  },

  async acceptTerms(documentId?: string): Promise<{ message: string }> {
    const response = await api.post('/accept-terms', { documentId });
    return response.data;
  },

  // Admin functions - use internal API client (Entra ID auth)
  async getPendingRequests(): Promise<ExternalUser[]> {
    const response = await apiInternal.get('/api/trust/admin/pending-requests');
    return response.data;
  },

  async approveUser(userId: string): Promise<ExternalUser> {
    const response = await apiInternal.post(`/api/trust/admin/approve-user/${userId}`);
    return response.data;
  },

  async denyUser(userId: string, reason?: string): Promise<{ message: string }> {
    const response = await apiInternal.post(`/api/trust/admin/deny-user/${userId}`, { reason });
    return response.data;
  },

  async getAllUsers(filters?: {
    status?: 'pending' | 'approved' | 'all';
    active?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ExternalUser[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await apiInternal.get(`/api/trust/admin/users?${params.toString()}`);
    return response.data;
  },

  async getUserDetails(userId: string): Promise<UserDetails> {
    const response = await apiInternal.get(`/api/trust/admin/users/${userId}`);
    return response.data;
  },

  async revokeUserAccess(userId: string): Promise<ExternalUser> {
    const response = await apiInternal.put(`/api/trust/admin/users/${userId}/revoke`);
    return response.data;
  },

  async restoreUserAccess(userId: string): Promise<ExternalUser> {
    const response = await apiInternal.put(`/api/trust/admin/users/${userId}/restore`);
    return response.data;
  },

  async getDocumentSettings(): Promise<
    Array<{ document: TrustDocument; trustSetting: TrustDocSetting | null }>
  > {
    const response = await apiInternal.get('/api/trust/admin/documents');
    return response.data;
  },

  async updateDocumentSettings(
    docId: string,
    settings: Partial<TrustDocSetting>
  ): Promise<TrustDocSetting> {
    const response = await apiInternal.put(`/api/trust/admin/documents/${docId}/settings`, settings);
    return response.data;
  },

  async deleteDocumentSettings(docId: string): Promise<{ message: string }> {
    const response = await apiInternal.delete(`/api/trust/admin/documents/${docId}/settings`);
    return response.data;
  },

  async getAuditLog(filters?: {
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<TrustAuditLog[]> {
    const params = new URLSearchParams();
    if (filters?.action) params.append('action', filters.action);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await apiInternal.get(`/api/trust/admin/audit-log?${params.toString()}`);
    return response.data;
  },

  async getSettings(): Promise<{ watermarkPrefix: string }> {
    const response = await apiInternal.get('/api/trust/admin/settings');
    return response.data;
  },

  async updateSettings(settings: { watermarkPrefix: string }): Promise<{ watermarkPrefix: string }> {
    const response = await apiInternal.put('/api/trust/admin/settings', settings);
    return response.data;
  },

  // Suppliers - public endpoint (no auth required)
  async getSuppliers(): Promise<Array<{
    id: string;
    displayName: string;
    description: string;
    category: string;
    complianceSummary: string | null;
  }>> {
    const response = await axios.get(`${API_URL}/suppliers`);
    return response.data.suppliers;
  },

  // Token helpers
  getToken,
  isTokenExpired,
};

