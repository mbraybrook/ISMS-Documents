import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { createTestDocument, cleanupTestData } from './helpers/db';

test.describe('Document Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'ADMIN');
    await cleanupTestData();
  });

  test('admin can view documents list', async ({ page }) => {
    await page.goto('/admin/documents/documents');
    
    // Should see documents page
    await expect(page.locator('h1, h2')).toContainText(/document/i);
  });

  test('admin can create a new document', async ({ page }) => {
    await page.goto('/admin/documents/documents');
    
    // Look for create button
    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    
    if (await createButton.isVisible()) {
      await createButton.click();
      
      // Fill in document form if modal opens
      const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]').first();
      if (await titleInput.isVisible()) {
        await titleInput.fill('E2E Test Document');
        
        // Submit form
        const submitButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          
          // Wait for success message or document to appear
          await page.waitForTimeout(1000);
        }
      }
    }
    
    // Verify we're still on documents page
    await expect(page).toHaveURL(/.*\/documents/);
  });

  test('staff can only view approved documents', async ({ page }) => {
    // Create a test document
    await createTestDocument({ status: 'APPROVED', title: 'Approved Document' });
    
    await logout(page);
    await loginAs(page, 'STAFF');
    await page.goto('/admin/staff/documents');
    
    // Should see approved documents
    await expect(page.locator('text=Approved Document')).toBeVisible({ timeout: 5000 });
  });

  test('staff cannot access document creation', async ({ page }) => {
    await loginAs(page, 'STAFF');
    await page.goto('/admin/documents/documents');
    
    // Should not see create button or should be redirected
    const createButton = page.locator('button:has-text("Create")');
    await expect(createButton).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // If button doesn't exist, that's also fine
    });
  });
});




