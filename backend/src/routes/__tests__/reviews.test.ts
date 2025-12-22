/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import { reviewsRouter } from '../reviews';
import { createMockUser, mockUsers } from '../../lib/test-helpers';

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
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    reviewTask: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock documentServiceClient
jest.mock('../../clients/documentServiceClient', () => ({
  invalidateCacheRemote: jest.fn().mockResolvedValue({ invalidated: 1 }),
}));

// Mock express-validator - validators are middleware functions
let mockValidationResult: any;
jest.mock('express-validator', () => {
  const mockValidator = (req: any, res: any, next: any) => next();
  const createChain = () => ({
    isUUID: jest.fn().mockReturnValue(mockValidator),
    isISO8601: jest.fn().mockReturnValue(mockValidator),
    isString: jest.fn().mockReturnValue(mockValidator),
    isArray: jest.fn().mockReturnValue({
      notEmpty: jest.fn().mockReturnValue(mockValidator),
    }),
    notEmpty: jest.fn().mockReturnValue(mockValidator),
    optional: jest.fn().mockReturnValue({
      isString: jest.fn().mockReturnValue(mockValidator),
      isISO8601: jest.fn().mockReturnValue(mockValidator),
    }),
  });
  return {
    body: jest.fn(() => createChain()),
    param: jest.fn(() => ({
      isUUID: jest.fn().mockReturnValue(mockValidator),
    })),
    validationResult: jest.fn((_req) => {
      if (mockValidationResult) {
        return mockValidationResult;
      }
      return {
        isEmpty: jest.fn(() => true),
        array: jest.fn(() => []),
      };
    }),
  };
});

describe('Reviews API', () => {
  let app: express.Application;
  let prisma: any;
  let invalidateCacheRemote: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  // Valid UUIDs for testing
  const validDocumentId = '550e8400-e29b-41d4-a716-446655440000';
  const validReviewTaskId = '550e8400-e29b-41d4-a716-446655440001';
  const validUserId = '550e8400-e29b-41d4-a716-446655440002';
  const validDocumentId2 = '550e8400-e29b-41d4-a716-446655440003';
  const validDocumentId3 = '550e8400-e29b-41d4-a716-446655440004';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/reviews', reviewsRouter);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    prisma = require('../../lib/prisma').prisma;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const documentServiceClient = require('../../clients/documentServiceClient');
    invalidateCacheRemote = documentServiceClient.invalidateCacheRemote;

    // Reset validation result mock
    mockValidationResult = {
      isEmpty: jest.fn(() => true),
      array: jest.fn(() => []),
    };

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

  describe('GET /api/reviews/dashboard', () => {
    it('should return dashboard data with upcoming, overdue, and recently reviewed documents', async () => {
      // Arrange
      const now = new Date();
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(now.getDate() + 30);
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);

      const upcomingDoc = {
        id: validDocumentId,
        title: 'Upcoming Document',
        version: '1.0',
        type: 'POLICY',
        status: 'APPROVED',
        nextReviewDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        lastReviewDate: null,
        updatedAt: new Date(),
        owner: {
          id: validUserId,
          displayName: 'Owner 1',
          email: 'owner1@paythru.com',
        },
      };

      const overdueDoc = {
        id: validDocumentId2,
        title: 'Overdue Document',
        version: '1.0',
        type: 'PROCEDURE',
        status: 'APPROVED',
        nextReviewDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        lastReviewDate: null,
        updatedAt: new Date(),
        owner: {
          id: validUserId,
          displayName: 'Owner 2',
          email: 'owner2@paythru.com',
        },
      };

      const needsReviewDateDoc = {
        id: validDocumentId3,
        title: 'No Review Date',
        version: '1.0',
        type: 'GUIDELINE',
        status: 'APPROVED',
        nextReviewDate: null,
        lastReviewDate: null,
        updatedAt: new Date(),
        owner: {
          id: validUserId,
          displayName: 'Owner 3',
          email: 'owner3@paythru.com',
        },
      };

      const recentlyReviewedDoc = {
        id: validDocumentId,
        title: 'Recently Reviewed',
        version: '1.0',
        type: 'POLICY',
        status: 'APPROVED',
        nextReviewDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        lastReviewDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        updatedAt: new Date(),
        owner: {
          id: validUserId,
          displayName: 'Owner 4',
          email: 'owner4@paythru.com',
        },
      };

      prisma.document.findMany
        .mockResolvedValueOnce([upcomingDoc]) // Upcoming documents
        .mockResolvedValueOnce([overdueDoc]) // Overdue documents
        .mockResolvedValueOnce([needsReviewDateDoc]) // Needs review date
        .mockResolvedValueOnce([recentlyReviewedDoc]); // Recently reviewed

      // Act
      const response = await request(app)
        .get('/api/reviews/dashboard')
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('upcomingDocuments');
      expect(response.body).toHaveProperty('overdueDocuments');
      expect(response.body).toHaveProperty('needsReviewDate');
      expect(response.body).toHaveProperty('recentlyReviewedDocuments');
      expect(response.body).toHaveProperty('overdueItems');
      expect(response.body).toHaveProperty('documentsNeedingReview');

      expect(response.body.upcomingDocuments).toHaveLength(1);
      expect(response.body.upcomingDocuments[0].title).toBe('Upcoming Document');

      expect(response.body.overdueDocuments).toHaveLength(1);
      expect(response.body.overdueDocuments[0].title).toBe('Overdue Document');

      expect(response.body.needsReviewDate).toHaveLength(1);
      expect(response.body.needsReviewDate[0].title).toBe('No Review Date');

      expect(response.body.recentlyReviewedDocuments).toHaveLength(1);
      expect(response.body.recentlyReviewedDocuments[0].title).toBe('Recently Reviewed');

      expect(response.body.overdueItems).toHaveLength(1);
      expect(response.body.overdueItems[0].type).toBe('DOCUMENT');
      expect(response.body.overdueItems[0].documentId).toBe(validDocumentId2);
      expect(response.body.overdueItems[0].daysOverdue).toBeGreaterThan(0);
    });

    it('should return empty arrays when no documents match criteria', async () => {
      // Arrange
      prisma.document.findMany
        .mockResolvedValueOnce([]) // Upcoming
        .mockResolvedValueOnce([]) // Overdue
        .mockResolvedValueOnce([]) // Needs review date
        .mockResolvedValueOnce([]); // Recently reviewed

      // Act
      const response = await request(app)
        .get('/api/reviews/dashboard')
        .expect(200);

      // Assert
      expect(response.body.upcomingDocuments).toEqual([]);
      expect(response.body.overdueDocuments).toEqual([]);
      expect(response.body.needsReviewDate).toEqual([]);
      expect(response.body.recentlyReviewedDocuments).toEqual([]);
      expect(response.body.overdueItems).toEqual([]);
    });

    it('should sort overdue items by days overdue (most overdue first)', async () => {
      // Arrange
      const now = new Date();
      const doc1 = {
        id: validDocumentId,
        title: 'Very Overdue',
        version: '1.0',
        type: 'POLICY',
        status: 'APPROVED',
        nextReviewDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        lastReviewDate: null,
        updatedAt: new Date(),
        owner: mockUsers.admin(),
      };

      const doc2 = {
        id: validDocumentId2,
        title: 'Slightly Overdue',
        version: '1.0',
        type: 'POLICY',
        status: 'APPROVED',
        nextReviewDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        lastReviewDate: null,
        updatedAt: new Date(),
        owner: mockUsers.editor(),
      };

      prisma.document.findMany
        .mockResolvedValueOnce([]) // Upcoming
        .mockResolvedValueOnce([doc1, doc2]) // Overdue
        .mockResolvedValueOnce([]) // Needs review date
        .mockResolvedValueOnce([]); // Recently reviewed

      // Act
      const response = await request(app)
        .get('/api/reviews/dashboard')
        .expect(200);

      // Assert
      expect(response.body.overdueItems).toHaveLength(2);
      expect(response.body.overdueItems[0].daysOverdue).toBeGreaterThan(
        response.body.overdueItems[1].daysOverdue
      );
      expect(response.body.overdueItems[0].document.title).toBe('Very Overdue');
    });

    it('should handle overdue items with null reviewDate when sorting', async () => {
      // Arrange - test branch coverage for null reviewDate
      const now = new Date();
      const doc1 = {
        id: validDocumentId,
        title: 'Overdue with null date',
        version: '1.0',
        type: 'POLICY',
        status: 'APPROVED',
        nextReviewDate: null, // null date
        lastReviewDate: null,
        updatedAt: new Date(),
        owner: mockUsers.admin(),
      };

      const doc2 = {
        id: validDocumentId2,
        title: 'Overdue with date',
        version: '1.0',
        type: 'POLICY',
        status: 'APPROVED',
        nextReviewDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        lastReviewDate: null,
        updatedAt: new Date(),
        owner: mockUsers.editor(),
      };

      prisma.document.findMany
        .mockResolvedValueOnce([]) // Upcoming
        .mockResolvedValueOnce([doc1, doc2]) // Overdue
        .mockResolvedValueOnce([]) // Needs review date
        .mockResolvedValueOnce([]); // Recently reviewed

      // Act
      const response = await request(app)
        .get('/api/reviews/dashboard')
        .expect(200);

      // Assert
      expect(response.body.overdueItems).toHaveLength(2);
      // Items with null dates should be sorted correctly (using 0 as fallback)
      expect(response.body.overdueItems[0].daysOverdue).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      prisma.document.findMany.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .get('/api/reviews/dashboard')
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to fetch review dashboard');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching review dashboard:',
        expect.any(Error)
      );
    });

    it('should include backward compatibility fields', async () => {
      // Arrange
      prisma.document.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Act
      const response = await request(app)
        .get('/api/reviews/dashboard')
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('upcomingReviews', []);
      expect(response.body).toHaveProperty('overdueReviews', []);
      expect(response.body).toHaveProperty('recentlyCompletedReviews', []);
      expect(response.body).toHaveProperty('documentsNeedingReview');
    });
  });

  describe('POST /api/reviews', () => {
    it('should create a review task with valid data', async () => {
      // Arrange
      const mockDocument = {
        id: validDocumentId,
        title: 'Test Document',
        version: '1.0',
        nextReviewDate: new Date(),
      };

      const mockReviewer = createMockUser({ role: 'EDITOR' });
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const mockReviewTask = {
        id: validReviewTaskId,
        documentId: validDocumentId,
        reviewerUserId: mockReviewer.id,
        dueDate,
        changeNotes: 'Initial review',
        status: 'PENDING',
        updatedAt: new Date(),
        reviewer: {
          id: mockReviewer.id,
          displayName: mockReviewer.displayName,
          email: mockReviewer.email,
        },
        document: {
          id: mockDocument.id,
          title: mockDocument.title,
          version: mockDocument.version,
        },
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.reviewTask.create.mockResolvedValue(mockReviewTask);

      // Act
      const response = await request(app)
        .post('/api/reviews')
        .send({
          documentId: validDocumentId,
        reviewerUserId: mockReviewer.id,
          dueDate: dueDate.toISOString(),
          changeNotes: 'Initial review',
        })
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        id: validReviewTaskId,
        documentId: validDocumentId,
        reviewerUserId: mockReviewer.id,
        status: 'PENDING',
      });
      expect(prisma.reviewTask.create).toHaveBeenCalled();
    });

    it('should set status to OVERDUE when due date is in the past', async () => {
      // Arrange
      const mockDocument = {
        id: validDocumentId,
        title: 'Test Document',
        version: '1.0',
        nextReviewDate: new Date(),
      };

      const mockReviewer = createMockUser();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const mockReviewTask = {
        id: validReviewTaskId,
        documentId: validDocumentId,
        reviewerUserId: mockReviewer.id,
        dueDate: pastDate,
        status: 'OVERDUE',
        updatedAt: new Date(),
        reviewer: {
          id: mockReviewer.id,
          displayName: mockReviewer.displayName,
          email: mockReviewer.email,
        },
        document: {
          id: mockDocument.id,
          title: mockDocument.title,
          version: mockDocument.version,
        },
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.reviewTask.create.mockResolvedValue(mockReviewTask);

      // Act
      const response = await request(app)
        .post('/api/reviews')
        .send({
          documentId: validDocumentId,
        reviewerUserId: mockReviewer.id,
          dueDate: pastDate.toISOString(),
        })
        .expect(201);

      // Assert
      expect(response.body.status).toBe('OVERDUE');
      expect(prisma.reviewTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'OVERDUE',
          }),
        })
      );
    });

    it('should update document nextReviewDate when it is missing', async () => {
      // Arrange
      const mockDocument = {
        id: validDocumentId,
        title: 'Test Document',
        version: '1.0',
        nextReviewDate: null,
      };

      const mockReviewer = createMockUser();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const mockReviewTask = {
        id: validReviewTaskId,
        documentId: validDocumentId,
        reviewerUserId: mockReviewer.id,
        dueDate,
        status: 'PENDING',
        updatedAt: new Date(),
        reviewer: {
          id: mockReviewer.id,
          displayName: mockReviewer.displayName,
          email: mockReviewer.email,
        },
        document: {
          id: mockDocument.id,
          title: mockDocument.title,
          version: mockDocument.version,
        },
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.document.update.mockResolvedValue({ ...mockDocument, nextReviewDate: dueDate });
      prisma.reviewTask.create.mockResolvedValue(mockReviewTask);

      // Act
      await request(app)
        .post('/api/reviews')
        .send({
          documentId: validDocumentId,
        reviewerUserId: mockReviewer.id,
          dueDate: dueDate.toISOString(),
        })
        .expect(201);

      // Assert
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: validDocumentId },
        data: { nextReviewDate: expect.any(Date) },
      });
    });

    it('should not update document nextReviewDate when it already exists', async () => {
      // Arrange
      const existingReviewDate = new Date();
      existingReviewDate.setDate(existingReviewDate.getDate() + 60);
      const mockDocument = {
        id: validDocumentId,
        title: 'Test Document',
        version: '1.0',
        nextReviewDate: existingReviewDate,
      };

      const mockReviewer = createMockUser();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const mockReviewTask = {
        id: validReviewTaskId,
        documentId: validDocumentId,
        reviewerUserId: mockReviewer.id,
        dueDate,
        status: 'PENDING',
        updatedAt: new Date(),
        reviewer: {
          id: mockReviewer.id,
          displayName: mockReviewer.displayName,
          email: mockReviewer.email,
        },
        document: {
          id: mockDocument.id,
          title: mockDocument.title,
          version: mockDocument.version,
        },
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.reviewTask.create.mockResolvedValue(mockReviewTask);

      // Act
      await request(app)
        .post('/api/reviews')
        .send({
          documentId: validDocumentId,
        reviewerUserId: mockReviewer.id,
          dueDate: dueDate.toISOString(),
        })
        .expect(201);

      // Assert
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it('should return 404 when document does not exist', async () => {
      // Arrange
      prisma.document.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post('/api/reviews')
        .send({
          documentId: '550e8400-e29b-41d4-a716-446655440999',
          reviewerUserId: validUserId,
          dueDate: new Date().toISOString(),
        })
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error', 'Document not found');
      expect(prisma.reviewTask.create).not.toHaveBeenCalled();
    });

    it('should return 400 when documentId is missing', async () => {
      // Arrange
      mockValidationResult = {
        isEmpty: jest.fn(() => false),
        array: jest.fn(() => [{ msg: 'documentId is required' }]),
      };

      // Act
      const response = await request(app)
        .post('/api/reviews')
        .send({
          reviewerUserId: '550e8400-e29b-41d4-a716-446655440000',
          dueDate: new Date().toISOString(),
        })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 when documentId is explicitly null or empty', async () => {
      // Arrange - test the explicit documentId check (line 182-183)
      // This tests the branch where documentId is falsy even after validation
      mockValidationResult = {
        isEmpty: jest.fn(() => true),
        array: jest.fn(() => []),
      };

      // Act - send null documentId to trigger the explicit check
      const response = await request(app)
        .post('/api/reviews')
        .send({
          documentId: null,
          reviewerUserId: validUserId,
          dueDate: new Date().toISOString(),
        })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('error', 'documentId must be provided');
    });

    it('should handle database errors when creating review task', async () => {
      // Arrange
      const mockDocument = {
        id: validDocumentId,
        title: 'Test Document',
        version: '1.0',
        nextReviewDate: new Date(),
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.reviewTask.create.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .post('/api/reviews')
        .send({
          documentId: validDocumentId,
        reviewerUserId: validUserId,
          dueDate: new Date().toISOString(),
        })
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to create review task');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error creating review task:',
        expect.any(Error)
      );
    });
  });

  describe('PUT /api/reviews/:id/complete', () => {
    it('should complete a review task and update document dates', async () => {
      // Arrange
      const completedDate = new Date();
      const mockDocument = {
        id: validDocumentId,
        title: 'Test Document',
        version: '1.0',
        nextReviewDate: new Date(),
        lastReviewDate: null,
      };

      const mockReviewTask = {
        id: validReviewTaskId,
        documentId: validDocumentId,
        reviewerUserId: validUserId,
        dueDate: new Date(),
        status: 'PENDING',
        completedDate: null,
        changeNotes: null,
        document: mockDocument,
      };

      const mockReviewer = createMockUser();
      const updatedReviewTask = {
        ...mockReviewTask,
        status: 'COMPLETED',
        completedDate,
        changeNotes: 'Review completed',
        reviewer: {
          id: mockReviewer.id,
          displayName: mockReviewer.displayName,
          email: mockReviewer.email,
        },
        document: {
          id: mockDocument.id,
          title: mockDocument.title,
          version: mockDocument.version,
        },
      };

      const nextReviewDate = new Date(completedDate);
      nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);

      prisma.reviewTask.findUnique.mockResolvedValue(mockReviewTask);
      prisma.reviewTask.update.mockResolvedValue(updatedReviewTask);
      prisma.document.update.mockResolvedValue({
        ...mockDocument,
        lastReviewDate: completedDate,
        nextReviewDate,
      });

      // Act
      const response = await request(app)
        .put(`/api/reviews/${validReviewTaskId}/complete`)
        .send({
          completedDate: completedDate.toISOString(),
          changeNotes: 'Review completed',
        })
        .expect(200);

      // Assert
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.completedDate).toBeDefined();
      expect(response.body.changeNotes).toBe('Review completed');

      expect(prisma.reviewTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: validReviewTaskId },
          data: expect.objectContaining({
            status: 'COMPLETED',
            completedDate: expect.any(Date),
            changeNotes: 'Review completed',
          }),
        })
      );

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: validDocumentId },
        data: {
          lastReviewDate: expect.any(Date),
          nextReviewDate: expect.any(Date),
        },
      });

      // Verify nextReviewDate is 1 year from completedDate
      const updateCall = prisma.document.update.mock.calls[0];
      const nextReviewDateArg = updateCall[0].data.nextReviewDate;
      expect(nextReviewDateArg.getFullYear()).toBe(completedDate.getFullYear() + 1);
    });

    it('should use current date when completedDate is not provided', async () => {
      // Arrange
      const mockDocument = {
        id: validDocumentId,
        title: 'Test Document',
        version: '1.0',
        nextReviewDate: new Date(),
        lastReviewDate: null,
      };

      const mockReviewTask = {
        id: validReviewTaskId,
        documentId: validDocumentId,
        reviewerUserId: validUserId,
        dueDate: new Date(),
        status: 'PENDING',
        completedDate: null,
        changeNotes: null,
        document: mockDocument,
      };

      const mockReviewer = createMockUser();
      const updatedReviewTask = {
        ...mockReviewTask,
        status: 'COMPLETED',
        completedDate: new Date(),
        reviewer: {
          id: mockReviewer.id,
          displayName: mockReviewer.displayName,
          email: mockReviewer.email,
        },
        document: {
          id: mockDocument.id,
          title: mockDocument.title,
          version: mockDocument.version,
        },
      };

      prisma.reviewTask.findUnique.mockResolvedValue(mockReviewTask);
      prisma.reviewTask.update.mockResolvedValue(updatedReviewTask);
      prisma.document.update.mockResolvedValue(mockDocument);

      // Act
      await request(app)
        .put(`/api/reviews/${validReviewTaskId}/complete`)
        .send({})
        .expect(200);

      // Assert
      expect(prisma.reviewTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completedDate: expect.any(Date),
          }),
        })
      );
    });

    it('should invalidate PDF cache when completing review', async () => {
      // Arrange
      const completedDate = new Date();
      const mockDocument = {
        id: validDocumentId,
        title: 'Test Document',
        version: '1.0',
        nextReviewDate: new Date(),
        lastReviewDate: null,
      };

      const mockReviewTask = {
        id: validReviewTaskId,
        documentId: validDocumentId,
        reviewerUserId: validUserId,
        dueDate: new Date(),
        status: 'PENDING',
        completedDate: null,
        changeNotes: null,
        document: mockDocument,
      };

      const mockReviewer = createMockUser();
      const updatedReviewTask = {
        ...mockReviewTask,
        status: 'COMPLETED',
        completedDate,
        reviewer: {
          id: mockReviewer.id,
          displayName: mockReviewer.displayName,
          email: mockReviewer.email,
        },
        document: {
          id: mockDocument.id,
          title: mockDocument.title,
          version: mockDocument.version,
        },
      };

      prisma.reviewTask.findUnique.mockResolvedValue(mockReviewTask);
      prisma.reviewTask.update.mockResolvedValue(updatedReviewTask);
      prisma.document.update.mockResolvedValue(mockDocument);

      // Act
      await request(app)
        .put(`/api/reviews/${validReviewTaskId}/complete`)
        .send({
          completedDate: completedDate.toISOString(),
        })
        .expect(200);

      // Assert
      // Wait a bit for async cache invalidation
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(invalidateCacheRemote).toHaveBeenCalledWith(validDocumentId);
    });

    it('should handle cache invalidation errors gracefully', async () => {
      // Arrange
      const completedDate = new Date();
      const mockDocument = {
        id: validDocumentId,
        title: 'Test Document',
        version: '1.0',
        nextReviewDate: new Date(),
        lastReviewDate: null,
      };

      const mockReviewTask = {
        id: validReviewTaskId,
        documentId: validDocumentId,
        reviewerUserId: validUserId,
        dueDate: new Date(),
        status: 'PENDING',
        completedDate: null,
        changeNotes: null,
        document: mockDocument,
      };

      const mockReviewer = createMockUser();
      const updatedReviewTask = {
        ...mockReviewTask,
        status: 'COMPLETED',
        completedDate,
        reviewer: {
          id: mockReviewer.id,
          displayName: mockReviewer.displayName,
          email: mockReviewer.email,
        },
        document: {
          id: mockDocument.id,
          title: mockDocument.title,
          version: mockDocument.version,
        },
      };

      invalidateCacheRemote.mockRejectedValue(new Error('Cache error'));

      prisma.reviewTask.findUnique.mockResolvedValue(mockReviewTask);
      prisma.reviewTask.update.mockResolvedValue(updatedReviewTask);
      prisma.document.update.mockResolvedValue(mockDocument);

      // Act
      const response = await request(app)
        .put(`/api/reviews/${validReviewTaskId}/complete`)
        .send({
          completedDate: completedDate.toISOString(),
        })
        .expect(200);

      // Assert - should still succeed even if cache invalidation fails
      expect(response.body.status).toBe('COMPLETED');
      // Wait a bit for async error handling
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Review Complete] Error invalidating PDF cache:',
        expect.any(Error)
      );
    });

    it('should return 404 when review task does not exist', async () => {
      // Arrange
      prisma.reviewTask.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put('/api/reviews/non-existent/complete')
        .send({
          completedDate: new Date().toISOString(),
        })
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error', 'Review task not found');
      expect(prisma.reviewTask.update).not.toHaveBeenCalled();
    });

    it('should handle Prisma P2025 error (record not found)', async () => {
      // Arrange
      const mockDocument = {
        id: validDocumentId,
        title: 'Test Document',
        version: '1.0',
        nextReviewDate: new Date(),
        lastReviewDate: null,
      };

      const mockReviewTask = {
        id: validReviewTaskId,
        documentId: validDocumentId,
        reviewerUserId: validUserId,
        dueDate: new Date(),
        status: 'PENDING',
        completedDate: null,
        changeNotes: null,
        document: mockDocument,
      };

      prisma.reviewTask.findUnique.mockResolvedValue(mockReviewTask);
      const prismaError: any = new Error('Record not found');
      prismaError.code = 'P2025';
      prisma.reviewTask.update.mockRejectedValue(prismaError);

      // Act
      const response = await request(app)
        .put(`/api/reviews/${validReviewTaskId}/complete`)
        .send({
          completedDate: new Date().toISOString(),
        })
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error', 'Review task not found');
    });

    it('should handle database errors when completing review', async () => {
      // Arrange
      const mockDocument = {
        id: validDocumentId,
        title: 'Test Document',
        version: '1.0',
        nextReviewDate: new Date(),
        lastReviewDate: null,
      };

      const mockReviewTask = {
        id: validReviewTaskId,
        documentId: validDocumentId,
        reviewerUserId: validUserId,
        dueDate: new Date(),
        status: 'PENDING',
        completedDate: null,
        changeNotes: null,
        document: mockDocument,
      };

      prisma.reviewTask.findUnique.mockResolvedValue(mockReviewTask);
      prisma.reviewTask.update.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .put(`/api/reviews/${validReviewTaskId}/complete`)
        .send({
          completedDate: new Date().toISOString(),
        })
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to complete review task');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error completing review task:',
        expect.any(Error)
      );
    });

    it('should not update document when review task has no documentId', async () => {
      // Arrange
      const completedDate = new Date();
      const mockReviewTask = {
        id: validReviewTaskId,
        documentId: null,
        reviewerUserId: validUserId,
        dueDate: new Date(),
        status: 'PENDING',
        completedDate: null,
        changeNotes: null,
        document: null,
      };

      const mockReviewer = createMockUser();
      const updatedReviewTask = {
        ...mockReviewTask,
        status: 'COMPLETED',
        completedDate,
        reviewer: {
          id: mockReviewer.id,
          displayName: mockReviewer.displayName,
          email: mockReviewer.email,
        },
      };

      prisma.reviewTask.findUnique.mockResolvedValue(mockReviewTask);
      prisma.reviewTask.update.mockResolvedValue(updatedReviewTask);

      // Act
      await request(app)
        .put(`/api/reviews/${validReviewTaskId}/complete`)
        .send({
          completedDate: completedDate.toISOString(),
        })
        .expect(200);

      // Assert
      expect(prisma.document.update).not.toHaveBeenCalled();
      expect(invalidateCacheRemote).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/reviews/document/:documentId', () => {
    it('should return review history for a document', async () => {
      // Arrange
      const mockReviewer = createMockUser();
      const mockReviewTasks = [
        {
          id: validReviewTaskId,
          documentId: validDocumentId,
          reviewerUserId: mockReviewer.id,
          dueDate: new Date(),
          status: 'COMPLETED',
          completedDate: new Date(),
          changeNotes: 'First review',
          createdAt: new Date(),
          reviewer: {
            id: mockReviewer.id,
            displayName: mockReviewer.displayName,
            email: mockReviewer.email,
          },
        },
        {
          id: validReviewTaskId + '-2',
          documentId: validDocumentId,
          reviewerUserId: mockReviewer.id,
          dueDate: new Date(),
          status: 'PENDING',
          completedDate: null,
          changeNotes: null,
          createdAt: new Date(),
          reviewer: {
            id: mockReviewer.id,
            displayName: mockReviewer.displayName,
            email: mockReviewer.email,
          },
        },
      ];

      prisma.reviewTask.findMany.mockResolvedValue(mockReviewTasks);

      // Act
      const response = await request(app)
        .get(`/api/reviews/document/${validDocumentId}`)
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(2);
      expect(response.body[0].id).toBe(validReviewTaskId);
      expect(response.body[0].status).toBe('COMPLETED');
      expect(response.body[1].id).toBe(validReviewTaskId + '-2');
      expect(response.body[1].status).toBe('PENDING');

      expect(prisma.reviewTask.findMany).toHaveBeenCalledWith({
        where: { documentId: validDocumentId },
        include: {
          reviewer: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should return empty array when document has no review history', async () => {
      // Arrange
      prisma.reviewTask.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get(`/api/reviews/document/${validDocumentId}`)
        .expect(200);

      // Assert
      expect(response.body).toEqual([]);
    });

    it('should handle database errors when fetching review history', async () => {
      // Arrange
      prisma.reviewTask.findMany.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .get(`/api/reviews/document/${validDocumentId}`)
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to fetch review history');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching review history:',
        expect.any(Error)
      );
    });
  });

  describe('POST /api/reviews/bulk-set-review-date', () => {
    it('should bulk set review dates for multiple documents', async () => {
      // Arrange
      const reviewDate = new Date();
      reviewDate.setFullYear(reviewDate.getFullYear() + 1);
      const documentIds = [validDocumentId, validDocumentId2, validDocumentId3];

      prisma.document.updateMany.mockResolvedValue({ count: 3 });

      // Act
      const response = await request(app)
        .post('/api/reviews/bulk-set-review-date')
        .send({
          documentIds,
          reviewDate: reviewDate.toISOString(),
        })
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        updated: 3,
      });
      expect(response.body.reviewDate).toBeDefined();

      expect(prisma.document.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: documentIds },
          },
          data: expect.objectContaining({
            nextReviewDate: expect.any(Date),
          }),
        })
      );
    });

    it('should use default date (today + 1 year) when reviewDate is not provided', async () => {
      // Arrange
      const documentIds = [validDocumentId, validDocumentId2];
      const now = new Date();
      const expectedDate = new Date(now);
      expectedDate.setFullYear(expectedDate.getFullYear() + 1);

      prisma.document.updateMany.mockResolvedValue({ count: 2 });

      // Act
      const response = await request(app)
        .post('/api/reviews/bulk-set-review-date')
        .send({
          documentIds,
        })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(2);

      const updateCall = prisma.document.updateMany.mock.calls[0];
      const reviewDateArg = updateCall[0].data.nextReviewDate;
      expect(reviewDateArg.getFullYear()).toBe(now.getFullYear() + 1);
    });

    it('should return 400 when documentIds is empty', async () => {
      // Arrange
      mockValidationResult = {
        isEmpty: jest.fn(() => false),
        array: jest.fn(() => [{ msg: 'documentIds must be a non-empty array' }]),
      };

      // Act
      const response = await request(app)
        .post('/api/reviews/bulk-set-review-date')
        .send({
          documentIds: [],
        })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should handle database errors when bulk setting review dates', async () => {
      // Arrange
      const documentIds = [validDocumentId, validDocumentId2];
      prisma.document.updateMany.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .post('/api/reviews/bulk-set-review-date')
        .send({
          documentIds,
        })
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to bulk set review dates');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error bulk setting review dates:',
        expect.any(Error)
      );
    });

    it('should handle partial updates when some documents do not exist', async () => {
      // Arrange
      const documentIds = [validDocumentId, validDocumentId2];
      prisma.document.updateMany.mockResolvedValue({ count: 2 }); // Only 2 updated

      // Act
      const response = await request(app)
        .post('/api/reviews/bulk-set-review-date')
        .send({
          documentIds,
        })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(2);
    });
  });
});

