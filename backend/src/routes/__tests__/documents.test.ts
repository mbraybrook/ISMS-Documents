/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import { documentsRouter } from '../documents';
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
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    documentVersionHistory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    documentControl: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    control: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    documentRisk: {
      findMany: jest.fn(),
    },
    risk: {
      findUnique: jest.fn(),
    },
    reviewTask: {
      deleteMany: jest.fn(),
    },
    acknowledgment: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
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

jest.mock('../../services/llmService', () => ({
  generateEmbedding: jest.fn(),
  cosineSimilarity: jest.fn(),
  mapToScore: jest.fn(),
}));

jest.mock('../../config', () => ({
  config: {
    sharePoint: {
      siteId: 'default-site-id',
      driveId: 'default-drive-id',
    },
    confluence: {
      baseUrl: 'https://test.atlassian.net',
    },
  },
}));

describe('Documents API', () => {
  let app: express.Application;
  let prisma: any;
  let generateSharePointUrl: jest.Mock;
  let generateConfluenceUrl: jest.Mock;
  let getSharePointItem: jest.Mock;
  let generateEmbedding: jest.Mock;
  let cosineSimilarity: jest.Mock;
  let mapToScore: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/documents', documentsRouter);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    prisma = require('../../lib/prisma').prisma;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharePointService = require('../../services/sharePointService');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const confluenceService = require('../../services/confluenceService');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const llmService = require('../../services/llmService');
    
    generateSharePointUrl = sharePointService.generateSharePointUrl;
    generateConfluenceUrl = confluenceService.generateConfluenceUrl;
    getSharePointItem = sharePointService.getSharePointItem;
    generateEmbedding = llmService.generateEmbedding;
    cosineSimilarity = llmService.cosineSimilarity;
    mapToScore = llmService.mapToScore;
    
    jest.clearAllMocks();
    
    // Suppress console methods during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
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

    it('should filter by nextReviewFrom and nextReviewTo', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/documents?nextReviewFrom=2024-01-01&nextReviewTo=2024-12-31')
        .expect(200);

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nextReviewDate: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-12-31'),
            },
          }),
        })
      );
    });

    it('should only show APPROVED documents for CONTRIBUTOR users', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.contributor());

      await request(app)
        .get('/api/documents?status=DRAFT')
        .expect(200);

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED',
          }),
        })
      );
    });

    it('should generate and store SharePoint URLs for documents missing documentUrl', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Test Document',
          type: 'POLICY',
          status: 'APPROVED',
          version: '1.0',
          storageLocation: 'SHAREPOINT',
          sharePointSiteId: 'site-1',
          sharePointDriveId: 'drive-1',
          sharePointItemId: 'item-1',
          documentUrl: null,
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
      generateSharePointUrl.mockResolvedValue('https://sharepoint.com/doc');
      prisma.document.update.mockResolvedValue({ ...mockDocuments[0], documentUrl: 'https://sharepoint.com/doc' });

      await request(app)
        .get('/api/documents')
        .set('x-graph-token', 'test-token')
        .expect(200);

      expect(generateSharePointUrl).toHaveBeenCalledWith('site-1', 'drive-1', 'item-1', 'test-token');
      expect(prisma.document.update).toHaveBeenCalled();
    });

    it('should generate Confluence URLs for documents missing documentUrl', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Test Document',
          type: 'POLICY',
          status: 'APPROVED',
          version: '1.0',
          storageLocation: 'CONFLUENCE',
          confluenceSpaceKey: 'TEST',
          confluencePageId: 'page-123',
          documentUrl: null,
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
      generateConfluenceUrl.mockReturnValue('https://test.atlassian.net/pages/viewpage.action?pageId=page-123');
      prisma.document.update.mockResolvedValue({ ...mockDocuments[0], documentUrl: 'https://test.atlassian.net/pages/viewpage.action?pageId=page-123' });

      await request(app)
        .get('/api/documents')
        .expect(200);

      expect(generateConfluenceUrl).toHaveBeenCalledWith('https://test.atlassian.net', 'TEST', 'page-123');
      expect(prisma.document.update).toHaveBeenCalled();
    });

    it('should compute isOverdueReview and isUpcomingReview flags', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      const futureDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days from now
      
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Overdue Document',
          type: 'POLICY',
          status: 'APPROVED',
          version: '1.0',
          nextReviewDate: pastDate,
          requiresAcknowledgement: false,
          lastChangedDate: null,
          lastReviewDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: {
            id: 'user-1',
            displayName: 'Test Owner',
            email: 'owner@paythru.com',
          },
        },
        {
          id: 'doc-2',
          title: 'Upcoming Document',
          type: 'POLICY',
          status: 'APPROVED',
          version: '1.0',
          nextReviewDate: futureDate,
          requiresAcknowledgement: false,
          lastChangedDate: null,
          lastReviewDate: null,
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
      prisma.document.count.mockResolvedValue(2);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get('/api/documents')
        .expect(200);

      expect(response.body.data[0].isOverdueReview).toBe(true);
      expect(response.body.data[0].isUpcomingReview).toBe(false);
      expect(response.body.data[1].isOverdueReview).toBe(false);
      expect(response.body.data[1].isUpcomingReview).toBe(true);
    });

    it('should not compute review flags for DRAFT documents', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Draft Document',
          type: 'POLICY',
          status: 'DRAFT',
          version: '1.0',
          nextReviewDate: pastDate,
          requiresAcknowledgement: false,
          lastChangedDate: null,
          lastReviewDate: null,
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

      expect(response.body.data[0].isOverdueReview).toBe(false);
      expect(response.body.data[0].isUpcomingReview).toBe(false);
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

    it('should restrict access for CONTRIBUTOR users to APPROVED documents only', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const mockDocument = {
        id: docId,
        title: 'Test Document',
        type: 'POLICY',
        status: 'DRAFT',
        owner: { id: '550e8400-e29b-41d4-a716-446655440002', displayName: 'Owner', email: 'owner@paythru.com' },
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.contributor());

      await request(app)
        .get(`/api/documents/${docId}`)
        .expect(403);
    });

    it('should return document with controls and risks', async () => {
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
        DocumentControl: [
          {
            control: {
              id: 'control-1',
              code: 'CTRL-001',
              title: 'Access Control',
            },
          },
        ],
        DocumentRisk: [
          {
            risk: {
              id: 'risk-1',
              title: 'Data Breach',
            },
          },
        ],
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get(`/api/documents/${docId}`)
        .expect(200);

      expect(response.body.DocumentControl).toBeDefined();
      expect(response.body.DocumentRisk).toBeDefined();
    });

    it('should return current version notes when available', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const mockDocument = {
        id: docId,
        title: 'Test Document',
        type: 'POLICY',
        status: 'APPROVED',
        version: '2.0',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };
      const versionHistory = {
        id: 'vh-1',
        notes: 'Version 2.0 notes',
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(versionHistory);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get(`/api/documents/${docId}`)
        .expect(200);

      expect(response.body.currentVersionNotes).toBe('Version 2.0 notes');
    });

    it('should handle errors when fetching document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.document.findUnique.mockRejectedValue(new Error('Database error'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get(`/api/documents/${docId}`)
        .expect(500);
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

    it('should auto-set requiresAcknowledgement to true for POLICY type', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      const newDocument = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'New Policy',
        type: 'POLICY',
        status: 'DRAFT',
        version: '1.0',
        storageLocation: 'SHAREPOINT',
        ownerUserId: ownerId,
        requiresAcknowledgement: true,
        owner: {
          id: ownerId,
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.document.create.mockResolvedValue(newDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/documents')
        .send({
          title: 'New Policy',
          type: 'POLICY',
          storageLocation: 'SHAREPOINT',
          version: '1.0',
          status: 'DRAFT',
          ownerUserId: ownerId,
        })
        .expect(201);

      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requiresAcknowledgement: true,
          }),
        })
      );
    });

    it('should generate SharePoint URL when creating document with SharePoint IDs', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      const newDocument = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'New Document',
        type: 'POLICY',
        status: 'DRAFT',
        version: '1.0',
        storageLocation: 'SHAREPOINT',
        ownerUserId: ownerId,
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
        documentUrl: 'https://sharepoint.com/doc',
        owner: {
          id: ownerId,
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      generateSharePointUrl.mockResolvedValue('https://sharepoint.com/doc');
      prisma.document.create.mockResolvedValue(newDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/documents')
        .set('x-graph-token', 'test-token')
        .send({
          title: 'New Document',
          type: 'POLICY',
          storageLocation: 'SHAREPOINT',
          version: '1.0',
          status: 'DRAFT',
          ownerUserId: ownerId,
          sharePointSiteId: 'site-1',
          sharePointDriveId: 'drive-1',
          sharePointItemId: 'item-1',
        })
        .expect(201);

      expect(generateSharePointUrl).toHaveBeenCalledWith('site-1', 'drive-1', 'item-1', 'test-token');
    });

    it('should generate Confluence URL when creating document with Confluence IDs', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      const newDocument = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'New Document',
        type: 'POLICY',
        status: 'DRAFT',
        version: '1.0',
        storageLocation: 'CONFLUENCE',
        ownerUserId: ownerId,
        confluenceSpaceKey: 'TEST',
        confluencePageId: 'page-123',
        documentUrl: 'https://test.atlassian.net/pages/viewpage.action?pageId=page-123',
        owner: {
          id: ownerId,
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      generateConfluenceUrl.mockReturnValue('https://test.atlassian.net/pages/viewpage.action?pageId=page-123');
      prisma.document.create.mockResolvedValue(newDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/documents')
        .send({
          title: 'New Document',
          type: 'POLICY',
          storageLocation: 'CONFLUENCE',
          version: '1.0',
          status: 'DRAFT',
          ownerUserId: ownerId,
          confluenceSpaceKey: 'TEST',
          confluencePageId: 'page-123',
        })
        .expect(201);

      expect(generateConfluenceUrl).toHaveBeenCalledWith('https://test.atlassian.net', 'TEST', 'page-123');
    });

    it('should create version history entry when versionNotes provided', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      const userId = '550e8400-e29b-41d4-a716-446655440003';
      const newDocument = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'New Document',
        type: 'POLICY',
        status: 'DRAFT',
        version: '1.0',
        storageLocation: 'SHAREPOINT',
        ownerUserId: ownerId,
        owner: {
          id: ownerId,
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.document.create.mockResolvedValue(newDocument);
      prisma.user.findUnique.mockResolvedValueOnce(mockUsers.admin());
      prisma.user.findUnique.mockResolvedValueOnce({ id: userId });

      await request(app)
        .post('/api/documents')
        .send({
          title: 'New Document',
          type: 'POLICY',
          storageLocation: 'SHAREPOINT',
          version: '1.0',
          status: 'DRAFT',
          ownerUserId: ownerId,
          versionNotes: 'Initial version notes',
        })
        .expect(201);

      expect(prisma.documentVersionHistory.create).toHaveBeenCalled();
    });

    it('should handle date string conversion for lastReviewDate and nextReviewDate', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      const newDocument = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'New Document',
        type: 'POLICY',
        status: 'DRAFT',
        version: '1.0',
        storageLocation: 'SHAREPOINT',
        ownerUserId: ownerId,
        lastReviewDate: new Date('2024-01-01T00:00:00.000Z'),
        nextReviewDate: new Date('2024-12-31T00:00:00.000Z'),
        owner: {
          id: ownerId,
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.document.create.mockResolvedValue(newDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/documents')
        .send({
          title: 'New Document',
          type: 'POLICY',
          storageLocation: 'SHAREPOINT',
          version: '1.0',
          status: 'DRAFT',
          ownerUserId: ownerId,
          lastReviewDate: '2024-01-01',
          nextReviewDate: '2024-12-31',
        })
        .expect(201);

      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastReviewDate: expect.any(Date),
            nextReviewDate: expect.any(Date),
          }),
        })
      );
    });

    it('should handle errors when creating document', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.document.create.mockRejectedValue(new Error('Database error'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/documents')
        .send({
          title: 'New Document',
          type: 'POLICY',
          storageLocation: 'SHAREPOINT',
          version: '1.0',
          status: 'DRAFT',
          ownerUserId: ownerId,
        })
        .expect(500);
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

    it('should regenerate SharePoint URL when SharePoint IDs change', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        title: 'Existing Document',
        type: 'POLICY',
        status: 'APPROVED',
        version: '1.0',
        storageLocation: 'SHAREPOINT',
        sharePointSiteId: 'old-site',
        sharePointDriveId: 'old-drive',
        sharePointItemId: 'old-item',
      };
      const updatedDocument = {
        ...existingDocument,
        sharePointSiteId: 'new-site',
        sharePointDriveId: 'new-drive',
        sharePointItemId: 'new-item',
        documentUrl: 'https://sharepoint.com/new-doc',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.document.findUnique.mockResolvedValue(existingDocument);
      generateSharePointUrl.mockResolvedValue('https://sharepoint.com/new-doc');
      prisma.document.update.mockResolvedValue(updatedDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put(`/api/documents/${docId}`)
        .set('x-graph-token', 'test-token')
        .send({
          sharePointSiteId: 'new-site',
          sharePointDriveId: 'new-drive',
          sharePointItemId: 'new-item',
        })
        .expect(200);

      expect(generateSharePointUrl).toHaveBeenCalledWith('new-site', 'new-drive', 'new-item', 'test-token');
    });

    it('should regenerate Confluence URL when Confluence IDs change', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        title: 'Existing Document',
        type: 'POLICY',
        status: 'APPROVED',
        version: '1.0',
        storageLocation: 'CONFLUENCE',
        confluenceSpaceKey: 'OLD',
        confluencePageId: 'old-page',
      };
      const updatedDocument = {
        ...existingDocument,
        confluenceSpaceKey: 'NEW',
        confluencePageId: 'new-page',
        documentUrl: 'https://test.atlassian.net/pages/viewpage.action?pageId=new-page',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.document.findUnique.mockResolvedValue(existingDocument);
      generateConfluenceUrl.mockReturnValue('https://test.atlassian.net/pages/viewpage.action?pageId=new-page');
      prisma.document.update.mockResolvedValue(updatedDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put(`/api/documents/${docId}`)
        .send({
          confluenceSpaceKey: 'NEW',
          confluencePageId: 'new-page',
        })
        .expect(200);

      expect(generateConfluenceUrl).toHaveBeenCalledWith('https://test.atlassian.net', 'NEW', 'new-page');
    });

    it('should update existing version history notes', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const userId = '550e8400-e29b-41d4-a716-446655440003';
      const existingDocument = {
        id: docId,
        title: 'Existing Document',
        type: 'POLICY',
        status: 'APPROVED',
        version: '2.0',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
      };
      const existingVersionHistory = {
        id: 'vh-1',
        documentId: docId,
        version: '2.0',
        notes: 'Old notes',
      };
      const updatedDocument = {
        ...existingDocument,
        title: 'Updated Title',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.user.findUnique.mockResolvedValueOnce(mockUsers.admin());
      prisma.user.findUnique.mockResolvedValueOnce({ id: userId });
      prisma.documentVersionHistory.findFirst.mockResolvedValue(existingVersionHistory);
      prisma.documentVersionHistory.update.mockResolvedValue({
        ...existingVersionHistory,
        notes: 'Updated notes',
      });
      prisma.document.update.mockResolvedValue(updatedDocument);

      await request(app)
        .put(`/api/documents/${docId}`)
        .send({
          title: 'Updated Title',
          versionNotes: 'Updated notes',
        })
        .expect(200);

      expect(prisma.documentVersionHistory.update).toHaveBeenCalled();
    });

    it('should handle requiresAcknowledgement when type changes to POLICY', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        title: 'Existing Document',
        type: 'PROCEDURE',
        status: 'APPROVED',
        version: '1.0',
        requiresAcknowledgement: false,
      };
      const updatedDocument = {
        ...existingDocument,
        type: 'POLICY',
        requiresAcknowledgement: true,
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.document.update.mockResolvedValue(updatedDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put(`/api/documents/${docId}`)
        .send({
          type: 'POLICY',
        })
        .expect(200);

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requiresAcknowledgement: true,
          }),
        })
      );
    });

    it('should handle date string conversion for lastChangedDate', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        title: 'Existing Document',
        type: 'POLICY',
        status: 'APPROVED',
        version: '1.0',
      };
      const updatedDocument = {
        ...existingDocument,
        lastChangedDate: new Date('2024-01-01T00:00:00.000Z'),
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.document.update.mockResolvedValue(updatedDocument);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put(`/api/documents/${docId}`)
        .send({
          lastChangedDate: '2024-01-01',
        })
        .expect(200);

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastChangedDate: expect.any(Date),
          }),
        })
      );
    });

    it('should handle P2025 error when updating non-existent document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        title: 'Existing Document',
        type: 'POLICY',
        status: 'APPROVED',
        version: '1.0',
      };
      const error: any = new Error('Record not found');
      error.code = 'P2025';

      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.document.update.mockRejectedValue(error);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put(`/api/documents/${docId}`)
        .send({ title: 'Updated' })
        .expect(404);
    });

    it('should handle errors when updating document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        title: 'Existing Document',
        type: 'POLICY',
        status: 'APPROVED',
        version: '1.0',
      };

      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.document.update.mockRejectedValue(new Error('Database error'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put(`/api/documents/${docId}`)
        .send({ title: 'Updated' })
        .expect(500);
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

  describe('GET /api/documents/:id/version-notes', () => {
    it('should return version notes for current version', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const document = {
        id: docId,
        version: '2.0',
      };
      const versionHistory = {
        id: 'vh-1',
        documentId: docId,
        version: '2.0',
        notes: 'Updated data retention policy',
      };

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(versionHistory);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get(`/api/documents/${docId}/version-notes`)
        .expect(200);

      expect(response.body).toEqual({
        documentId: docId,
        version: '2.0',
        notes: 'Updated data retention policy',
      });
    });

    it('should return null notes if no version history exists', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const document = {
        id: docId,
        version: '2.0',
      };

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get(`/api/documents/${docId}/version-notes`)
        .expect(200);

      expect(response.body.notes).toBeNull();
    });

    it('should return 404 for non-existent document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440000';
      prisma.document.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get(`/api/documents/${docId}/version-notes`)
        .expect(404);
    });

    it('should return version notes for specific version', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const document = {
        id: docId,
        version: '2.0',
      };
      const versionHistory = {
        id: 'vh-1',
        documentId: docId,
        version: '1.0',
        notes: 'Version 1.0 notes',
      };

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(versionHistory);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get(`/api/documents/${docId}/version-notes?version=1.0`)
        .expect(200);

      expect(response.body).toEqual({
        documentId: docId,
        version: '1.0',
        notes: 'Version 1.0 notes',
      });
    });

    it('should return version notes for current version when version=current', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const document = {
        id: docId,
        version: '2.0',
      };
      const versionHistory = {
        id: 'vh-1',
        documentId: docId,
        version: '2.0',
        notes: 'Current version notes',
      };

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(versionHistory);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get(`/api/documents/${docId}/version-notes?version=current`)
        .expect(200);

      expect(response.body.version).toBe('2.0');
      expect(response.body.notes).toBe('Current version notes');
    });

    it('should handle errors when fetching version notes', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.document.findUnique.mockRejectedValue(new Error('Database error'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get(`/api/documents/${docId}/version-notes`)
        .expect(500);
    });
  });

  describe('GET /api/documents/:id/version-history', () => {
    it('should return full version history for admin', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const document = { id: docId };
      const versionHistory = [
        {
          id: 'vh-1',
          documentId: docId,
          version: '2.0',
          notes: 'Updated policy',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'vh-2',
          documentId: docId,
          version: '1.0',
          notes: 'Initial version',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.documentVersionHistory.findMany.mockResolvedValue(versionHistory);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get(`/api/documents/${docId}/version-history`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].version).toBe('2.0');
    });

    it('should return 404 for non-existent document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440000';
      prisma.document.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get(`/api/documents/${docId}/version-history`)
        .expect(404);
    });
  });

  describe('POST /api/documents/:id/version-updates', () => {
    it('should update document version successfully', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        version: '1.0',
        status: 'APPROVED',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
      };
      const updatedDocument = {
        ...existingDocument,
        version: '2.0',
        owner: {
          id: 'user-1',
          displayName: 'Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(null);
      prisma.documentVersionHistory.create.mockResolvedValue({
        id: 'vh-1',
        documentId: docId,
        version: '2.0',
        notes: 'Updated policy',
      });
      prisma.document.update.mockResolvedValue(updatedDocument);

      const response = await request(app)
        .post(`/api/documents/${docId}/version-updates`)
        .send({
          currentVersion: '1.0',
          newVersion: '2.0',
          notes: 'Updated policy',
        })
        .expect(200);

      expect(response.body.version).toBe('2.0');
      expect(prisma.document.update).toHaveBeenCalled();
      expect(prisma.documentVersionHistory.create).toHaveBeenCalled();
    });

    it('should return 409 if currentVersion does not match', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        version: '2.0', // Different from currentVersion in request
        status: 'APPROVED',
      };

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.document.findUnique.mockResolvedValue(existingDocument);

      const response = await request(app)
        .post(`/api/documents/${docId}/version-updates`)
        .send({
          currentVersion: '1.0',
          newVersion: '2.0',
          notes: 'Updated policy',
        })
        .expect(409);

      expect(response.body.error).toBe('Version mismatch');
    });

    it('should update existing version history if version already exists', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        version: '1.0',
        status: 'APPROVED',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
      };
      const existingVersionHistory = {
        id: 'vh-1',
        documentId: docId,
        version: '2.0',
        notes: 'Old notes',
      };
      const updatedDocument = {
        ...existingDocument,
        version: '2.0',
        owner: {
          id: 'user-1',
          displayName: 'Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(existingVersionHistory);
      prisma.documentVersionHistory.update.mockResolvedValue({
        ...existingVersionHistory,
        notes: 'Updated notes',
      });
      prisma.document.update.mockResolvedValue(updatedDocument);

      await request(app)
        .post(`/api/documents/${docId}/version-updates`)
        .send({
          currentVersion: '1.0',
          newVersion: '2.0',
          notes: 'Updated notes',
        })
        .expect(200);

      expect(prisma.documentVersionHistory.update).toHaveBeenCalled();
    });

    it('should handle review dates in version update', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        version: '1.0',
        status: 'APPROVED',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
      };
      const updatedDocument = {
        ...existingDocument,
        version: '2.0',
        lastReviewDate: new Date('2024-01-01T00:00:00.000Z'),
        nextReviewDate: new Date('2024-12-31T00:00:00.000Z'),
        owner: {
          id: 'user-1',
          displayName: 'Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(null);
      prisma.documentVersionHistory.create.mockResolvedValue({});
      prisma.document.update.mockResolvedValue(updatedDocument);

      await request(app)
        .post(`/api/documents/${docId}/version-updates`)
        .send({
          currentVersion: '1.0',
          newVersion: '2.0',
          notes: 'Updated policy',
          lastReviewDate: '2024-01-01',
          nextReviewDate: '2024-12-31',
        })
        .expect(200);

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastReviewDate: expect.any(Date),
            nextReviewDate: expect.any(Date),
          }),
        })
      );
    });

    it('should set lastChangedDate when status is APPROVED', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        version: '1.0',
        status: 'APPROVED',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
      };
      const updatedDocument = {
        ...existingDocument,
        version: '2.0',
        lastChangedDate: new Date(),
        owner: {
          id: 'user-1',
          displayName: 'Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(null);
      prisma.documentVersionHistory.create.mockResolvedValue({});
      prisma.document.update.mockResolvedValue(updatedDocument);

      await request(app)
        .post(`/api/documents/${docId}/version-updates`)
        .send({
          currentVersion: '1.0',
          newVersion: '2.0',
          notes: 'Updated policy',
        })
        .expect(200);

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastChangedDate: expect.any(Date),
          }),
        })
      );
    });

    it('should handle optional review dates', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        version: '1.0',
        status: 'APPROVED',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
      };
      const updatedDocument = {
        ...existingDocument,
        version: '2.0',
        owner: {
          id: 'user-1',
          displayName: 'Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(null);
      prisma.documentVersionHistory.create.mockResolvedValue({});
      prisma.document.update.mockResolvedValue(updatedDocument);

      // Test that review dates are optional (not sent in request)
      await request(app)
        .post(`/api/documents/${docId}/version-updates`)
        .send({
          currentVersion: '1.0',
          newVersion: '2.0',
          notes: 'Updated policy',
        })
        .expect(200);

      expect(prisma.document.update).toHaveBeenCalled();
    });


    it('should return 404 when user not found', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.user.findUnique.mockResolvedValue(null);

      await request(app)
        .post(`/api/documents/${docId}/version-updates`)
        .send({
          currentVersion: '1.0',
          newVersion: '2.0',
          notes: 'Updated policy',
        })
        .expect(404);
    });

    it('should handle P2002 error when version already exists', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        version: '1.0',
        status: 'APPROVED',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
      };
      const error: any = new Error('Unique constraint violation');
      error.code = 'P2002';

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(null);
      prisma.documentVersionHistory.create.mockRejectedValue(error);

      const response = await request(app)
        .post(`/api/documents/${docId}/version-updates`)
        .send({
          currentVersion: '1.0',
          newVersion: '2.0',
          notes: 'Updated policy',
        })
        .expect(409);

      expect(response.body.error).toBe('Version already exists');
    });

    it('should handle errors when updating version', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        version: '1.0',
        status: 'APPROVED',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
      };

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.documentVersionHistory.findFirst.mockRejectedValue(new Error('Database error'));

      await request(app)
        .post(`/api/documents/${docId}/version-updates`)
        .send({
          currentVersion: '1.0',
          newVersion: '2.0',
          notes: 'Updated policy',
        })
        .expect(500);
    });
  });

  describe('PUT /api/documents/:id with versionNotes', () => {
    it('should update version notes for current version', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        version: '2.0',
        status: 'APPROVED',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
      };
      const updatedDocument = {
        ...existingDocument,
        title: 'Updated Title',
        owner: {
          id: 'user-1',
          displayName: 'Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(null);
      prisma.documentVersionHistory.create.mockResolvedValue({
        id: 'vh-1',
        documentId: docId,
        version: '2.0',
        notes: 'Updated notes',
      });
      prisma.document.update.mockResolvedValue(updatedDocument);

      const response = await request(app)
        .put(`/api/documents/${docId}`)
        .send({
          title: 'Updated Title',
          versionNotes: 'Updated notes',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Title');
      expect(prisma.documentVersionHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: 'Updated notes',
            version: '2.0',
          }),
        })
      );
    });

    it('should not allow version changes through PUT endpoint', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const existingDocument = {
        id: docId,
        version: '1.0',
        status: 'APPROVED',
      };
      const updatedDocument = {
        ...existingDocument,
        title: 'Updated Title',
        version: '1.0', // Version should remain unchanged
        owner: {
          id: 'user-1',
          displayName: 'Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.document.findUnique.mockResolvedValue(existingDocument);
      prisma.documentVersionHistory.findFirst.mockResolvedValue(null);
      prisma.documentVersionHistory.create.mockResolvedValue({});
      prisma.document.update.mockResolvedValue(updatedDocument);

      await request(app)
        .put(`/api/documents/${docId}`)
        .send({
          title: 'Updated Title',
          version: '2.0', // This should be ignored
          versionNotes: 'Some notes',
        })
        .expect(200);

      // Version should not be in the update call
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            version: '2.0',
          }),
        })
      );
    });
  });

  describe('POST /api/documents/bulk-import', () => {
    it('should import new documents from SharePoint', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      const sharePointItem = {
        id: 'item-1',
        name: 'Test Document.docx',
        webUrl: 'https://sharepoint.com/doc',
      };
      const newDocument = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'Test Document.docx',
        type: 'OTHER',
        status: 'DRAFT',
        version: '1.0',
        storageLocation: 'SHAREPOINT',
        ownerUserId: ownerId,
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
        documentUrl: 'https://sharepoint.com/doc',
        owner: {
          id: ownerId,
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      getSharePointItem.mockResolvedValue(sharePointItem);
      prisma.document.findFirst.mockResolvedValue(null);
      prisma.document.create.mockResolvedValue(newDocument);

      const response = await request(app)
        .post('/api/documents/bulk-import')
        .set('x-graph-token', 'test-token')
        .send({
          items: [
            {
              itemId: 'item-1',
              siteId: 'site-1',
              driveId: 'drive-1',
            },
          ],
          defaults: {
            ownerUserId: ownerId,
          },
        })
        .expect(200);

      expect(response.body.success).toBe(1);
      expect(response.body.failed).toBe(0);
      expect(getSharePointItem).toHaveBeenCalledWith('test-token', 'site-1', 'drive-1', 'item-1');
    });

    it('should update existing documents during bulk import', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      const sharePointItem = {
        id: 'item-1',
        name: 'Updated Document.docx',
        webUrl: 'https://sharepoint.com/updated-doc',
      };
      const existingDocument = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'Old Document.docx',
        type: 'OTHER',
        status: 'DRAFT',
        version: '1.0',
        storageLocation: 'SHAREPOINT',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
        owner: {
          id: ownerId,
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };
      const updatedDocument = {
        ...existingDocument,
        title: 'Updated Document.docx',
        documentUrl: 'https://sharepoint.com/updated-doc',
      };

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      getSharePointItem.mockResolvedValue(sharePointItem);
      prisma.document.findFirst.mockResolvedValue(existingDocument);
      prisma.document.update.mockResolvedValue(updatedDocument);

      const response = await request(app)
        .post('/api/documents/bulk-import')
        .set('x-graph-token', 'test-token')
        .send({
          items: [
            {
              itemId: 'item-1',
              siteId: 'site-1',
              driveId: 'drive-1',
            },
          ],
          defaults: {
            ownerUserId: ownerId,
          },
        })
        .expect(200);

      expect(response.body.success).toBe(1);
      expect(response.body.results[0].action).toBe('updated');
    });

    it('should return 400 when access token is missing', async () => {
      await request(app)
        .post('/api/documents/bulk-import')
        .send({
          items: [
            {
              itemId: 'item-1',
            },
          ],
        })
        .expect(400);
    });

    it('should return 400 when ownerUserId is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await request(app)
        .post('/api/documents/bulk-import')
        .set('x-graph-token', 'test-token')
        .send({
          items: [
            {
              itemId: 'item-1',
            },
          ],
        })
        .expect(400);
    });

    it('should handle errors for individual items', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';
      const sharePointItem = {
        id: 'item-1',
        name: 'Test Document.docx',
        webUrl: 'https://sharepoint.com/doc',
      };
      const newDocument = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'Test Document.docx',
        type: 'OTHER',
        status: 'DRAFT',
        version: '1.0',
        storageLocation: 'SHAREPOINT',
        ownerUserId: ownerId,
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
        documentUrl: 'https://sharepoint.com/doc',
        owner: {
          id: ownerId,
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      getSharePointItem
        .mockResolvedValueOnce(sharePointItem)
        .mockRejectedValueOnce(new Error('SharePoint error'));
      prisma.document.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prisma.document.create.mockResolvedValue(newDocument);

      const response = await request(app)
        .post('/api/documents/bulk-import')
        .set('x-graph-token', 'test-token')
        .send({
          items: [
            {
              itemId: 'item-1',
              siteId: 'site-1',
              driveId: 'drive-1',
            },
            {
              itemId: 'item-2',
              siteId: 'site-1',
              driveId: 'drive-1',
            },
          ],
          defaults: {
            ownerUserId: ownerId,
          },
        })
        .expect(200);

      expect(response.body.success).toBe(1);
      expect(response.body.failed).toBe(1);
      expect(response.body.errors).toHaveLength(1);
    });

    it('should handle errors when SharePoint item is not found', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      getSharePointItem.mockResolvedValue(null);
      prisma.document.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/documents/bulk-import')
        .set('x-graph-token', 'test-token')
        .send({
          items: [
            {
              itemId: 'item-1',
              siteId: 'site-1',
              driveId: 'drive-1',
            },
          ],
          defaults: {
            ownerUserId: ownerId,
          },
        })
        .expect(200);

      expect(response.body.failed).toBe(1);
      expect(response.body.errors[0].error).toContain('not found');
    });

    it('should handle errors when siteId or driveId is missing and config defaults are not set', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440001';

      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      getSharePointItem.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/documents/bulk-import')
        .set('x-graph-token', 'test-token')
        .send({
          items: [
            {
              itemId: 'item-1',
              // siteId and driveId missing, will use config defaults
            },
          ],
          defaults: {
            ownerUserId: ownerId,
          },
        })
        .expect(200);

      // The code uses config defaults, so if defaults are set, it will try to fetch
      // If fetch fails, it will return "SharePoint item not found or inaccessible"
      expect(response.body.failed).toBe(1);
      expect(response.body.errors[0].error).toBeDefined();
    });

    it('should handle errors during bulk import', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await request(app)
        .post('/api/documents/bulk-import')
        .set('x-graph-token', 'test-token')
        .send({
          items: [
            {
              itemId: 'item-1',
            },
          ],
        })
        .expect(500);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('should perform hard delete when hard=true', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const document = {
        id: docId,
        title: 'Test Document',
        status: 'APPROVED',
      };

      prisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          reviewTask: { deleteMany: jest.fn().mockResolvedValue({}) },
          acknowledgment: { deleteMany: jest.fn().mockResolvedValue({}) },
          documentControl: { deleteMany: jest.fn().mockResolvedValue({}) },
          documentRisk: { deleteMany: jest.fn().mockResolvedValue({}) },
          document: { delete: jest.fn().mockResolvedValue(document) },
        });
      });
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/documents/${docId}?hard=true`)
        .expect(200);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should handle P2034 timeout error during hard delete', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const error: any = new Error('Transaction timeout');
      error.code = 'P2034';

      prisma.$transaction.mockRejectedValue(error);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .delete(`/api/documents/${docId}?hard=true`)
        .expect(408);

      expect(response.body.error).toContain('timed out');
    });

    it('should handle errors when deleting document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const error: any = new Error('Database error');
      prisma.document.update.mockRejectedValue(error);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/documents/${docId}`)
        .expect(500);
    });
  });

  describe('GET /api/documents/:id/controls', () => {
    it('should return all controls linked to a document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const document = { id: docId };
      const documentControls = [
        {
          control: {
            id: 'control-1',
            code: 'CTRL-001',
            title: 'Access Control',
            category: 'ACCESS',
            isStandardControl: true,
          },
        },
        {
          control: {
            id: 'control-2',
            code: 'CTRL-002',
            title: 'Data Encryption',
            category: 'ENCRYPTION',
            isStandardControl: true,
          },
        },
      ];

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.documentControl.findMany.mockResolvedValue(documentControls);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get(`/api/documents/${docId}/controls`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].code).toBe('CTRL-001');
    });

    it('should return 404 for non-existent document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440000';
      prisma.document.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get(`/api/documents/${docId}/controls`)
        .expect(404);
    });

    it('should handle errors when fetching controls', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.document.findUnique.mockResolvedValue({ id: docId });
      prisma.documentControl.findMany.mockRejectedValue(new Error('Database error'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get(`/api/documents/${docId}/controls`)
        .expect(500);
    });
  });

  describe('POST /api/documents/:id/controls', () => {
    it('should link a control to a document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const controlId = '550e8400-e29b-41d4-a716-446655440002';
      const document = { id: docId };
      const control = { id: controlId };
      const linkedControl = {
        id: controlId,
        code: 'CTRL-001',
        title: 'Access Control',
        category: 'ACCESS',
        isStandardControl: true,
      };

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.control.findUnique.mockResolvedValue(control);
      prisma.documentControl.findUnique.mockResolvedValue(null);
      prisma.documentControl.create.mockResolvedValue({});
      prisma.control.findUnique.mockResolvedValueOnce(control).mockResolvedValueOnce(linkedControl);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .post(`/api/documents/${docId}/controls`)
        .send({ controlId })
        .expect(201);

      expect(response.body.code).toBe('CTRL-001');
    });

    it('should return 400 when control is already linked', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const controlId = '550e8400-e29b-41d4-a716-446655440002';
      const document = { id: docId };
      const control = { id: controlId };
      const existingLink = {
        documentId: docId,
        controlId: controlId,
      };

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.control.findUnique.mockResolvedValue(control);
      prisma.documentControl.findUnique.mockResolvedValue(existingLink);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/documents/${docId}/controls`)
        .send({ controlId })
        .expect(400);
    });

    it('should return 404 when document not found', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440000';
      const controlId = '550e8400-e29b-41d4-a716-446655440002';
      prisma.document.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/documents/${docId}/controls`)
        .send({ controlId })
        .expect(404);
    });

    it('should return 404 when control not found', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const controlId = '550e8400-e29b-41d4-a716-446655440000';
      const document = { id: docId };
      prisma.document.findUnique.mockResolvedValue(document);
      prisma.control.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/documents/${docId}/controls`)
        .send({ controlId })
        .expect(404);
    });

    it('should handle P2002 error when link already exists', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const controlId = '550e8400-e29b-41d4-a716-446655440002';
      const document = { id: docId };
      const control = { id: controlId };
      const error: any = new Error('Unique constraint violation');
      error.code = 'P2002';

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.control.findUnique.mockResolvedValue(control);
      prisma.documentControl.findUnique.mockResolvedValue(null);
      prisma.documentControl.create.mockRejectedValue(error);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/documents/${docId}/controls`)
        .send({ controlId })
        .expect(400);
    });

    it('should handle errors when linking control', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const controlId = '550e8400-e29b-41d4-a716-446655440002';
      const document = { id: docId };
      const control = { id: controlId };

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.control.findUnique.mockResolvedValue(control);
      prisma.documentControl.findUnique.mockResolvedValue(null);
      prisma.documentControl.create.mockRejectedValue(new Error('Database error'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/documents/${docId}/controls`)
        .send({ controlId })
        .expect(500);
    });
  });

  describe('DELETE /api/documents/:id/controls/:controlId', () => {
    it('should unlink a control from a document', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const controlId = '550e8400-e29b-41d4-a716-446655440002';
      const document = { id: docId };
      const control = { id: controlId };
      const existingLink = {
        documentId: docId,
        controlId: controlId,
      };

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.control.findUnique.mockResolvedValue(control);
      prisma.documentControl.findUnique.mockResolvedValue(existingLink);
      prisma.documentControl.delete.mockResolvedValue(existingLink);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/documents/${docId}/controls/${controlId}`)
        .expect(204);
    });

    it('should return 404 when document not found', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440000';
      const controlId = '550e8400-e29b-41d4-a716-446655440002';
      prisma.document.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/documents/${docId}/controls/${controlId}`)
        .expect(404);
    });

    it('should return 404 when control not found', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const controlId = '550e8400-e29b-41d4-a716-446655440000';
      const document = { id: docId };
      prisma.document.findUnique.mockResolvedValue(document);
      prisma.control.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/documents/${docId}/controls/${controlId}`)
        .expect(404);
    });

    it('should return 404 when link does not exist', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const controlId = '550e8400-e29b-41d4-a716-446655440002';
      const document = { id: docId };
      const control = { id: controlId };

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.control.findUnique.mockResolvedValue(control);
      prisma.documentControl.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/documents/${docId}/controls/${controlId}`)
        .expect(404);
    });

    it('should handle P2025 error when link not found', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const controlId = '550e8400-e29b-41d4-a716-446655440002';
      const document = { id: docId };
      const control = { id: controlId };
      const existingLink = {
        documentId: docId,
        controlId: controlId,
      };
      const error: any = new Error('Record not found');
      error.code = 'P2025';

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.control.findUnique.mockResolvedValue(control);
      prisma.documentControl.findUnique.mockResolvedValue(existingLink);
      prisma.documentControl.delete.mockRejectedValue(error);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/documents/${docId}/controls/${controlId}`)
        .expect(404);
    });

    it('should handle errors when unlinking control', async () => {
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const controlId = '550e8400-e29b-41d4-a716-446655440002';
      const document = { id: docId };
      const control = { id: controlId };
      const existingLink = {
        documentId: docId,
        controlId: controlId,
      };

      prisma.document.findUnique.mockResolvedValue(document);
      prisma.control.findUnique.mockResolvedValue(control);
      prisma.documentControl.findUnique.mockResolvedValue(existingLink);
      prisma.documentControl.delete.mockRejectedValue(new Error('Database error'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/documents/${docId}/controls/${controlId}`)
        .expect(500);
    });
  });

  describe('POST /api/documents/suggest-controls', () => {
    it('should return suggested controls using embeddings', async () => {
      const documentEmbedding = [0.1, 0.2, 0.3];
      const allControls = [
        {
          id: 'control-1',
          code: 'CTRL-001',
          title: 'Access Control Policy',
          embedding: [0.15, 0.25, 0.35],
        },
        {
          id: 'control-2',
          code: 'CTRL-002',
          title: 'Data Encryption',
          embedding: [0.9, 0.8, 0.7],
        },
      ];

      generateEmbedding.mockResolvedValue(documentEmbedding);
      cosineSimilarity
        .mockReturnValueOnce(0.95) // High similarity
        .mockReturnValueOnce(0.3); // Low similarity
      mapToScore
        .mockReturnValueOnce(85) // Above threshold
        .mockReturnValueOnce(40); // Below threshold
      prisma.control.findMany.mockResolvedValue(allControls);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .post('/api/documents/suggest-controls')
        .send({
          title: 'Access Control Policy Document',
          type: 'POLICY',
        })
        .expect(200);

      expect(response.body.suggestedControlIds).toContain('control-1');
      expect(response.body.suggestedControlIds).not.toContain('control-2');
    });

    it('should fallback to keyword matching when embedding generation fails', async () => {
      const allControls = [
        {
          id: 'control-1',
          code: 'CTRL-001',
          title: 'Access Control Policy',
        },
        {
          id: 'control-2',
          code: 'CTRL-002',
          title: 'Data Encryption Standard',
        },
      ];

      generateEmbedding.mockResolvedValue(null);
      prisma.control.findMany.mockResolvedValue(allControls);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .post('/api/documents/suggest-controls')
        .send({
          title: 'Access Control Policy Document',
          type: 'POLICY',
        })
        .expect(200);

      expect(response.body.suggestedControlIds).toBeDefined();
      expect(Array.isArray(response.body.suggestedControlIds)).toBe(true);
    });

    it('should return 400 when title is missing', async () => {
      await request(app)
        .post('/api/documents/suggest-controls')
        .send({
          type: 'POLICY',
        })
        .expect(400);
    });

    it('should return 400 when title is empty', async () => {
      await request(app)
        .post('/api/documents/suggest-controls')
        .send({
          title: '   ',
          type: 'POLICY',
        })
        .expect(400);
    });

    it('should apply keyword boosting for important terms', async () => {
      const documentEmbedding = [0.1, 0.2, 0.3];
      const allControls = [
        {
          id: 'control-1',
          code: 'CTRL-001',
          title: 'Security Awareness Training',
          embedding: [0.15, 0.25, 0.35],
        },
      ];

      generateEmbedding.mockResolvedValue(documentEmbedding);
      cosineSimilarity.mockReturnValue(0.5); // Medium similarity
      mapToScore.mockReturnValue(50); // Below threshold initially
      prisma.control.findMany.mockResolvedValue(allControls);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .post('/api/documents/suggest-controls')
        .send({
          title: 'Security Awareness Training Policy',
          type: 'POLICY',
        })
        .expect(200);

      // Should be included due to keyword boosting
      expect(response.body.suggestedControlIds.length).toBeGreaterThan(0);
    });

    it('should filter controls by isStandardControl and embedding presence', async () => {
      const documentEmbedding = [0.1, 0.2, 0.3];
      const allControls = [
        {
          id: 'control-1',
          code: 'CTRL-001',
          title: 'Access Control',
          embedding: [0.15, 0.25, 0.35],
        },
        {
          id: 'control-2',
          code: 'CTRL-002',
          title: 'Custom Control',
          embedding: null, // No embedding
        },
      ];

      generateEmbedding.mockResolvedValue(documentEmbedding);
      cosineSimilarity.mockReturnValue(0.95);
      mapToScore.mockReturnValue(85);
      prisma.control.findMany.mockResolvedValue(allControls);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/documents/suggest-controls')
        .send({
          title: 'Access Control Policy',
          type: 'POLICY',
        })
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isStandardControl: true,
            embedding: expect.anything(),
          }),
        })
      );
    });

    it('should handle errors when suggesting controls', async () => {
      generateEmbedding.mockRejectedValue(new Error('LLM service error'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/documents/suggest-controls')
        .send({
          title: 'Test Document',
          type: 'POLICY',
        })
        .expect(500);
    });
  });
});




