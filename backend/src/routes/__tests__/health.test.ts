import request from 'supertest';
import express from 'express';
import { healthRouter } from '../health';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    document: {
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
  },
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    databaseUrl: 'postgresql://user:password@localhost:5432/isms_db',
  },
}));

import { prisma } from '../../lib/prisma';

describe('Health API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use('/api/health', healthRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return health status with database connection success', async () => {
      // Arrange
      (prisma.document.count as jest.Mock).mockResolvedValue(10);
      (prisma.user.count as jest.Mock).mockResolvedValue(5);

      // Act
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        status: 'ok',
        message: 'ISMS Backend API is running',
        timestamp: expect.any(String),
        database: {
          connected: true,
          documentCount: 10,
          userCount: 5,
          databaseUrl: 'postgresql://user:password@localhost:5432/***',
        },
      });
      expect(prisma.document.count).toHaveBeenCalled();
      expect(prisma.user.count).toHaveBeenCalled();
    });

    it('should mask database URL path in response', async () => {
      // Arrange
      (prisma.document.count as jest.Mock).mockResolvedValue(0);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      // Act
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Assert
      expect(response.body.database.databaseUrl).toBe('postgresql://user:password@localhost:5432/***');
      expect(response.body.database.databaseUrl).not.toContain('isms_db');
    });

    it('should return error status when database connection fails', async () => {
      // Arrange
      const dbError = new Error('Connection timeout');
      (prisma.document.count as jest.Mock).mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .get('/api/health')
        .expect(500);

      // Assert
      expect(response.body).toEqual({
        status: 'error',
        message: 'Database connection failed',
        error: 'Connection timeout',
        database: {
          connected: false,
          databaseUrl: 'postgresql://user:password@localhost:5432/***',
        },
      });
    });

    it('should include timestamp in successful response', async () => {
      // Arrange
      (prisma.document.count as jest.Mock).mockResolvedValue(0);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      // Act
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Assert
      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
      expect(new Date(response.body.timestamp).getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      (prisma.document.count as jest.Mock).mockRejectedValue(new Error('Database unavailable'));

      // Act
      const response = await request(app)
        .get('/api/health')
        .expect(500);

      // Assert
      expect(response.body.status).toBe('error');
      expect(response.body.database.connected).toBe(false);
      expect(response.body.error).toBe('Database unavailable');
    });
  });
});
