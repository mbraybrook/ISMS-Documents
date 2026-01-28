/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';

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
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock dbRetry
jest.mock('../../lib/dbRetry', () => ({
  retryDbOperation: jest.fn((fn: any, _options?: any) => fn()),
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    auth: {
      allowedEmailDomain: 'paythru.com',
    },
  },
}));

import { prisma } from '../../lib/prisma';
import { retryDbOperation } from '../../lib/dbRetry';
import { authRouter } from '../auth';

describe('Auth API', () => {
  let app: express.Application;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    jest.clearAllMocks();
    // Suppress console.error and console.log during tests to avoid noise from expected error handling
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods after each test
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('POST /api/auth/sync', () => {
    // Note: Authentication/authorization edge cases (401, 403 for invalid email) are
    // tested in middleware tests. Here we focus on route handler logic with valid inputs.

    it('should create new user and assign ADMIN role if first user', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.count as jest.Mock).mockResolvedValue(0); // No existing admins
      
      const newUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'newuser@paythru.com',
        displayName: 'New User',
        role: 'ADMIN',
        entraObjectId: 'test-oid',
      };
      (prisma.user.create as jest.Mock).mockResolvedValue(newUser);

      // Act
      const response = await request(app)
        .post('/api/auth/sync')
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'newuser@paythru.com',
        displayName: 'New User',
        role: 'ADMIN',
      });
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          role: 'ADMIN',
          id: { not: '00000000-0000-0000-0000-000000000000' },
        },
      });
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should create new user and assign STAFF role if admin exists', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.count as jest.Mock).mockResolvedValue(1); // Admin exists
      
      const newUser = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'newuser@paythru.com',
        displayName: 'New User',
        role: 'STAFF',
        entraObjectId: 'test-oid',
      };
      (prisma.user.create as jest.Mock).mockResolvedValue(newUser);

      // Act
      const response = await request(app)
        .post('/api/auth/sync')
        .expect(200);

      // Assert
      expect(response.body.role).toBe('STAFF');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should find user by email and update if exists', async () => {
      // Arrange
      const existingUser = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'test@paythru.com',
        displayName: 'Old Name',
        role: 'STAFF',
        entraObjectId: 'old-oid',
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      
      const updatedUser = {
        ...existingUser,
        displayName: 'Test User',
        entraObjectId: 'test-oid',
      };
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      // Act
      const response = await request(app)
        .post('/api/auth/sync')
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'test@paythru.com',
        displayName: 'Test User',
        role: 'STAFF',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440002' },
        data: expect.objectContaining({
          displayName: 'Test User',
          entraObjectId: 'test-oid',
        }),
      });
    });

    it('should find user by Entra ID if not found by email', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      
      const userByOid = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        email: 'test@paythru.com',
        displayName: 'Test User',
        role: 'STAFF',
        entraObjectId: 'test-oid',
      };
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(userByOid);
      
      const updatedUser = {
        ...userByOid,
        displayName: 'Updated Name',
      };
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      // Act
      const response = await request(app)
        .post('/api/auth/sync')
        .expect(200);

      // Assert
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { entraObjectId: 'test-oid' },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      expect(response.body.id).toBe('550e8400-e29b-41d4-a716-446655440003');
    });

    it('should update email if user had unknown.local email', async () => {
      // Arrange
      const existingUser = {
        id: '550e8400-e29b-41d4-a716-446655440004',
        email: 'user-123@unknown.local',
        displayName: 'Test User',
        role: 'STAFF',
        entraObjectId: 'test-oid',
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      
      const updatedUser = {
        ...existingUser,
        email: 'test@paythru.com',
      };
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      // Act
      const response = await request(app)
        .post('/api/auth/sync')
        .expect(200);

      // Assert
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440004' },
        data: expect.objectContaining({
          email: 'test@paythru.com',
        }),
      });
      expect(response.body.email).toBe('test@paythru.com');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .post('/api/auth/sync')
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to sync user' });
    });

    it('should use retryDbOperation for database calls', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);
      
      const newUser = {
        id: '550e8400-e29b-41d4-a716-446655440005',
        email: 'test@paythru.com',
        displayName: 'Test User',
        role: 'ADMIN',
        entraObjectId: 'test-oid',
      };
      (prisma.user.create as jest.Mock).mockResolvedValue(newUser);

      // Act
      await request(app)
        .post('/api/auth/sync')
        .expect(200);

      // Assert
      expect(retryDbOperation).toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user profile', async () => {
      // Arrange
      const user = {
        id: '550e8400-e29b-41d4-a716-446655440006',
        email: 'test@paythru.com',
        displayName: 'Test User',
        role: 'ADMIN',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440006',
        email: 'test@paythru.com',
        displayName: 'Test User',
        role: 'ADMIN',
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@paythru.com' },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('should return 404 if user is not found', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to fetch user' });
    });

    it('should use retryDbOperation for database calls', async () => {
      // Arrange
      const user = {
        id: '550e8400-e29b-41d4-a716-446655440007',
        email: 'test@paythru.com',
        displayName: 'Test User',
        role: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      // Act
      await request(app)
        .get('/api/auth/me')
        .expect(200);

      // Assert
      expect(retryDbOperation).toHaveBeenCalled();
    });
  });
});
