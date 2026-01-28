/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response, NextFunction } from 'express';
import { requireRole, requireDepartmentAccess } from '../authorize';
import { AuthRequest } from '../auth';
import { createMockRequest, createMockResponse, createMockNext, mockUsers } from '../../lib/test-helpers';
import { prisma } from '../../lib/prisma';

// Mock logger to suppress expected error logs in tests
jest.mock('../../lib/logger', () => ({
  log: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  },
}));

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('requireRole middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
    nextFunction = createMockNext();
    jest.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    mockRequest.user = undefined;
    const middleware = requireRole('ADMIN');

    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should allow ADMIN access when user has ADMIN role', async () => {
    const adminUser = mockUsers.admin();
    mockRequest.user = { email: adminUser.email, sub: 'test-sub', name: 'Test', oid: 'test-oid' };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
    const middleware = requireRole('ADMIN');

    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: adminUser.email },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should allow EDITOR access when user has EDITOR role', async () => {
    const editorUser = mockUsers.editor();
    mockRequest.user = { email: editorUser.email, sub: 'test-sub', name: 'Test', oid: 'test-oid' };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(editorUser);
    const middleware = requireRole('ADMIN', 'EDITOR');

    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should deny STAFF access to admin-only routes', async () => {
    const staffUser = mockUsers.staff();
    mockRequest.user = { email: staffUser.email, sub: 'test-sub', name: 'Test', oid: 'test-oid' };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(staffUser);
    const middleware = requireRole('ADMIN');

    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 403 if user is not found in database', async () => {
    mockRequest.user = { email: 'nonexistent@paythru.com', sub: 'test-sub', name: 'Test', oid: 'test-oid' };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const middleware = requireRole('ADMIN');

    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should attach user role and department to request', async () => {
    const contributorUser = mockUsers.contributor('OPERATIONS');
    mockRequest.user = { email: contributorUser.email, sub: 'test-sub', name: 'Test', oid: 'test-oid' };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(contributorUser);
    const middleware = requireRole('CONTRIBUTOR');

    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect((mockRequest.user as any).role).toBe('CONTRIBUTOR');
    expect((mockRequest.user as any).department).toBe('OPERATIONS');
  });

  it('should handle database errors gracefully', async () => {
    mockRequest.user = { email: 'test@paythru.com', sub: 'test-sub', name: 'Test', oid: 'test-oid' };

    (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));
    const middleware = requireRole('ADMIN');

    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authorization error' });
    expect(nextFunction).not.toHaveBeenCalled();
  });
});

describe('requireDepartmentAccess middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
    nextFunction = createMockNext();
    jest.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    mockRequest.user = undefined;
    const middleware = requireDepartmentAccess();

    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should allow access for ADMIN users without department', async () => {
    const adminUser = mockUsers.admin();
    mockRequest.user = { email: adminUser.email, sub: 'test-sub', name: 'Test', oid: 'test-oid' };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
    const middleware = requireDepartmentAccess();

    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should allow access for CONTRIBUTOR with department assigned', async () => {
    const contributorUser = mockUsers.contributor('OPERATIONS');
    mockRequest.user = { email: contributorUser.email, sub: 'test-sub', name: 'Test', oid: 'test-oid' };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(contributorUser);
    const middleware = requireDepartmentAccess();

    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect((mockRequest.user as any).department).toBe('OPERATIONS');
  });

  it('should deny access for CONTRIBUTOR without department', async () => {
    const contributorUser = mockUsers.contributor();
    contributorUser.department = null;
    mockRequest.user = { email: contributorUser.email, sub: 'test-sub', name: 'Test', oid: 'test-oid' };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(contributorUser);
    const middleware = requireDepartmentAccess();

    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Contributors must have a department assigned',
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 403 if user is not found', async () => {
    mockRequest.user = { email: 'nonexistent@paythru.com', sub: 'test-sub', name: 'Test', oid: 'test-oid' };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const middleware = requireDepartmentAccess();

    await middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(nextFunction).not.toHaveBeenCalled();
  });
});




