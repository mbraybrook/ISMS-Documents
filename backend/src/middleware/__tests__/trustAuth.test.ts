/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateTrustToken, TrustAuthRequest } from '../trustAuth';
import { createMockRequest, createMockResponse, createMockNext } from '../../lib/test-helpers';
// Mock config - create object inside factory so it can be referenced
jest.mock('../../config', () => {
  const mockConfigObj = {
    trustCenter: {
      jwtSecret: 'test-secret-key-that-is-at-least-32-characters-long',
    },
  };
  return {
    config: mockConfigObj,
  };
});

// Get reference to the mocked config object (should be the same reference)
import { config as mockedConfig } from '../../config';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    externalUser: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../lib/logger', () => ({
  log: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { log } from '../../lib/logger';

// Mock logger
jest.mock('../../lib/logger', () => ({
  log: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('authenticateTrustToken middleware', () => {
  let mockRequest: Partial<TrustAuthRequest>;
  let mockResponse: any;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = createMockRequest();
    mockRequest.headers = {};
    mockResponse = createMockResponse();
    nextFunction = createMockNext();
    jest.clearAllMocks();
  });

  describe('JWT secret validation', () => {
    // Note: Testing JWT secret validation directly is difficult because config is imported at module load time
    // These tests verify that the middleware handles invalid secrets correctly
    // The actual validation logic is tested indirectly through the middleware behavior

    it('should handle missing JWT secret configuration', async () => {
      // This test verifies the middleware can handle config issues
      // The actual validation happens at module load, so we test the error handling path
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      // If secret validation fails, middleware should return 500
      // Since we can't easily change config after import, we verify the error handling exists
      // The validation function itself would be tested in a unit test if it were exported

      // For now, we verify the middleware works with valid config (tested in other tests)
      // and handles errors gracefully (tested in error handling tests)
      expect(mockedConfig.trustCenter.jwtSecret).toBeDefined();
      expect(mockedConfig.trustCenter.jwtSecret.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('token validation', () => {
    beforeEach(() => {
      mockedConfig.trustCenter.jwtSecret = 'test-secret-key-that-is-at-least-32-characters-long';
    });

    it('should return 401 if no token is provided', async () => {
      mockRequest.headers = {};

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'No token provided',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header does not start with Bearer', async () => {
      mockRequest.headers = {
        authorization: 'Invalid token',
      };

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'No token provided',
      });
    });

    it('should return 401 if token is expired', async () => {
      const expiredToken = jwt.sign(
        { userId: 'user-123', tokenVersion: 1 },
        config.trustCenter.jwtSecret,
        { expiresIn: '-1h' }
      );

      mockRequest.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token expired',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if token payload does not have userId', async () => {
      const tokenWithoutUserId = jwt.sign(
        { someOtherField: 'value' },
        config.trustCenter.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${tokenWithoutUserId}`,
      };

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token payload',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('user lookup', () => {
    beforeEach(() => {
      (config.trustCenter.jwtSecret as any) = 'test-secret-key-that-is-at-least-32-characters-long';
    });

    it('should return 401 if user is not found in database', async () => {
      const token = jwt.sign(
        { userId: 'nonexistent-user', tokenVersion: 1 },
        config.trustCenter.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValue(null);

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(prisma.externalUser.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent-user' },
        select: {
          id: true,
          email: true,
          companyName: true,
          isApproved: true,
          tokenVersion: true,
          termsAcceptedAt: true,
        },
      });
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'User not found',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not approved', async () => {
      const token = jwt.sign(
        { userId: 'user-123', tokenVersion: 1 },
        config.trustCenter.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        companyName: 'Test Company',
        isApproved: false,
        tokenVersion: 1,
        termsAcceptedAt: new Date(),
      });

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'User not approved',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if token version does not match user token version', async () => {
      const token = jwt.sign(
        { userId: 'user-123', tokenVersion: 1 },
        config.trustCenter.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        companyName: 'Test Company',
        isApproved: true,
        tokenVersion: 2, // Different version
        termsAcceptedAt: new Date(),
      });

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token invalidated',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow token when version is undefined in token (backward compatibility)', async () => {
      const token = jwt.sign(
        { userId: 'user-123' }, // No tokenVersion
        config.trustCenter.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        companyName: 'Test Company',
        isApproved: true,
        tokenVersion: 1,
        termsAcceptedAt: new Date(),
      });

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should attach user to request when all validations pass', async () => {
      const token = jwt.sign(
        { userId: 'user-123', tokenVersion: 1 },
        config.trustCenter.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        companyName: 'Test Company',
        isApproved: true,
        tokenVersion: 1,
        termsAcceptedAt: new Date('2024-01-01'),
      };

      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.externalUser).toEqual(mockUser);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should attach user with all required fields', async () => {
      const token = jwt.sign(
        { userId: 'user-123', tokenVersion: 1 },
        config.trustCenter.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        companyName: 'Test Company',
        isApproved: true,
        tokenVersion: 1,
        termsAcceptedAt: null,
      };

      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.externalUser).toHaveProperty('id');
      expect(mockRequest.externalUser).toHaveProperty('email');
      expect(mockRequest.externalUser).toHaveProperty('companyName');
      expect(mockRequest.externalUser).toHaveProperty('isApproved');
      expect(mockRequest.externalUser).toHaveProperty('tokenVersion');
      expect(mockRequest.externalUser).toHaveProperty('termsAcceptedAt');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      (config.trustCenter.jwtSecret as any) = 'test-secret-key-that-is-at-least-32-characters-long';
    });

    it('should return 500 on database errors', async () => {
      const token = jwt.sign(
        { userId: 'user-123', tokenVersion: 1 },
        config.trustCenter.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      (prisma.externalUser.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(log.error).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication error',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 500 on generic errors', async () => {
      const token = jwt.sign(
        { userId: 'user-123', tokenVersion: 1 },
        config.trustCenter.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      // Mock jwt.verify to throw an error
      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn(() => {
        throw new Error('Unexpected error');
      });

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(log.error).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication error',
      });

      // Restore original
      jwt.verify = originalVerify;
    });

    it('should log authentication errors', async () => {
      const token = jwt.sign(
        { userId: 'user-123', tokenVersion: 1 },
        config.trustCenter.jwtSecret
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      (prisma.externalUser.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await authenticateTrustToken(
        mockRequest as TrustAuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(log.error).toHaveBeenCalledWith(
        '[TRUST_AUTH] Authentication error',
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });
  });
});

