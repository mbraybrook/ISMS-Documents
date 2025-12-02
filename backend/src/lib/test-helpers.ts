import { UserRole } from '../types/enums';
import { AuthRequest } from '../middleware/auth';

/**
 * Test helper utilities for creating mock data and test scenarios
 */

export interface MockUser {
  id: string;
  email: string;
  displayName: string;
  entraObjectId: string;
  role: UserRole;
  department?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MockAuthUser {
  sub: string;
  email: string;
  name: string;
  oid: string;
  role?: UserRole;
  department?: string | null;
}

/**
 * Create a mock user object for testing
 */
export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  const id = overrides?.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    email: overrides?.email || `test-${id}@paythru.com`,
    displayName: overrides?.displayName || 'Test User',
    entraObjectId: overrides?.entraObjectId || `oid-${id}`,
    role: overrides?.role || 'STAFF',
    department: overrides?.department ?? null,
    createdAt: overrides?.createdAt || new Date(),
    updatedAt: overrides?.updatedAt || new Date(),
  };
}

/**
 * Create a mock auth user (from token) for testing
 */
export function createMockAuthUser(overrides?: Partial<MockAuthUser>): MockAuthUser {
  const sub = overrides?.sub || `sub-${Date.now()}`;
  return {
    sub,
    email: overrides?.email || `test-${sub}@paythru.com`,
    name: overrides?.name || 'Test User',
    oid: overrides?.oid || `oid-${sub}`,
    role: overrides?.role,
    department: overrides?.department ?? null,
  };
}

/**
 * Create a mock AuthRequest with user attached
 */
export function createMockAuthRequest(
  user?: MockAuthUser,
  overrides?: Partial<AuthRequest>
): AuthRequest {
  const mockUser = user || createMockAuthUser();
  return {
    user: mockUser,
    ...overrides,
  } as AuthRequest;
}

/**
 * Create mock users with different roles
 */
export const mockUsers = {
  admin: (): MockUser => createMockUser({ role: 'ADMIN' }),
  editor: (): MockUser => createMockUser({ role: 'EDITOR' }),
  staff: (): MockUser => createMockUser({ role: 'STAFF' }),
  contributor: (department?: string): MockUser =>
    createMockUser({ role: 'CONTRIBUTOR', department: department || 'OPERATIONS' }),
};

/**
 * Create mock auth users with different roles
 */
export const mockAuthUsers = {
  admin: (): MockAuthUser => createMockAuthUser({ role: 'ADMIN' }),
  editor: (): MockAuthUser => createMockAuthUser({ role: 'EDITOR' }),
  staff: (): MockAuthUser => createMockAuthUser({ role: 'STAFF' }),
  contributor: (department?: string): MockAuthUser =>
    createMockAuthUser({ role: 'CONTRIBUTOR', department: department || 'OPERATIONS' }),
};

/**
 * Helper to create a mock Express request with authentication
 */
export function createMockRequest(user?: MockAuthUser): Partial<AuthRequest> {
  return {
    user: user || createMockAuthUser(),
    headers: {},
    body: {},
    query: {},
    params: {},
  };
}

/**
 * Helper to create a mock Express response
 */
export function createMockResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Helper to create a mock Express next function
 */
export function createMockNext(): jest.Mock {
  return jest.fn();
}

