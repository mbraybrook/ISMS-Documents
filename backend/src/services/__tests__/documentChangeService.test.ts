/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as documentChangeService from '../documentChangeService';
import * as sharePointService from '../sharePointService';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    document: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock SharePoint service
jest.mock('../sharePointService', () => ({
  getAppOnlyAccessToken: jest.fn(),
  getSharePointItem: jest.fn(),
}));

// Mock logger
jest.mock('../../lib/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { prisma } from '../../lib/prisma';

describe('documentChangeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkSingleDocument', () => {
    it('should check a document and mark as changed when SharePoint date is newer', async () => {
      // Arrange
      const documentId = 'doc-1';
      const mockDocument = {
        id: documentId,
        title: 'Test Document',
        storageLocation: 'SHAREPOINT',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
        lastChecked: new Date('2024-01-01T00:00:00Z'),
        lastModified: new Date('2024-01-01T00:00:00Z'),
        hasChanged: false,
      };

      const mockSharePointItem = {
        id: 'item-1',
        name: 'test.docx',
        webUrl: 'https://example.sharepoint.com/test.docx',
        lastModifiedDateTime: '2024-01-02T00:00:00Z', // Newer than lastChecked
        createdDateTime: '2024-01-01T00:00:00Z',
        size: 1024,
      };

      (prisma.document.findUnique as any).mockResolvedValue(mockDocument);
      (sharePointService.getAppOnlyAccessToken as any).mockResolvedValue('token');
      (sharePointService.getSharePointItem as any).mockResolvedValue(mockSharePointItem);
      (prisma.document.update as any).mockResolvedValue({ ...mockDocument, hasChanged: true });

      // Act
      const result = await documentChangeService.checkSingleDocument(documentId);

      // Assert
      expect(result).toBe(true);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: documentId },
        data: {
          hasChanged: true,
          lastChecked: expect.any(Date),
          lastModified: new Date('2024-01-02T00:00:00Z'),
        },
      });
    });

    it('should check a document and mark as not changed when SharePoint date is older', async () => {
      // Arrange
      const documentId = 'doc-1';
      const mockDocument = {
        id: documentId,
        title: 'Test Document',
        storageLocation: 'SHAREPOINT',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
        lastChecked: new Date('2024-01-02T00:00:00Z'),
        lastModified: new Date('2024-01-01T00:00:00Z'),
        hasChanged: false,
      };

      const mockSharePointItem = {
        id: 'item-1',
        name: 'test.docx',
        webUrl: 'https://example.sharepoint.com/test.docx',
        lastModifiedDateTime: '2024-01-01T00:00:00Z', // Older than lastChecked
        createdDateTime: '2024-01-01T00:00:00Z',
        size: 1024,
      };

      (prisma.document.findUnique as any).mockResolvedValue(mockDocument);
      (sharePointService.getAppOnlyAccessToken as any).mockResolvedValue('token');
      (sharePointService.getSharePointItem as any).mockResolvedValue(mockSharePointItem);
      (prisma.document.update as any).mockResolvedValue({ ...mockDocument, hasChanged: false });

      // Act
      const result = await documentChangeService.checkSingleDocument(documentId);

      // Assert
      expect(result).toBe(false);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: documentId },
        data: {
          hasChanged: false,
          lastChecked: expect.any(Date),
          lastModified: new Date('2024-01-01T00:00:00Z'),
        },
      });
    });

    it('should preserve hasChanged flag when no new change is detected', async () => {
      // Arrange - Document already flagged as changed
      const documentId = 'doc-1';
      const mockDocument = {
        id: documentId,
        title: 'Test Document',
        storageLocation: 'SHAREPOINT',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
        lastChecked: new Date('2024-01-02T00:00:00Z'),
        lastModified: new Date('2024-01-02T00:00:00Z'),
        hasChanged: true, // Already flagged as changed
      };

      const mockSharePointItem = {
        id: 'item-1',
        name: 'test.docx',
        webUrl: 'https://example.sharepoint.com/test.docx',
        lastModifiedDateTime: '2024-01-02T00:00:00Z', // Same as lastChecked (no new change)
        createdDateTime: '2024-01-01T00:00:00Z',
        size: 1024,
      };

      (prisma.document.findUnique as any).mockResolvedValue(mockDocument);
      (sharePointService.getAppOnlyAccessToken as any).mockResolvedValue('token');
      (sharePointService.getSharePointItem as any).mockResolvedValue(mockSharePointItem);
      (prisma.document.update as any).mockResolvedValue({ ...mockDocument });

      // Act
      const result = await documentChangeService.checkSingleDocument(documentId);

      // Assert
      expect(result).toBe(true); // Should preserve the existing flag
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: documentId },
        data: {
          hasChanged: true, // Flag should be preserved, not cleared
          lastChecked: expect.any(Date),
          lastModified: new Date('2024-01-02T00:00:00Z'),
        },
      });
    });

    it('should return null for non-SharePoint documents', async () => {
      // Arrange
      const documentId = 'doc-1';
      const mockDocument = {
        id: documentId,
        title: 'Test Document',
        storageLocation: 'CONFLUENCE',
        sharePointSiteId: null,
        sharePointDriveId: null,
        sharePointItemId: null,
        lastChecked: null,
        lastModified: null,
        hasChanged: false,
      };

      (prisma.document.findUnique as any).mockResolvedValue(mockDocument);

      // Act
      const result = await documentChangeService.checkSingleDocument(documentId);

      // Assert
      expect(result).toBeNull();
      expect(sharePointService.getSharePointItem).not.toHaveBeenCalled();
    });

    it('should return null when SharePoint item is not found', async () => {
      // Arrange
      const documentId = 'doc-1';
      const mockDocument = {
        id: documentId,
        title: 'Test Document',
        storageLocation: 'SHAREPOINT',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
        lastChecked: null,
        lastModified: null,
        hasChanged: false,
      };

      (prisma.document.findUnique as any).mockResolvedValue(mockDocument);
      (sharePointService.getAppOnlyAccessToken as any).mockResolvedValue('token');
      (sharePointService.getSharePointItem as any).mockResolvedValue(null);

      // Act
      const result = await documentChangeService.checkSingleDocument(documentId);

      // Assert
      expect(result).toBeNull();
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it('should return null when document is not found', async () => {
      // Arrange
      const documentId = 'doc-1';
      (prisma.document.findUnique as any).mockResolvedValue(null);

      // Act
      const result = await documentChangeService.checkSingleDocument(documentId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle first check (no lastChecked) without marking as changed', async () => {
      // Arrange
      const documentId = 'doc-1';
      const mockDocument = {
        id: documentId,
        title: 'Test Document',
        storageLocation: 'SHAREPOINT',
        sharePointSiteId: 'site-1',
        sharePointDriveId: 'drive-1',
        sharePointItemId: 'item-1',
        lastChecked: null,
        lastModified: null,
        hasChanged: false,
      };

      const mockSharePointItem = {
        id: 'item-1',
        name: 'test.docx',
        webUrl: 'https://example.sharepoint.com/test.docx',
        lastModifiedDateTime: '2024-01-02T00:00:00Z',
        createdDateTime: '2024-01-01T00:00:00Z',
        size: 1024,
      };

      (prisma.document.findUnique as any).mockResolvedValue(mockDocument);
      (sharePointService.getAppOnlyAccessToken as any).mockResolvedValue('token');
      (sharePointService.getSharePointItem as any).mockResolvedValue(mockSharePointItem);
      (prisma.document.update as any).mockResolvedValue({ ...mockDocument, hasChanged: false });

      // Act
      const result = await documentChangeService.checkSingleDocument(documentId);

      // Assert
      expect(result).toBe(false); // First check should not mark as changed
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: documentId },
        data: {
          hasChanged: false,
          lastChecked: expect.any(Date),
          lastModified: new Date('2024-01-02T00:00:00Z'),
        },
      });
    });
  });

  describe('checkDocumentChanges', () => {
    it('should check all SharePoint documents and return summary', async () => {
      // Arrange
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Document 1',
          sharePointSiteId: 'site-1',
          sharePointDriveId: 'drive-1',
          sharePointItemId: 'item-1',
          lastChecked: new Date('2024-01-01T00:00:00Z'),
          lastModified: new Date('2024-01-01T00:00:00Z'),
          hasChanged: false,
        },
        {
          id: 'doc-2',
          title: 'Document 2',
          sharePointSiteId: 'site-1',
          sharePointDriveId: 'drive-1',
          sharePointItemId: 'item-2',
          lastChecked: new Date('2024-01-02T00:00:00Z'),
          lastModified: new Date('2024-01-01T00:00:00Z'),
          hasChanged: false,
        },
      ];

      const mockSharePointItems = [
        {
          id: 'item-1',
          name: 'doc1.docx',
          lastModifiedDateTime: '2024-01-02T00:00:00Z', // Changed
        },
        {
          id: 'item-2',
          name: 'doc2.docx',
          lastModifiedDateTime: '2024-01-01T00:00:00Z', // Not changed
        },
      ];

      (prisma.document.findMany as any).mockResolvedValue(mockDocuments);
      (sharePointService.getAppOnlyAccessToken as any).mockResolvedValue('token');
      (sharePointService.getSharePointItem as any)
        .mockResolvedValueOnce(mockSharePointItems[0])
        .mockResolvedValueOnce(mockSharePointItems[1]);
      (prisma.document.update as any).mockResolvedValue({});

      // Act
      const result = await documentChangeService.checkDocumentChanges(50, 0);

      // Assert
      expect(result.checked).toBe(2);
      expect(result.changed).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.skipped).toBe(0);
      expect(prisma.document.update).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully and continue processing', async () => {
      // Arrange
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Document 1',
          sharePointSiteId: 'site-1',
          sharePointDriveId: 'drive-1',
          sharePointItemId: 'item-1',
          lastChecked: null,
          lastModified: null,
          hasChanged: false,
        },
        {
          id: 'doc-2',
          title: 'Document 2',
          sharePointSiteId: 'site-1',
          sharePointDriveId: 'drive-1',
          sharePointItemId: 'item-2',
          lastChecked: null,
          lastModified: null,
          hasChanged: false,
        },
      ];

      (prisma.document.findMany as any).mockResolvedValue(mockDocuments);
      (sharePointService.getAppOnlyAccessToken as any).mockResolvedValue('token');
      (sharePointService.getSharePointItem as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          id: 'item-2',
          name: 'doc2.docx',
          lastModifiedDateTime: '2024-01-01T00:00:00Z',
        });
      (prisma.document.update as any).mockResolvedValue({});

      // Act
      const result = await documentChangeService.checkDocumentChanges(50, 0);

      // Assert
      expect(result.checked).toBe(1);
      expect(result.errors).toBe(1);
      expect(prisma.document.update).toHaveBeenCalledTimes(1);
    });

    it('should skip documents when SharePoint item is not found', async () => {
      // Arrange
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Document 1',
          sharePointSiteId: 'site-1',
          sharePointDriveId: 'drive-1',
          sharePointItemId: 'item-1',
          lastChecked: null,
          lastModified: null,
          hasChanged: false,
        },
      ];

      (prisma.document.findMany as any).mockResolvedValue(mockDocuments);
      (sharePointService.getAppOnlyAccessToken as any).mockResolvedValue('token');
      (sharePointService.getSharePointItem as any).mockResolvedValue(null);

      // Act
      const result = await documentChangeService.checkDocumentChanges(50, 0);

      // Assert
      expect(result.checked).toBe(0);
      expect(result.skipped).toBe(1);
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it('should preserve hasChanged flag when no new change is detected in batch check', async () => {
      // Arrange - Document already flagged as changed
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Document 1',
          sharePointSiteId: 'site-1',
          sharePointDriveId: 'drive-1',
          sharePointItemId: 'item-1',
          lastChecked: new Date('2024-01-02T00:00:00Z'),
          lastModified: new Date('2024-01-02T00:00:00Z'),
          hasChanged: true, // Already flagged as changed
        },
      ];

      const mockSharePointItem = {
        id: 'item-1',
        name: 'doc1.docx',
        lastModifiedDateTime: '2024-01-02T00:00:00Z', // Same as lastChecked (no new change)
      };

      (prisma.document.findMany as any).mockResolvedValue(mockDocuments);
      (sharePointService.getAppOnlyAccessToken as any).mockResolvedValue('token');
      (sharePointService.getSharePointItem as any).mockResolvedValue(mockSharePointItem);
      (prisma.document.update as any).mockResolvedValue({});

      // Act
      const result = await documentChangeService.checkDocumentChanges(50, 0);

      // Assert
      expect(result.checked).toBe(1);
      expect(result.changed).toBe(1); // Should still count as changed since flag is preserved
      expect(result.errors).toBe(0);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: {
          hasChanged: true, // Flag should be preserved, not cleared
          lastChecked: expect.any(Date),
          lastModified: new Date('2024-01-02T00:00:00Z'),
        },
      });
    });
  });
});

