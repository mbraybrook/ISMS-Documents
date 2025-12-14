/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import { trustRouter } from '../index';
import { prisma } from '../../../lib/prisma';
import { logTrustAction } from '../../../services/trustAuditService';
import { createMockUser } from '../../../lib/test-helpers';

// Mock authentication middleware
jest.mock('../../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      sub: 'test-user',
      email: 'admin@paythru.com',
      name: 'Test Admin',
      oid: 'test-oid',
    };
    next();
  },
  AuthRequest: {} as any,
}));

// Mock authorization middleware
jest.mock('../../../middleware/authorize', () => ({
  requireRole: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock Prisma
jest.mock('../../../lib/prisma', () => ({
  prisma: {
    externalUser: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    trustAuditLog: {
      findFirst: jest.fn(),
    },
    trustDownload: {
      count: jest.fn(),
    },
  },
}));

// Mock trust audit service
jest.mock('../../../services/trustAuditService', () => ({
  logTrustAction: jest.fn().mockResolvedValue(undefined),
}));

const app = express();
app.use(express.json());
app.use('/api/trust', trustRouter);

describe('User Management Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/trust/admin/users', () => {
    it('should return all users when no filters are provided', async () => {
      const mockUsers = [
        {
          id: 'user1',
          email: 'user1@example.com',
          companyName: 'Company 1',
          isApproved: true,
          isActive: true,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'user2',
          email: 'user2@example.com',
          companyName: 'Company 2',
          isApproved: false,
          isActive: true,
          createdAt: new Date('2024-01-02'),
        },
      ];

      (prisma.externalUser.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(createMockUser({ role: 'ADMIN' }));

      const response = await request(app)
        .get('/api/trust/admin/users')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        id: 'user1',
        email: 'user1@example.com',
        companyName: 'Company 1',
        isApproved: true,
        isActive: true,
      });
    });

    it('should filter by approval status', async () => {
      const mockUsers = [
        {
          id: 'user1',
          email: 'user1@example.com',
          companyName: 'Company 1',
          isApproved: true,
          isActive: true,
          createdAt: new Date('2024-01-01'),
        },
      ];

      (prisma.externalUser.findMany as jest.Mock).mockResolvedValue(mockUsers);

      await request(app)
        .get('/api/trust/admin/users?status=approved')
        .expect(200);

      expect(prisma.externalUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isApproved: true,
          }),
        })
      );
    });

    it('should filter by active status', async () => {
      const mockUsers = [
        {
          id: 'user1',
          email: 'user1@example.com',
          companyName: 'Company 1',
          isApproved: true,
          isActive: false,
          createdAt: new Date('2024-01-01'),
        },
      ];

      (prisma.externalUser.findMany as jest.Mock).mockResolvedValue(mockUsers);

      await request(app)
        .get('/api/trust/admin/users?active=false')
        .expect(200);

      expect(prisma.externalUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: false,
          }),
        })
      );
    });

    it('should search by email or company name', async () => {
      const mockUsers = [
        {
          id: 'user1',
          email: 'user1@example.com',
          companyName: 'Company 1',
          isApproved: true,
          isActive: true,
          createdAt: new Date('2024-01-01'),
        },
      ];

      (prisma.externalUser.findMany as jest.Mock).mockResolvedValue(mockUsers);

      await request(app)
        .get('/api/trust/admin/users?search=Company')
        .expect(200);

      expect(prisma.externalUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                email: expect.objectContaining({
                  contains: 'Company',
                  mode: 'insensitive',
                }),
              }),
              expect.objectContaining({
                companyName: expect.objectContaining({
                  contains: 'Company',
                  mode: 'insensitive',
                }),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('GET /api/trust/admin/users/:userId', () => {
    it('should return user details with activity stats', async () => {
      const mockUser = {
        id: 'user1',
        email: 'user1@example.com',
        companyName: 'Company 1',
        isApproved: true,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        termsAcceptedAt: new Date('2024-01-03'),
      };

      const mockLastLogin = {
        timestamp: new Date('2024-01-10'),
      };

      const mockApprovalLog = {
        timestamp: new Date('2024-01-05'),
        performedByUserId: 'admin-id',
      };

      const mockApprover = {
        email: 'admin@paythru.com',
      };

      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.trustAuditLog.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockLastLogin) // For last login
        .mockResolvedValueOnce(mockApprovalLog); // For approval log
      (prisma.trustDownload.count as jest.Mock).mockResolvedValue(5);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockApprover);

      const response = await request(app)
        .get('/api/trust/admin/users/user1')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'user1',
        email: 'user1@example.com',
        companyName: 'Company 1',
        isApproved: true,
        isActive: true,
        totalDownloads: 5,
        approvedBy: 'admin@paythru.com',
      });
      expect(response.body.lastLoginDate).toBeDefined();
      expect(response.body.approvalDate).toBeDefined();
    });

    it('should return 404 if user not found', async () => {
      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .get('/api/trust/admin/users/nonexistent')
        .expect(404);
    });
  });

  describe('PUT /api/trust/admin/users/:userId/revoke', () => {
    it('should revoke user access and increment tokenVersion', async () => {
      const mockUser = {
        id: 'user1',
        email: 'user1@example.com',
        companyName: 'Company 1',
        tokenVersion: 1,
      };

      const mockUpdatedUser = {
        id: 'user1',
        email: 'user1@example.com',
        companyName: 'Company 1',
        isApproved: true,
        isActive: false,
        createdAt: new Date('2024-01-01'),
      };

      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.externalUser.update as jest.Mock).mockResolvedValue(mockUpdatedUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(createMockUser({ role: 'ADMIN' }));

      const response = await request(app)
        .put('/api/trust/admin/users/user1/revoke')
        .expect(200);

      expect(response.body.isActive).toBe(false);
      expect(prisma.externalUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            tokenVersion: 2, // Incremented from 1
          }),
        })
      );
      expect(logTrustAction).toHaveBeenCalledWith(
        'USER_ACCESS_REVOKED',
        expect.any(String),
        undefined,
        'user1',
        undefined,
        expect.objectContaining({
          email: 'user1@example.com',
          companyName: 'Company 1',
        }),
        expect.any(String)
      );
    });

    it('should return 404 if user not found', async () => {
      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .put('/api/trust/admin/users/nonexistent/revoke')
        .expect(404);
    });
  });

  describe('PUT /api/trust/admin/users/:userId/restore', () => {
    it('should restore user access', async () => {
      const mockUser = {
        id: 'user1',
        email: 'user1@example.com',
        companyName: 'Company 1',
      };

      const mockUpdatedUser = {
        id: 'user1',
        email: 'user1@example.com',
        companyName: 'Company 1',
        isApproved: true,
        isActive: true,
        createdAt: new Date('2024-01-01'),
      };

      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.externalUser.update as jest.Mock).mockResolvedValue(mockUpdatedUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(createMockUser({ role: 'ADMIN' }));

      const response = await request(app)
        .put('/api/trust/admin/users/user1/restore')
        .expect(200);

      expect(response.body.isActive).toBe(true);
      expect(prisma.externalUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: true,
          }),
        })
      );
      expect(logTrustAction).toHaveBeenCalledWith(
        'USER_ACCESS_RESTORED',
        expect.any(String),
        undefined,
        'user1',
        undefined,
        expect.objectContaining({
          email: 'user1@example.com',
          companyName: 'Company 1',
        }),
        expect.any(String)
      );
    });

    it('should return 404 if user not found', async () => {
      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValue(null);

      await request(app)
        .put('/api/trust/admin/users/nonexistent/restore')
        .expect(404);
    });
  });
});

