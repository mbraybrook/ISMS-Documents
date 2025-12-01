import request from 'supertest';
import express from 'express';
import { acknowledgmentsRouter } from '../acknowledgments';
import { authenticateToken } from '../../middleware/auth';

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      sub: 'test-user',
      email: 'test@example.com',
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
    },
    acknowledgment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('Acknowledgments API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/acknowledgments', acknowledgmentsRouter);
  });

  describe('GET /api/acknowledgments/pending', () => {
    it('should return pending documents', async () => {
      const { prisma } = require('../../lib/prisma');
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      };
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Test Document',
          version: '2.0',
          status: 'APPROVED',
          owner: {
            id: 'owner-1',
            displayName: 'Owner',
            email: 'owner@example.com',
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
    });
  });

  describe('POST /api/acknowledgments/bulk', () => {
    it('should create bulk acknowledgments', async () => {
      const { prisma } = require('../../lib/prisma');
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      };
      const mockDocuments = [
        {
          id: 'doc-1',
          version: '2.0',
          status: 'APPROVED',
        },
      ];

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.document.findMany.mockResolvedValue(mockDocuments);
      prisma.acknowledgment.findMany.mockResolvedValue([]);
      prisma.acknowledgment.findUnique.mockResolvedValue(null);
      prisma.acknowledgment.create.mockResolvedValue({
        id: 'ack-1',
        userId: 'user-1',
        documentId: 'doc-1',
        documentVersion: '2.0',
      });

      const response = await request(app)
        .post('/api/acknowledgments/bulk')
        .send({})
        .expect(200);

      expect(response.body.acknowledged).toBeGreaterThan(0);
    });
  });
});



