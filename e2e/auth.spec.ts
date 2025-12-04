import { test, expect } from '@playwright/test';
import { loginAs, logout, isAuthenticated } from './helpers/auth';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing authentication
    await logout(page);
  });

  test('should redirect unauthenticated users to login page', async ({ page }) => {
    await page.goto('/admin');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/admin\/login/);
  });

  test('should allow login as ADMIN user', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin');
    
    // Should be authenticated and on admin page
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);
  });

  test('should allow login as STAFF user', async ({ page }) => {
    await loginAs(page, 'STAFF');
    await page.goto('/admin/staff');
    
    // Should be authenticated
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);
  });

  test('should redirect STAFF users to staff home', async ({ page }) => {
    await loginAs(page, 'STAFF');
    await page.goto('/admin/login');
    
    // Should redirect to staff home
    await expect(page).toHaveURL(/.*\/admin\/staff/);
  });

  test('should redirect ADMIN users to admin home', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin/login');
    
    // Should redirect to admin home
    await expect(page).toHaveURL(/.*\/admin/);
  });

  test('should handle logout', async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await page.goto('/admin');
    
    // Logout
    await logout(page);
    await page.goto('/admin');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/admin\/login/);
  });

  test('should prevent unauthorized access to admin routes', async ({ page }) => {
    await loginAs(page, 'STAFF');
    
    // Try to access admin-only route
    await page.goto('/admin/documents/documents');
    
    // Should either redirect or show unauthorized
    // The exact behavior depends on implementation
    const url = page.url();
    expect(url).toMatch(/.*\/admin\/staff|.*\/unauthorized/);
  });
});


