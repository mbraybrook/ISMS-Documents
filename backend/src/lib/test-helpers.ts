/* eslint-disable @typescript-eslint/no-explicit-any */
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

/**
 * Helper to create a test JWT token for Azure AD authentication
 * @param payload - Token payload
 * @param secret - Signing secret (optional, for testing)
 * @param options - JWT signing options
 */
export function createMockJWT(
  _payload: any,
  _secret?: string,
  _options?: { issuer?: string; audience?: string; expiresIn?: string | number }
): string {
  // This is a helper for creating test tokens
  // In actual tests, we'll mock jwt.sign/jwt.verify
  // This is mainly for documentation and type safety
  return 'mock-jwt-token';
}

/**
 * Helper to create a test JWT token for Trust Centre authentication
 * @param userId - User ID
 * @param tokenVersion - Token version (optional)
 * @param secret - JWT secret
 * @param expiresIn - Expiration time (default: 24h)
 */
export function createMockTrustJWT(
  userId: string,
  tokenVersion?: number,
  secret?: string,
  _expiresIn: string | number = '24h'
): string {
  // This is a helper for creating test tokens
  // In actual tests, we'll use jsonwebtoken directly
  // This is mainly for documentation and type safety
  return 'mock-trust-jwt-token';
}

/**
 * Console suppression helpers
 * 
 * By default, console.error is suppressed during tests (see test-setup.ts).
 * Use these helpers if you need to:
 * - Verify that console.error was called in a specific test
 * - Temporarily restore console methods for debugging
 */

/**
 * Suppress console.error for a test (default behavior, but can be used explicitly)
 * Returns a spy that can be used to verify error calls
 * 
 * @example
 * ```typescript
 * it('should log error when operation fails', () => {
 *   const errorSpy = suppressConsoleError();
 *   // ... test code that triggers error ...
 *   expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'));
 * });
 * ```
 */
export function suppressConsoleError(): jest.SpyInstance {
  return jest.spyOn(console, 'error').mockImplementation(() => { });
}

/**
 * Restore console.error to its original implementation
 * Use this if you need to see actual error output during a specific test
 * 
 * @example
 * ```typescript
 * it('should show real error output', () => {
 *   restoreConsoleError();
 *   // ... test code ...
 * });
 * ```
 */
export function restoreConsoleError(): void {
  // Get the original from global scope (set in test-setup.ts)
  const original = (global as any).__originalConsoleError;
  if (original) {
    console.error = original;
  }
}

/**
 * Suppress multiple console methods at once
 * Returns an object with spies for each method
 * 
 * @example
 * ```typescript
 * it('should suppress all console output', () => {
 *   const spies = suppressConsole(['error', 'warn', 'log']);
 *   // ... test code ...
 *   expect(spies.error).toHaveBeenCalled();
 * });
 * ```
 */
export function suppressConsole(
  methods: ('error' | 'warn' | 'log' | 'info' | 'debug')[] = ['error']
): Record<string, jest.SpyInstance> {
  const spies: Record<string, jest.SpyInstance> = {};
  methods.forEach((method) => {
    spies[method] = jest.spyOn(console, method).mockImplementation(() => { });
  });
  return spies;
}


