import request from 'supertest';
import express from 'express';
import { documentsRouter } from '../documents';
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
    document: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('Documents API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/documents', documentsRouter);
  });

  describe('GET /api/documents', () => {
    it('should return list of documents', async () => {
      const { prisma } = require('../../lib/prisma');
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Test Document',
          type: 'POLICY',
          status: 'APPROVED',
          version: '1.0',
          owner: {
            id: 'user-1',
            displayName: 'Test Owner',
            email: 'owner@example.com',
          },
        },
      ];

      prisma.document.findMany.mockResolvedValue(mockDocuments);
      prisma.document.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/documents')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Test Document');
    });

    it('should filter by type', async () => {
      const { prisma } = require('../../lib/prisma');
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

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
  });

  describe('GET /api/documents/:id', () => {
    it('should return document details', async () => {
      const { prisma } = require('../../lib/prisma');
      const mockDocument = {
        id: 'doc-1',
        title: 'Test Document',
        type: 'POLICY',
        status: 'APPROVED',
        owner: {
          id: 'user-1',
          displayName: 'Test Owner',
        },
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);

      const response = await request(app)
        .get('/api/documents/doc-1')
        .expect(200);

      expect(response.body.title).toBe('Test Document');
    });

    it('should return 404 for non-existent document', async () => {
      const { prisma } = require('../../lib/prisma');
      prisma.document.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/api/documents/non-existent')
        .expect(404);
    });
  });
});




