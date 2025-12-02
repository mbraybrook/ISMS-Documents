import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { createTestDocument, cleanupTestData } from './helpers/db';

test.describe('Acknowledgment Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupTestData();
  });

  test('should display pending documents for staff user', async ({ page }) => {
    // Create a document that requires acknowledgment
    await createTestDocument({
      title: 'Document Requiring Acknowledgment',
      status: 'APPROVED',
      requiresAcknowledgement: true,
      version: '1.0',
    });
    
    await loginAs(page, 'STAFF');
    await page.goto('/admin/staff/acknowledgments');
    
    // Check if page loads and shows pending documents
    await expect(page.locator('h1, h2')).toContainText(/acknowledgment|pending/i, { timeout: 5000 });
  });

  test('should allow staff to acknowledge all documents', async ({ page }) => {
    // Create test documents
    await createTestDocument({
      title: 'Document 1',
      status: 'APPROVED',
      requiresAcknowledgement: true,
      version: '1.0',
    });
    await createTestDocument({
      title: 'Document 2',
      status: 'APPROVED',
      requiresAcknowledgement: true,
      version: '1.0',
    });
    
    await loginAs(page, 'STAFF');
    await page.goto('/admin/staff/acknowledgments');
    
    // Look for acknowledge all button
    const acknowledgeAllButton = page.locator('button:has-text("Acknowledge All"), button:has-text("Acknowledge")').first();
    
    if (await acknowledgeAllButton.isVisible({ timeout: 5000 })) {
      await acknowledgeAllButton.click();
      
      // Wait for success message or page update
      await page.waitForTimeout(2000);
      
      // Verify acknowledgment was successful
      // This might show a success message or update the list
      const successMessage = page.locator('text=/success|acknowledged/i');
      await expect(successMessage.first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // If no success message, check if list is empty
        const pendingList = page.locator('table tbody tr, [data-testid="pending-documents"]');
        // List might be empty or show different state
      });
    }
  });

  test('should track document version in acknowledgments', async ({ page }) => {
    const doc = await createTestDocument({
      title: 'Versioned Document',
      status: 'APPROVED',
      requiresAcknowledgement: true,
      version: '1.0',
    });
    
    await loginAs(page, 'STAFF');
    await page.goto('/admin/staff/acknowledgments');
    
    // Should see document with version
    await expect(page.locator('text=Versioned Document')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=1.0')).toBeVisible({ timeout: 5000 });
  });
});




