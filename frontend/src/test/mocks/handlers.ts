import { http, HttpResponse } from 'msw';
import { config } from '../../config';

const API_URL = config.apiUrl;

// Mock API handlers using MSW
// These can be overridden in individual tests
export const handlers = [
  // Auth endpoints
  http.post(`${API_URL}/api/auth/sync`, () => {
    return HttpResponse.json({
      id: 'user-1',
      email: 'test@paythru.com',
      displayName: 'Test User',
      role: 'ADMIN',
    });
  }),

  http.get(`${API_URL}/api/auth/me`, () => {
    return HttpResponse.json({
      id: 'user-1',
      email: 'test@paythru.com',
      displayName: 'Test User',
      role: 'ADMIN',
    });
  }),

  // Documents endpoints
  http.get(`${API_URL}/api/documents`, () => {
    return HttpResponse.json({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    });
  }),

  http.get(`${API_URL}/api/documents/:id`, () => {
    return HttpResponse.json({
      id: 'doc-1',
      title: 'Test Document',
      type: 'POLICY',
      status: 'APPROVED',
    });
  }),

  http.post(`${API_URL}/api/documents`, () => {
    return HttpResponse.json({
      id: 'doc-1',
      title: 'New Document',
      type: 'POLICY',
      status: 'DRAFT',
    }, { status: 201 });
  }),

  http.put(`${API_URL}/api/documents/:id`, () => {
    return HttpResponse.json({
      id: 'doc-1',
      title: 'Updated Document',
    });
  }),

  http.delete(`${API_URL}/api/documents/:id`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Acknowledgments endpoints
  http.get(`${API_URL}/api/acknowledgments/pending`, () => {
    return HttpResponse.json([]);
  }),

  http.post(`${API_URL}/api/acknowledgments/bulk`, () => {
    return HttpResponse.json({
      acknowledged: 0,
      skipped: 0,
    });
  }),

  // Risks endpoints
  http.get(`${API_URL}/api/risks`, () => {
    return HttpResponse.json({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
    });
  }),

  // Controls endpoints
  http.get(`${API_URL}/api/controls`, () => {
    return HttpResponse.json({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
    });
  }),

  // Dashboard endpoint
  http.get(`${API_URL}/api/dashboard`, () => {
    return HttpResponse.json({
      documentStats: {
        total: 0,
        approved: 0,
        inReview: 0,
        draft: 0,
      },
      reviewStats: {
        overdue: 0,
        dueSoon: 0,
        totalPending: 0,
      },
      acknowledgmentStats: {
        pending: 0,
        totalUsers: 0,
      },
    });
  }),
];


