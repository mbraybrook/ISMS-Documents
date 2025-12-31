// Utility functions for document form operations

export interface DocumentFormData {
  title: string;
  type: string;
  storageLocation: string;
  version: string;
  status: string;
  ownerUserId: string;
  sharePointSiteId: string;
  sharePointDriveId: string;
  sharePointItemId: string;
  confluenceSpaceKey: string;
  confluencePageId: string;
  lastReviewDate: string;
  nextReviewDate: string;
  requiresAcknowledgement: boolean;
  versionNotes: string;
}

export interface Document {
  id: string;
  title: string;
  type: string;
  storageLocation: string;
  version: string;
  status: string;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  requiresAcknowledgement?: boolean;
  ownerUserId: string;
  sharePointSiteId?: string;
  sharePointDriveId?: string;
  sharePointItemId?: string;
  confluenceSpaceKey?: string;
  confluencePageId?: string;
  documentUrl?: string | null;
  hasChanged?: boolean;
  lastChecked?: string | null;
  lastModified?: string | null;
}

/**
 * Get default form data for a new document
 */
export function getDefaultFormData(userId?: string): DocumentFormData {
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(today.getFullYear() + 1);

  return {
    title: '',
    type: 'POLICY',
    storageLocation: 'SHAREPOINT',
    version: '1.0',
    status: 'DRAFT',
    ownerUserId: userId || '',
    sharePointSiteId: '',
    sharePointDriveId: '',
    sharePointItemId: '',
    confluenceSpaceKey: '',
    confluencePageId: '',
    lastReviewDate: today.toISOString().split('T')[0],
    nextReviewDate: nextYear.toISOString().split('T')[0],
    requiresAcknowledgement: true,
    versionNotes: '',
  };
}

/**
 * Calculate next review date (1 year from today)
 */
export function getNextReviewDate(): string {
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(today.getFullYear() + 1);
  return nextYear.toISOString().split('T')[0];
}

/**
 * Format date for display (en-GB format)
 */
export function formatDateForDisplay(dateString: string | null): string {
  if (!dateString) return 'Not set';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Convert date to ISO date string (YYYY-MM-DD)
 */
export function toISODateString(date: string | null | Date): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
}


