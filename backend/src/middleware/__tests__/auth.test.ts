/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { authenticateToken, AuthRequest } from '../auth';
import { createMockRequest, createMockResponse, createMockNext } from '../../lib/test-helpers';
import { config } from '../../config';
import { log } from '../../lib/logger';

// Mock jwks-rsa
jest.mock('jwks-rsa', () => {
  return jest.fn(() => ({
    getSigningKey: jest.fn(),
  }));
});

// Mock config
jest.mock('../../config', () => ({
  config: {
    auth: {
      tenantId: '12345678-1234-1234-1234-123456789012', // Valid GUID format
      clientId: 'test-client-id',
      allowedEmailDomain: 'paythru.com',
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

describe('authenticateToken middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: any;
  let nextFunction: NextFunction;
  let mockJwksClient: any;

  beforeEach(() => {
    mockRequest = createMockRequest();
    mockRequest.headers = {};
    mockResponse = createMockResponse();
    nextFunction = createMockNext();
    jest.clearAllMocks();

    // Get the mock jwks client instance
    // const jwksRsa = require('jwks-rsa');
    const clientInstance = (jwksRsa as any)({});
    mockJwksClient = clientInstance;
    (clientInstance.getSigningKey as jest.Mock).mockClear();
  });

  describe('token validation - no token', () => {
    it('should return 401 if no token is provided', async () => {
      mockRequest.headers = {};

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(log.debug).toHaveBeenCalledWith('[AUTH] No token provided in request');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'No token provided',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header is missing', async () => {
      mockRequest.headers = { authorization: undefined };

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('token validation - invalid format', () => {
    it('should return 403 if token format is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token-format',
      };

      // Mock jwt.decode to return null (invalid format)
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => null);

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token format',
      });

      jwt.decode = originalDecode;
    });

    it('should return 403 if decoded token has no payload', async () => {
      mockRequest.headers = {
        authorization: 'Bearer some-token',
      };

      // Mock jwt.decode to return object without payload
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({ header: {}, payload: null }));

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token format',
      });

      jwt.decode = originalDecode;
    });
  });

  describe('token validation - issuer', () => {
    it('should return 403 if issuer does not match expected issuers', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: 'https://invalid-issuer.com',
          aud: config.auth.clientId,
          sub: 'test-sub',
        },
      }));

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(log.error).toHaveBeenCalledWith(
        '[AUTH] Token issuer mismatch',
        expect.any(Object)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token issuer',
      });

      jwt.decode = originalDecode;
    });

    it('should accept token with valid v2.0 issuer', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      // Mock JWKS key retrieval
      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      // Mock jwt.verify to succeed
      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user).toEqual({
        sub: 'test-sub',
        email: 'test@paythru.com',
        name: 'Test User',
        oid: 'test-oid',
      });

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });
  });

  describe('email domain validation', () => {
    it('should return 403 if email domain does not match allowed domain', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@invalid-domain.com',
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@invalid-domain.com',
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(log.error).toHaveBeenCalledWith(
        '[AUTH] Email domain validation failed',
        expect.objectContaining({
          email: 'test@invalid-domain.com',
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Access restricted to @paythru.com'),
      });

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });

    it('should accept token with valid email domain', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user?.email).toBe('test@paythru.com');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });
  });

  describe('sts.windows.net tokens (relaxed validation)', () => {
    it('should validate sts.windows.net token without signature verification', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const stsIssuer = `https://sts.windows.net/${config.auth.tenantId}/`;
      const now = Math.floor(Date.now() / 1000);
      const originalDecode = jwt.decode;

      // jwt.decode is called twice - once for initial check, once in sts.windows.net block
      const mockPayload = {
        iss: stsIssuer,
        aud: config.auth.clientId,
        sub: 'test-sub',
        email: 'test@paythru.com',
        name: 'Test User',
        oid: 'test-oid',
        exp: now + 3600, // 1 hour from now
        iat: now - 300, // 5 minutes ago
      };

      // Mock jwt.decode to return the same structure for all calls
      (jwt.decode as any) = jest.fn((token: string, options?: any) => {
        if (options && options.complete) {
          return {
            header: { alg: 'RS256', kid: 'test-kid' },
            payload: mockPayload,
          };
        }
        return mockPayload;
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(log.debug).toHaveBeenCalledWith(
        '[AUTH] Using relaxed validation for sts.windows.net token'
      );
      expect(mockResponse.status).not.toHaveBeenCalled(); // Should not return error
      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user).toEqual({
        sub: 'test-sub',
        email: 'test@paythru.com',
        name: 'Test User',
        oid: 'test-oid',
      });

      jwt.decode = originalDecode;
    });

    it('should return 403 if sts.windows.net token is expired', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const stsIssuer = `https://sts.windows.net/${config.auth.tenantId}/`;
      const now = Math.floor(Date.now() / 1000);
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: stsIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          exp: now - 3600, // Expired 1 hour ago
          iat: now - 7200, // Issued 2 hours ago
        },
      }));

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token expired',
      });

      jwt.decode = originalDecode;
    });

    // Note: Tenant ID mismatch test removed because the issuer check already validates
    // the tenant ID in the issuer path. If the issuer doesn't match (including tenant ID),
    // it fails at the issuer check stage, not the tenant ID check inside sts.windows.net block.
    // The tenant ID check inside the block is redundant but kept for defensive programming.
  });

  describe('email extraction from token', () => {
    it('should extract email from email field', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user?.email).toBe('test@paythru.com');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });

    it('should extract email from preferred_username if email is not available', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          preferred_username: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          preferred_username: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user?.email).toBe('test@paythru.com');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });
  });

  describe('error handling', () => {
    it('should return 500 on generic errors', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      // Mock jwt.decode to throw an error
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => {
        throw new Error('Unexpected error');
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(log.error).toHaveBeenCalledWith(
        'Authentication error',
        expect.any(Object)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication error',
      });

      jwt.decode = originalDecode;
    });

    it('should return 403 if token verification fails', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(new Error('Invalid signature'), null);
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(log.error).toHaveBeenCalledWith(
        '[AUTH] Token verification error',
        expect.any(Object)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token',
        details: 'Invalid signature',
      });

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });
  });

  describe('JWKS key retrieval', () => {
    it('should return 403 if token verification fails with key retrieval error', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
        },
      }));

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        // Simulate jwt.verify failing due to key retrieval error
        callback(new Error('Failed to retrieve signing key from all endpoints'), null);
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token',
        details: 'Failed to retrieve signing key from all endpoints',
      });

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });
  });

  describe('email domain validation edge cases', () => {
    it('should return 403 if email is missing', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const stsIssuer = `https://sts.windows.net/${config.auth.tenantId}/`;
      const now = Math.floor(Date.now() / 1000);
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn((token: string, options?: any) => {
        const payload = {
          iss: stsIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          exp: now + 3600,
          iat: now - 300,
          // No email field
        };
        if (options && options.complete) {
          return {
            header: { alg: 'RS256', kid: 'test-kid' },
            payload,
          };
        }
        return payload;
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Email address is required',
      });

      jwt.decode = originalDecode;
    });

    it('should return 403 if email format is invalid (no @ symbol)', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const stsIssuer = `https://sts.windows.net/${config.auth.tenantId}/`;
      const now = Math.floor(Date.now() / 1000);
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn((token: string, options?: any) => {
        const payload = {
          iss: stsIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'invalid-email-no-at-symbol',
          exp: now + 3600,
          iat: now - 300,
        };
        if (options && options.complete) {
          return {
            header: { alg: 'RS256', kid: 'test-kid' },
            payload,
          };
        }
        return payload;
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid email format',
      });

      jwt.decode = originalDecode;
    });
  });

  describe('sts.windows.net token edge cases', () => {
    it('should return 403 if sts.windows.net token decode fails in validation block', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const stsIssuer = `https://sts.windows.net/${config.auth.tenantId}/`;
      const originalDecode = jwt.decode;
      let callCount = 0;
      (jwt.decode as any) = jest.fn((token: string, options?: any) => {
        callCount++;
        if (options && options.complete) {
          // First call returns valid structure to pass issuer check
          if (callCount === 1) {
            return {
              header: { alg: 'RS256', kid: 'test-kid' },
              payload: {
                iss: stsIssuer,
                aud: config.auth.clientId,
                sub: 'test-sub',
              },
            };
          }
        }
        // Second call (in sts.windows.net block) returns invalid
        return null;
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token format',
      });

      jwt.decode = originalDecode;
    });

    it('should return 403 if sts.windows.net token is issued in the future', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const stsIssuer = `https://sts.windows.net/${config.auth.tenantId}/`;
      const now = Math.floor(Date.now() / 1000);
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn((token: string, options?: any) => {
        const payload = {
          iss: stsIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          iat: now + 600, // Issued 10 minutes in the future (more than 300s threshold)
        };
        if (options && options.complete) {
          return {
            header: { alg: 'RS256', kid: 'test-kid' },
            payload,
          };
        }
        return payload;
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token issued in the future',
      });

      jwt.decode = originalDecode;
    });

    it('should return 403 if sts.windows.net token has different tenant ID in issuer', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      // Use a sts.windows.net issuer with different tenant ID
      // The issuer check will fail because it uses startsWith with config tenant ID
      const stsIssuer = `https://sts.windows.net/99999999-9999-9999-9999-999999999999/`;
      const now = Math.floor(Date.now() / 1000);
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn((token: string, options?: any) => {
        const payload = {
          iss: stsIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          exp: now + 3600,
          iat: now - 300,
        };
        if (options && options.complete) {
          return {
            header: { alg: 'RS256', kid: 'test-kid' },
            payload,
          };
        }
        return payload;
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      // The issuer check will fail because tenant ID doesn't match
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token issuer',
      });

      jwt.decode = originalDecode;
    });

    it('should return 403 if sts.windows.net token has invalid email domain', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const stsIssuer = `https://sts.windows.net/${config.auth.tenantId}/`;
      const now = Math.floor(Date.now() / 1000);
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn((token: string, options?: any) => {
        const payload = {
          iss: stsIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@invalid-domain.com',
          name: 'Test User',
          exp: now + 3600,
          iat: now - 300,
        };
        if (options && options.complete) {
          return {
            header: { alg: 'RS256', kid: 'test-kid' },
            payload,
          };
        }
        return payload;
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(log.error).toHaveBeenCalledWith(
        '[AUTH] Email domain validation failed',
        expect.objectContaining({
          email: 'test@invalid-domain.com',
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Access restricted to @paythru.com'),
      });

      jwt.decode = originalDecode;
    });
  });

  describe('email and name extraction from various fields', () => {
    it('should extract email from upn field', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          upn: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          upn: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user?.email).toBe('test@paythru.com');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });

    it('should extract email from unique_name field', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          unique_name: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          unique_name: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user?.email).toBe('test@paythru.com');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });

    it('should extract email from emails array', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          emails: ['test@paythru.com', 'other@paythru.com'],
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          emails: ['test@paythru.com', 'other@paythru.com'],
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user?.email).toBe('test@paythru.com');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });

    it('should extract name from given_name when both given_name and family_name exist', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          given_name: 'John',
          family_name: 'Doe',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          given_name: 'John',
          family_name: 'Doe',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      // The logic uses || so given_name is used first, not the combination
      expect(mockRequest.user?.name).toBe('John');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });

    it('should extract name from given_name only', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          given_name: 'John',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          given_name: 'John',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user?.name).toBe('John');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });

    it('should fallback to email username part for name if no name fields available', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'testuser@paythru.com',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'testuser@paythru.com',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user?.name).toBe('testuser');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });
  });

  describe('token audience variations', () => {
    it('should accept token with api://clientId audience', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: `api://${config.auth.clientId}`,
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: `api://${config.auth.clientId}`,
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user?.email).toBe('test@paythru.com');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });

    it('should accept token with https://graph.microsoft.com audience', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: 'https://graph.microsoft.com',
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: 'https://graph.microsoft.com',
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user?.email).toBe('test@paythru.com');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });

    it('should log warning but accept token with non-matching audience', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const validIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: validIssuer,
          aud: 'unexpected-audience',
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: validIssuer,
          aud: 'unexpected-audience',
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(log.warn).toHaveBeenCalledWith(
        '[AUTH] Token audience not in expected list (but proceeding)',
        expect.any(Object)
      );
      expect(log.warn).toHaveBeenCalledWith(
        'Token audience mismatch (but accepting token)',
        expect.any(Object)
      );
      expect(nextFunction).toHaveBeenCalled();

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });
  });

  describe('token issuer variations', () => {
    it('should accept token with v1.0 issuer format', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const v1Issuer = `https://login.microsoftonline.com/${config.auth.tenantId}/`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: v1Issuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: v1Issuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user?.email).toBe('test@paythru.com');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });

    it('should accept token with issuer that starts with expected prefix', async () => {
      mockRequest.headers = {
        authorization: 'Bearer test-token',
      };

      const prefixIssuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0/some/path`;
      const originalDecode = jwt.decode;
      (jwt.decode as any) = jest.fn(() => ({
        header: { alg: 'RS256', kid: 'test-kid' },
        payload: {
          iss: prefixIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        },
      }));

      const mockKey = {
        getPublicKey: jest.fn(() => 'mock-public-key'),
      };
      mockJwksClient.getSigningKey.mockImplementation((kid: string, callback: any) => {
        callback(null, mockKey);
      });

      const originalVerify = jwt.verify;
      (jwt.verify as any) = jest.fn((token, getKey, options, callback) => {
        callback(null, {
          iss: prefixIssuer,
          aud: config.auth.clientId,
          sub: 'test-sub',
          email: 'test@paythru.com',
          name: 'Test User',
          oid: 'test-oid',
        });
      });

      await authenticateToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user?.email).toBe('test@paythru.com');

      jwt.decode = originalDecode;
      jwt.verify = originalVerify;
    });
  });
});
