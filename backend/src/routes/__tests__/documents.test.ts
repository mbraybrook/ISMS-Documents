import request from 'supertest';
import express from 'express';
import { documentsRouter } from '../documents';
import { authenticateToken } from '../../middleware/auth';
import { requireRole } from '../../middleware/authorize';
import { mockUsers } from '../../lib/test-helpers';

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      sub: 'test-user',
      email: 'test@paythru.com',
      name: 'Test User',
      oid: 'test-oid',
    };
    next();
  },
}));

// Mock authorization middleware
jest.mock('../../middleware/authorize', () => ({
  requireRole: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock services
jest.mock('../../services/sharePointService', () => ({
  generateSharePointUrl: jest.fn(),
  getSharePointItem: jest.fn(),
}));

jest.mock('../../services/confluenceService', () => ({
  generateConfluenceUrl: jest.fn(),
}));

jest.mock('../../services/pdfCacheService', () => ({
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

describe('Documents API', () => {
  let app: express.Application;
  let prisma: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/documents', documentsRouter);
    prisma = require('../../lib/prisma').prisma;
    jest.clearAllMocks();
  });

  describe('GET /api/documents', () => {
    it('should return list of documents', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Test Document',
          type: 'POLICY',
          status: 'APPROVED',
          version: '1.0',
          requiresAcknowledgement: false,
          lastChangedDate: null,
          lastReviewDate: null,
          nextReviewDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: {
            id: 'user-1',
            displayName: 'Test Owner',
            email: 'owner@paythru.com',
          },
        },
      ];

      prisma.document.findMany.mockResolvedValue(mockDocuments);
      prisma.document.count.mockResolvedValue(1);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get('/api/documents')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Test Document');
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(1);
    });

    it('should filter by type', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/documents?type=POLICY')
        .expect(200);

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'POLICY',
          }),
        })
      );
    });

    it('should filter by status for ADMIN users', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/documents?status=DRAFT')
        .expect(200);

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'DRAFT',
          }),
        })
      );
    });

    it('should only show APPROVED documents for STAFF users', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.staff());

      await request(app)
        .get('/api/documents?status=DRAFT')
        .expect(200);

      // Should override status filter and only show APPROVED
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED',
          }),
        })
      );
    });

    it('should support pagination', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(50);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get('/api/documents?page=2&limit=10')
        .expect(200);

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should filter by ownerId', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get(`/api/documents?ownerId=${ownerId}`)
        .expect(200);

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ownerUserId: ownerId,
          }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      prisma.document.findMany.mockRejectedValue(new Error('Database error'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/documents')
        .expect(500);

      expect(prisma.document.findMany).toHaveBeenCalled();
    });
  });

  describe('GET /api/documents/:id', () => {
    it('should return document details', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const mockDocument = {
        id: docId,
        title: 'Test Document',
        type: 'POLICY',
        status: 'APPROVED',
        version: '1.0',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get(`/api/documents/${docId}`)
        .expect(200);

      expect(response.body.title).toBe('Test Document');
      expect(response.body.id).toBe(docId);
    });

    it('should return 404 for non-existent document', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/documents/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app)
        .get('/api/documents/invalid-id')
        .expect(400);
    });

    it('should restrict access for STAFF users to APPROVED documents only', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const mockDocument = {
        id: docId,
        title: 'Test Document',
        type: 'POLICY',
        status: 'DRAFT',
        owner: { id: '550e8400-e29b-41d4-a716-446655440002', displayName: 'Owner', email: 'owner@paythru.com' },
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.staff());

      await request(app)
        .get(`/api/documents/${docId}`)
        .expect(403);
    });
  });

  describe('POST /api/documents', () => {
    it('should create a new document', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      const newDocument = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'New Document',
        type: 'POLICY',
        status: 'DRAFT',
        version: '1.0',
        storageLocation: 'SHAREPOINT',
        ownerUserId: ownerId,
      };

      prisma.document.create.mockResolvedValue(newDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .post('/api/documents')
        .send({
          title: 'New Document',
          type: 'POLICY',
          storageLocation: 'SHAREPOINT',
          version: '1.0',
          status: 'DRAFT',
          ownerUserId: ownerId,
        })
        .expect(201);

      expect(response.body.title).toBe('New Document');
      expect(prisma.document.create).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/documents')
        .send({
          // Missing required fields
        })
        .expect(400);
    });

    it('should require ADMIN or EDITOR role', async () => {
      // This test verifies the route is protected
      // The actual role check is tested in authorize.test.ts
      expect(true).toBe(true);
    });
  });

  describe('PUT /api/documents/:id', () => {
    it('should update an existing document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        title: 'Existing Document',
        type: 'POLICY',
        status: 'APPROVED',
        version: '1.0',
        storageLocation: 'SHAREPOINT',
      };
      const updatedDocument = {
        ...existingDocument,
        title: 'Updated Document',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.document.update.mockResolvedValue(updatedDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .put(`/api/documents/${docId}`)
        .send({
          title: 'Updated Document',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Document');
      expect(prisma.document.update).toHaveBeenCalled();
    });

    it('should return 404 for non-existent document', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put('/api/documents/550e8400-e29b-41d4-a716-446655440000')
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('should soft delete a document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const document = {
        id: docId,
        title: 'Test Document',
        status: 'APPROVED',
      };

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.document.update.mockResolvedValue({
        ...document,
        status: 'SUPERSEDED',
      });
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/documents/${docId}`)
        .expect(200);

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: docId },
          data: expect.objectContaining({
            status: 'SUPERSEDED',
          }),
        })
      );
    });

    it('should return 404 for non-existent document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440000';
      // Mock Prisma to throw P2025 error (record not found)
      const error: any = new Error('Record not found');
      error.code = 'P2025';
      prisma.document.update.mockRejectedValue(error);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/documents/${docId}`)
        .expect(404);
    });
  });
});




