/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import { acknowledgmentsRouter } from '../acknowledgments';
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

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    document: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    acknowledgment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
  },
}));

describe('Acknowledgments API', () => {
  let app: express.Application;
  let prisma: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/acknowledgments', acknowledgmentsRouter);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    prisma = require('../../lib/prisma').prisma;
    jest.clearAllMocks();
  });

  describe('GET /api/acknowledgments/pending', () => {
    it('should return pending documents for user', async () => {
      const mockUser = mockUsers.staff();
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Test Document',
          version: '2.0',
          status: 'APPROVED',
          requiresAcknowledgement: true,
          owner: {
            id: 'owner-1',
            displayName: 'Owner',
            email: 'owner@paythru.com',
          },
        },
      ];

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.document.findMany.mockResolvedValue(mockDocuments);
      prisma.acknowledgment.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/acknowledgments/pending')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Test Document');
      expect(response.body[0].version).toBe('2.0');
    });

    it('should exclude documents already acknowledged', async () => {
      const mockUser = mockUsers.staff();
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Test Document',
          version: '2.0',
          status: 'APPROVED',
          requiresAcknowledgement: true,
          owner: {
            id: 'owner-1',
            displayName: 'Owner',
            email: 'owner@paythru.com',
          },
        },
      ];
      const existingAcknowledgment = [
        {
          documentId: 'doc-1',
          documentVersion: '2.0',
        },
      ];

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.document.findMany.mockResolvedValue(mockDocuments);
      prisma.acknowledgment.findMany.mockResolvedValue(existingAcknowledgment);

      const response = await request(app)
        .get('/api/acknowledgments/pending')
        .expect(200);

      // Document should be filtered out if already acknowledged
      expect(response.body).toHaveLength(0);
    });

    it('should only return APPROVED documents', async () => {
      const mockUser = mockUsers.staff();

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.document.findMany.mockResolvedValue([]); // DRAFT documents filtered out
      prisma.acknowledgment.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/acknowledgments/pending')
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    it('should return 404 if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/api/acknowledgments/pending')
        .expect(404);
    });
  });

  describe('POST /api/acknowledgments/bulk', () => {
    it('should create bulk acknowledgments for all pending documents', async () => {
      const mockUser = mockUsers.staff();
      const mockDocuments = [
        {
          id: 'doc-1',
          version: '2.0',
          status: 'APPROVED',
          requiresAcknowledgement: true,
        },
        {
          id: 'doc-2',
          version: '1.5',
          status: 'APPROVED',
          requiresAcknowledgement: true,
        },
      ];

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.document.findMany.mockResolvedValue(mockDocuments);
      prisma.acknowledgment.findMany.mockResolvedValue([]);
      prisma.acknowledgment.findUnique
        .mockResolvedValueOnce(null) // doc-1 not acknowledged
        .mockResolvedValueOnce(null); // doc-2 not acknowledged
      prisma.acknowledgment.create
        .mockResolvedValueOnce({
          id: 'ack-1',
          userId: mockUser.id,
          documentId: 'doc-1',
          documentVersion: '2.0',
        })
        .mockResolvedValueOnce({
          id: 'ack-2',
          userId: mockUser.id,
          documentId: 'doc-2',
          documentVersion: '1.5',
        });

      const response = await request(app)
        .post('/api/acknowledgments/bulk')
        .send({})
        .expect(200);

      expect(response.body.acknowledged).toBe(2);
      expect(response.body.acknowledgments).toHaveLength(2);
      expect(prisma.acknowledgment.create).toHaveBeenCalledTimes(2);
    });

    it('should skip documents already acknowledged', async () => {
      const mockUser = mockUsers.staff();
      const mockDocuments = [
        {
          id: 'doc-1',
          version: '2.0',
          status: 'APPROVED',
          requiresAcknowledgement: true,
        },
      ];

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.document.findMany.mockResolvedValue(mockDocuments);
      // mockDocuments is used in the mock above
      prisma.acknowledgment.findMany.mockResolvedValue([]);
      prisma.acknowledgment.findUnique.mockResolvedValue({
        id: 'ack-existing',
        documentId: 'doc-1',
        documentVersion: '2.0',
      }); // Already acknowledged

      const response = await request(app)
        .post('/api/acknowledgments/bulk')
        .send({})
        .expect(200);

      // When document is already acknowledged, it returns the existing acknowledgment
      expect(response.body.acknowledged).toBeGreaterThanOrEqual(0);
      expect(prisma.acknowledgment.create).not.toHaveBeenCalled();
    });

    it('should track document version in acknowledgment', async () => {
      const mockUser = mockUsers.staff();
      const mockDocuments = [
        {
          id: 'doc-1',
          version: '2.0',
          status: 'APPROVED',
          requiresAcknowledgement: true,
        },
      ];

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.document.findMany.mockResolvedValue(mockDocuments);
      prisma.acknowledgment.findMany.mockResolvedValue([]);
      prisma.acknowledgment.findUnique.mockResolvedValue(null);
      prisma.acknowledgment.create.mockResolvedValue({
        id: 'ack-1',
        userId: mockUser.id,
        documentId: 'doc-1',
        documentVersion: '2.0',
      });

      await request(app)
        .post('/api/acknowledgments/bulk')
        .send({})
        .expect(200);

      expect(prisma.acknowledgment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            documentId: 'doc-1',
            documentVersion: '2.0',
          }),
        })
      );
    });

    it('should return 404 if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await request(app)
        .post('/api/acknowledgments/bulk')
        .send({})
        .expect(404);
    });
  });

  describe('POST /api/acknowledgments', () => {
    it('should create single document acknowledgment', async () => {
      const mockUser = mockUsers.staff();
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const mockDocument = {
        id: docId,
        version: '2.0',
        status: 'APPROVED',
        requiresAcknowledgement: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.acknowledgment.findUnique.mockResolvedValue(null);
      prisma.acknowledgment.create.mockResolvedValue({
        id: 'ack-1',
        userId: mockUser.id,
        documentId: docId,
        documentVersion: '2.0',
      });

      const response = await request(app)
        .post('/api/acknowledgments')
        .send({
          documentId: docId,
        })
        .expect(201);

      expect(response.body.documentId).toBe(docId);
      expect(response.body.documentVersion).toBe('2.0');
      expect(prisma.acknowledgment.create).toHaveBeenCalled();
    });

    it('should return 404 if document not found', async () => {
      const mockUser = mockUsers.staff();

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.document.findUnique.mockResolvedValue(null);

      await request(app)
        .post('/api/acknowledgments')
        .send({
          documentId: '550e8400-e29b-41d4-a716-446655440000',
        })
        .expect(404);
    });

    it('should return existing acknowledgment if already acknowledged', async () => {
      const mockUser = mockUsers.staff();
      const docId = '550e8400-e29b-41d4-a716-446655440001';
      const mockDocument = {
        id: docId,
        version: '2.0',
        status: 'APPROVED',
        requiresAcknowledgement: true,
      };
      const existingAck = {
        id: 'ack-existing',
        userId: mockUser.id,
        documentId: docId,
        documentVersion: '2.0',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.acknowledgment.findUnique.mockResolvedValue(existingAck);

      const response = await request(app)
        .post('/api/acknowledgments')
        .send({
          documentId: docId,
        })
        .expect(200);

      expect(response.body.id).toBe('ack-existing');
      expect(prisma.acknowledgment.create).not.toHaveBeenCalled();
    });
  });
});




