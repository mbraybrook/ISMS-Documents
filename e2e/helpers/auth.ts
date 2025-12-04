import { Page } from '@playwright/test';

/**
 * Authentication helpers for E2E tests
 * 
 * Note: In a real scenario, you would need to:
 * 1. Mock MSAL authentication
 * 2. Use test credentials
 * 3. Or use authentication state files
 */

export interface TestUser {
  email: string;
  password?: string;
  role: 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR';
  department?: string;
}

/**
 * Mock authentication by setting localStorage tokens
 * This is a simplified approach - in production, you'd use proper MSAL mocking
 */
export async function mockAuthenticate(page: Page, user: TestUser): Promise<void> {
  // Set mock token in localStorage
  const mockToken = createMockToken(user);
  await page.addInitScript((token) => {
    localStorage.setItem('msal.accessToken', token);
    localStorage.setItem('msal.account', JSON.stringify({
      username: user.email,
      name: user.email.split('@')[0],
    }));
  }, mockToken);
}

/**
 * Create a mock JWT token for testing
 * This is a simplified mock - real tokens would be properly signed
 */
function createMockToken(user: TestUser): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: `test-${user.email}`,
    email: user.email,
    name: user.email.split('@')[0],
    oid: `test-oid-${user.email}`,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iat: Math.floor(Date.now() / 1000),
  }));
  const signature = 'mock-signature';
  return `${header}.${payload}.${signature}`;
}

/**
 * Login as a specific user role
 */
export async function loginAs(page: Page, role: TestUser['role'], department?: string): Promise<void> {
  const testUsers: Record<string, TestUser> = {
    ADMIN: { email: 'admin@paythru.com', role: 'ADMIN' },
    EDITOR: { email: 'editor@paythru.com', role: 'EDITOR' },
    STAFF: { email: 'staff@paythru.com', role: 'STAFF' },
    CONTRIBUTOR: { email: 'contributor@paythru.com', role: 'CONTRIBUTOR', department: department || 'OPERATIONS' },
  };

  const user = testUsers[role];
  if (!user) {
    throw new Error(`Unknown role: ${role}`);
  }

  await mockAuthenticate(page, user);
}

/**
 * Logout by clearing authentication state
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('msal.accessToken');
    localStorage.removeItem('msal.account');
    localStorage.removeItem('msal.idToken');
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return !!localStorage.getItem('msal.accessToken');
  });
}


