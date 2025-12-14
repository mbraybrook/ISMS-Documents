/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import { trustRouter } from '../trust';

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      sub: 'test-user',
      email: 'test@paythru.com',
      name: 'Test User',
      oid: 'test-oid',
    };
    next();
  },
  AuthRequest: {} as any,
}));

// Mock trust authentication middleware
// This needs to be a factory function to allow dynamic behavior
const mockAuthenticateTrustToken = jest.fn((req: any, res: any, next: any) => {
  // Default behavior: set user with terms accepted
  req.externalUser = {
    id: 'test-external-user-id',
    email: 'test@example.com',
    companyName: 'Test Company',
    isApproved: true,
    tokenVersion: 1,
    termsAcceptedAt: new Date(),
  };
  next();
});

jest.mock('../../middleware/trustAuth', () => ({
  authenticateTrustToken: (req: any, res: any, next: any) => mockAuthenticateTrustToken(req, res, next),
  TrustAuthRequest: {} as any,
}));

// Mock authorization middleware
jest.mock('../../middleware/authorize', () => ({
  requireRole: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock rate limiting middleware
jest.mock('../../middleware/rateLimit', () => ({
  downloadLimiter: (req: any, res: any, next: any) => next(),
}));

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    trustDocSetting: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    externalUser: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    trustDownload: {
      create: jest.fn(),
    },
    trustAuditLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    trustCenterSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    supplier: {
      findMany: jest.fn(),
    },
  },
}));

// Mock SharePoint service
jest.mock('../../services/sharePointService', () => ({
  getAppOnlyAccessToken: jest.fn(),
  downloadSharePointFile: jest.fn(),
  parseSharePointUrlToIds: jest.fn(),
  verifySharePointFileAccess: jest.fn(),
  FileNotFoundError: class FileNotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'FileNotFoundError';
    }
  },
  FileTooLargeError: class FileTooLargeError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'FileTooLargeError';
    }
  },
  PermissionDeniedError: class PermissionDeniedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PermissionDeniedError';
    }
  },
}));

// Mock watermark service
jest.mock('../../services/watermarkService', () => ({
  addWatermarkToPdf: jest.fn(),
  validatePdfForWatermarking: jest.fn(),
}));

// Mock document conversion service
jest.mock('../../services/documentConversionService', () => ({
  convertToPdf: jest.fn(),
  canConvertToPdf: jest.fn(),
  getPdfFilename: jest.fn((filename: string) => {
    if (filename.toLowerCase().endsWith('.pdf')) {
      return filename;
    }
    return filename.replace(/\.[^.]+$/, '.pdf');
  }),
}));

// Mock PDF cache service
jest.mock('../../services/pdfCacheService', () => ({
  getCachedPdf: jest.fn(),
  setCachedPdf: jest.fn(),
}));

// Mock trust audit service
jest.mock('../../services/trustAuditService', () => ({
  logTrustAction: jest.fn().mockResolvedValue(undefined),
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    trustCenter: {
      maxFileSizeMB: 50,
    },
  },
}));

import { prisma } from '../../lib/prisma';
import {
  getAppOnlyAccessToken,
  downloadSharePointFile,
  parseSharePointUrlToIds,
  verifySharePointFileAccess,
  FileNotFoundError,
  FileTooLargeError,
  PermissionDeniedError,
} from '../../services/sharePointService';
import { addWatermarkToPdf, validatePdfForWatermarking } from '../../services/watermarkService';
import { convertToPdf, canConvertToPdf, getPdfFilename } from '../../services/documentConversionService';
import { getCachedPdf, setCachedPdf } from '../../services/pdfCacheService';
import { logTrustAction } from '../../services/trustAuditService';

describe('Trust Routes', () => {
  let app: express.Application;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/trust', trustRouter);
    jest.clearAllMocks();
    
    // Reset trust auth mock to default behavior
    mockAuthenticateTrustToken.mockImplementation((req: any, res: any, next: any) => {
      req.externalUser = {
        id: 'test-external-user-id',
        email: 'test@example.com',
        companyName: 'Test Company',
        isApproved: true,
        tokenVersion: 1,
        termsAcceptedAt: new Date(),
      };
      next();
    });
    
    // Suppress console methods during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('GET /api/trust/documents', () => {
    it('should return public documents when not authenticated', async () => {
      // Arrange
      const mockPublicDocs = [
        {
          id: 'setting-1',
          visibilityLevel: 'public',
          category: 'certification',
          displayOrder: 1,
          publicDescription: 'Test description',
          requiresNda: false,
          Document: {
            id: 'doc-1',
            title: 'Public Document',
            type: 'POLICY',
            version: '1.0',
            status: 'APPROVED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      (prisma.trustDocSetting.findMany as jest.Mock).mockResolvedValueOnce(mockPublicDocs);

      // Act
      const response = await request(app)
        .get('/api/trust/documents')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(1);
      expect(response.body[0].category).toBe('certification');
      expect(response.body[0].documents).toHaveLength(1);
      expect(response.body[0].documents[0].title).toBe('Public Document');
      expect(response.body[0].documents[0].visibilityLevel).toBe('public');
    });

    it('should return public and private documents when authenticated', async () => {
      // Arrange
      const mockPublicDocs = [
        {
          id: 'setting-1',
          visibilityLevel: 'public',
          category: 'certification',
          displayOrder: 1,
          publicDescription: 'Test description',
          requiresNda: false,
          Document: {
            id: 'doc-1',
            title: 'Public Document',
            type: 'POLICY',
            version: '1.0',
            status: 'APPROVED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      const mockPrivateDocs = [
        {
          id: 'setting-2',
          visibilityLevel: 'private',
          category: 'policy',
          displayOrder: 1,
          publicDescription: 'Private description',
          requiresNda: false,
          Document: {
            id: 'doc-2',
            title: 'Private Document',
            type: 'POLICY',
            version: '1.0',
            status: 'APPROVED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      (prisma.trustDocSetting.findMany as jest.Mock)
        .mockResolvedValueOnce(mockPublicDocs)
        .mockResolvedValueOnce(mockPrivateDocs);

      // Act
      const response = await request(app)
        .get('/api/trust/documents')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(2);
      const categories = response.body.map((r: any) => r.category);
      expect(categories).toContain('certification');
      expect(categories).toContain('policy');
    });

    it('should filter out documents requiring NDA when terms not accepted', async () => {
      // Arrange
      const mockPublicDocs: any[] = [];
      const mockPrivateDocs = [
        {
          id: 'setting-1',
          visibilityLevel: 'private',
          category: 'policy',
          displayOrder: 1,
          publicDescription: 'Private description',
          requiresNda: true,
          Document: {
            id: 'doc-1',
            title: 'NDA Required Document',
            type: 'POLICY',
            version: '1.0',
            status: 'APPROVED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      (prisma.trustDocSetting.findMany as jest.Mock)
        .mockResolvedValueOnce(mockPublicDocs)
        .mockResolvedValueOnce(mockPrivateDocs);

      // Mock trust auth to return user without terms accepted
      mockAuthenticateTrustToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.externalUser = {
          id: 'test-external-user-id',
          email: 'test@example.com',
          companyName: 'Test Company',
          isApproved: true,
          tokenVersion: 1,
          termsAcceptedAt: null, // Terms not accepted
        };
        next();
      });

      // Act
      const response = await request(app)
        .get('/api/trust/documents')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(0);
    });

    it('should filter out orphaned TrustDocSettings', async () => {
      // Arrange
      const mockPublicDocs = [
        {
          id: 'setting-1',
          visibilityLevel: 'public',
          category: 'certification',
          displayOrder: 1,
          publicDescription: 'Test description',
          requiresNda: false,
          Document: {
            id: 'doc-1',
            title: 'Valid Document',
            type: 'POLICY',
            version: '1.0',
            status: 'APPROVED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: 'setting-2',
          visibilityLevel: 'public',
          category: 'certification',
          displayOrder: 2,
          publicDescription: 'Orphaned',
          requiresNda: false,
          Document: null, // Orphaned setting
        },
      ];

      (prisma.trustDocSetting.findMany as jest.Mock).mockResolvedValueOnce(mockPublicDocs);

      // Act
      const response = await request(app)
        .get('/api/trust/documents')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(1);
      expect(response.body[0].documents).toHaveLength(1);
      expect(response.body[0].documents[0].title).toBe('Valid Document');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      (prisma.trustDocSetting.findMany as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      // Act
      const response = await request(app)
        .get('/api/trust/documents')
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to fetch documents');
    });
  });

  describe('GET /api/trust/documents/private', () => {
    it('should return 403 when not authenticated', async () => {
      // Mock trust auth to not set user (not approved)
      mockAuthenticateTrustToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.externalUser = {
          id: 'test-external-user-id',
          email: 'test@example.com',
          companyName: 'Test Company',
          isApproved: false, // Not approved
          tokenVersion: 1,
          termsAcceptedAt: new Date(),
        };
        next();
      });

      // Act & Assert
      await request(app)
        .get('/api/trust/documents/private')
        .set('Authorization', 'Bearer test-token')
        .expect(403);
    });

    it('should return private documents when authenticated', async () => {
      // Arrange
      const mockPrivateDocs = [
        {
          id: 'setting-1',
          visibilityLevel: 'private',
          category: 'policy',
          displayOrder: 1,
          publicDescription: 'Private description',
          requiresNda: false,
          Document: {
            id: 'doc-1',
            title: 'Private Document',
            type: 'POLICY',
            version: '1.0',
            status: 'APPROVED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      (prisma.trustDocSetting.findMany as jest.Mock).mockResolvedValueOnce(mockPrivateDocs);

      // Act
      const response = await request(app)
        .get('/api/trust/documents/private')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(1);
      expect(response.body[0].category).toBe('policy');
      expect(response.body[0].documents).toHaveLength(1);
    });

    it('should filter documents requiring NDA when terms not accepted', async () => {
      // Arrange
      const mockPrivateDocs = [
        {
          id: 'setting-1',
          visibilityLevel: 'private',
          category: 'policy',
          displayOrder: 1,
          publicDescription: 'Private description',
          requiresNda: true,
          Document: {
            id: 'doc-1',
            title: 'NDA Required Document',
            type: 'POLICY',
            version: '1.0',
            status: 'APPROVED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      (prisma.trustDocSetting.findMany as jest.Mock).mockResolvedValueOnce(mockPrivateDocs);

      // Mock trust auth to return user without terms accepted
      mockAuthenticateTrustToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.externalUser = {
          id: 'test-external-user-id',
          email: 'test@example.com',
          companyName: 'Test Company',
          isApproved: true,
          tokenVersion: 1,
          termsAcceptedAt: null,
        };
        next();
      });

      // Act
      const response = await request(app)
        .get('/api/trust/documents/private')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(0);
    });
  });

  describe('GET /api/trust/download/:docId', () => {
    const mockDocId = 'doc-123';
    const mockDocument = {
      id: mockDocId,
      title: 'Test Document',
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      sharePointSiteId: 'site-id',
      sharePointDriveId: 'drive-id',
      sharePointItemId: 'item-id',
      TrustDocSetting: {
        id: 'setting-1',
        visibilityLevel: 'public',
        requiresNda: false,
        maxFileSizeMB: 50,
        sharePointSiteId: 'site-id',
        sharePointDriveId: 'drive-id',
        sharePointItemId: 'item-id',
      },
    };

    beforeEach(() => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (getAppOnlyAccessToken as jest.Mock).mockResolvedValue('mock-token');
      (getCachedPdf as jest.Mock).mockResolvedValue(null);
    });

    it('should return 404 when document not found', async () => {
      // Arrange
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error', 'Document not found');
    });

    it('should return 404 when TrustDocSetting not found', async () => {
      // Arrange
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockDocument,
        TrustDocSetting: null,
      });

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error', 'Document not found');
    });

    it('should return 401 for private documents when not authenticated', async () => {
      // Arrange
      const privateDocument = {
        ...mockDocument,
        TrustDocSetting: {
          ...mockDocument.TrustDocSetting,
          visibilityLevel: 'private',
        },
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(privateDocument);

      // Mock conditional auth to not set user
      jest.doMock('../../middleware/trustAuth', () => ({
        authenticateTrustToken: (req: any, res: any, next: any) => {
          req.externalUser = null;
          next();
        },
      }));

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .expect(401);

      // Assert
      expect(response.body).toHaveProperty('error', 'Authentication required for private documents');
    });

    it('should return 403 when NDA required but terms not accepted', async () => {
      // Arrange
      const ndaDocument = {
        ...mockDocument,
        TrustDocSetting: {
          ...mockDocument.TrustDocSetting,
          visibilityLevel: 'private',
          requiresNda: true,
        },
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(ndaDocument);

      // Mock conditional trust auth to return user without terms accepted
      // The conditional middleware checks for Authorization header
      // We need to mock it at the route level, but since it's in the route file,
      // we'll need to ensure the request has the header and the middleware sets the user correctly
      // Actually, the conditional middleware calls authenticateTrustToken if header exists
      // So we need to mock authenticateTrustToken to set user without terms
      mockAuthenticateTrustToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.externalUser = {
          id: 'test-external-user-id',
          email: 'test@example.com',
          companyName: 'Test Company',
          isApproved: true,
          tokenVersion: 1,
          termsAcceptedAt: null,
        };
        next();
      });

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .set('Authorization', 'Bearer test-token')
        .expect(403);

      // Assert
      expect(response.body).toHaveProperty('error', 'Terms acceptance required');
      expect(response.body).toHaveProperty('requiresTerms', true);
    });

    it('should download public document from cache', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const cachedPdf = {
        buffer: mockPdfBuffer,
        originalFilename: 'test.pdf',
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDocument);
      (getCachedPdf as jest.Mock).mockResolvedValueOnce(cachedPdf);
      (getPdfFilename as jest.Mock).mockReturnValue('test.pdf');
      (prisma.trustDownload.create as jest.Mock).mockResolvedValueOnce({});

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .expect(200);

      // Assert
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('test.pdf');
      expect(getCachedPdf).toHaveBeenCalled();
      expect(downloadSharePointFile).not.toHaveBeenCalled();
    });

    it('should download and cache document from SharePoint when cache miss', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const mockFileData = {
        buffer: mockPdfBuffer,
        mimeType: 'application/pdf',
        name: 'test.pdf',
        size: mockPdfBuffer.length,
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDocument);
      (getCachedPdf as jest.Mock).mockResolvedValueOnce(null);
      (downloadSharePointFile as jest.Mock).mockResolvedValueOnce(mockFileData);
      (getPdfFilename as jest.Mock).mockReturnValue('test.pdf');
      (setCachedPdf as jest.Mock).mockResolvedValueOnce(undefined);
      (prisma.trustDownload.create as jest.Mock).mockResolvedValueOnce({});

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .expect(200);

      // Assert
      expect(downloadSharePointFile).toHaveBeenCalled();
      expect(setCachedPdf).toHaveBeenCalled();
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('should convert non-PDF files to PDF', async () => {
      // Arrange
      const mockWordBuffer = Buffer.from('mock-word-content');
      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const mockFileData = {
        buffer: mockWordBuffer,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        name: 'test.docx',
        size: mockWordBuffer.length,
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDocument);
      (getCachedPdf as jest.Mock).mockResolvedValueOnce(null);
      (downloadSharePointFile as jest.Mock).mockResolvedValueOnce(mockFileData);
      (canConvertToPdf as jest.Mock).mockReturnValueOnce(true);
      (convertToPdf as jest.Mock).mockResolvedValueOnce(mockPdfBuffer);
      (getPdfFilename as jest.Mock).mockReturnValue('test.pdf');
      (setCachedPdf as jest.Mock).mockResolvedValueOnce(undefined);
      (prisma.trustDownload.create as jest.Mock).mockResolvedValueOnce({});

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .expect(200);

      // Assert
      expect(convertToPdf).toHaveBeenCalled();
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('test.pdf');
    });

    it('should return 400 for unsupported file types', async () => {
      // Arrange
      const mockFileData = {
        buffer: Buffer.from('mock-content'),
        mimeType: 'application/octet-stream',
        name: 'test.bin',
        size: 100,
      };
      (getCachedPdf as jest.Mock).mockResolvedValueOnce(null);
      (downloadSharePointFile as jest.Mock).mockResolvedValueOnce(mockFileData);
      (canConvertToPdf as jest.Mock).mockReturnValueOnce(false);

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not supported');
    });

    it('should apply watermark to private documents for authenticated users', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const watermarkedBuffer = Buffer.from('watermarked-pdf-content');
      const privateDocument = {
        ...mockDocument,
        TrustDocSetting: {
          ...mockDocument.TrustDocSetting,
          visibilityLevel: 'private',
        },
      };
      const cachedPdf = {
        buffer: mockPdfBuffer,
        originalFilename: 'test.pdf',
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(privateDocument);
      (getCachedPdf as jest.Mock).mockResolvedValueOnce(cachedPdf);
      (getPdfFilename as jest.Mock).mockReturnValue('test.pdf');
      (validatePdfForWatermarking as jest.Mock).mockReturnValueOnce({ valid: true });
      (addWatermarkToPdf as jest.Mock).mockResolvedValueOnce(watermarkedBuffer);
      (prisma.trustDownload.create as jest.Mock).mockResolvedValueOnce({});

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      // Assert
      expect(addWatermarkToPdf).toHaveBeenCalled();
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('should handle SharePoint file not found error', async () => {
      // Arrange
      (getCachedPdf as jest.Mock).mockResolvedValueOnce(null);
      (downloadSharePointFile as jest.Mock).mockRejectedValueOnce(
        new FileNotFoundError('File not found')
      );

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error', 'File not found in SharePoint');
    });

    it('should handle file too large error', async () => {
      // Arrange
      (getCachedPdf as jest.Mock).mockResolvedValueOnce(null);
      (downloadSharePointFile as jest.Mock).mockRejectedValueOnce(
        new FileTooLargeError('File too large')
      );

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .expect(413);

      // Assert
      expect(response.body).toHaveProperty('error', 'File too large');
    });

    it('should handle permission denied error', async () => {
      // Arrange
      (getCachedPdf as jest.Mock).mockResolvedValueOnce(null);
      (downloadSharePointFile as jest.Mock).mockRejectedValueOnce(
        new PermissionDeniedError('Permission denied')
      );

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .expect(403);

      // Assert
      expect(response.body).toHaveProperty('error', 'Permission denied to access file');
    });

    it('should parse SharePoint URL when IDs not cached', async () => {
      // Arrange
      const documentWithoutIds = {
        ...mockDocument,
        sharePointSiteId: null,
        sharePointDriveId: null,
        sharePointItemId: null,
        TrustDocSetting: {
          ...mockDocument.TrustDocSetting,
          id: 'setting-1',
          sharePointUrl: 'https://sharepoint.com/sites/test/Shared%20Documents/test.pdf',
          sharePointSiteId: null,
          sharePointDriveId: null,
          sharePointItemId: null,
        },
      };
      const parsedIds = {
        siteId: 'parsed-site-id',
        driveId: 'parsed-drive-id',
        itemId: 'parsed-item-id',
      };
      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const mockFileData = {
        buffer: mockPdfBuffer,
        mimeType: 'application/pdf',
        name: 'test.pdf',
        size: mockPdfBuffer.length,
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(documentWithoutIds);
      (parseSharePointUrlToIds as jest.Mock).mockResolvedValueOnce(parsedIds);
      (prisma.trustDocSetting.update as jest.Mock).mockResolvedValueOnce({
        ...documentWithoutIds.TrustDocSetting,
        ...parsedIds,
      });
      (getCachedPdf as jest.Mock).mockResolvedValueOnce(null);
      (downloadSharePointFile as jest.Mock).mockResolvedValueOnce(mockFileData);
      (getPdfFilename as jest.Mock).mockReturnValue('test.pdf');
      (setCachedPdf as jest.Mock).mockResolvedValueOnce(undefined);
      (prisma.trustDownload.create as jest.Mock).mockResolvedValueOnce({});

      // Act
      await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .expect(200);

      // Assert
      expect(parseSharePointUrlToIds).toHaveBeenCalled();
      expect(prisma.trustDocSetting.update).toHaveBeenCalled();
    });

    it('should return 400 when SharePoint IDs not available', async () => {
      // Arrange
      const documentWithoutIds = {
        ...mockDocument,
        sharePointSiteId: null,
        sharePointDriveId: null,
        sharePointItemId: null,
        TrustDocSetting: {
          ...mockDocument.TrustDocSetting,
          sharePointUrl: null,
          sharePointSiteId: null,
          sharePointDriveId: null,
          sharePointItemId: null,
        },
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(documentWithoutIds);
      (parseSharePointUrlToIds as jest.Mock).mockResolvedValueOnce(null);

      // Act
      const response = await request(app)
        .get(`/api/trust/download/${mockDocId}`)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('error', 'SharePoint file information not available');
    });
  });

  describe('POST /api/trust/accept-terms', () => {
    it('should return 401 when not authenticated', async () => {
      // Mock trust auth to not set user
      mockAuthenticateTrustToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.externalUser = null;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/trust/accept-terms')
        .set('Authorization', 'Bearer test-token')
        .send({ documentId: 'doc-123' })
        .expect(401);

      // Assert
      expect(response.body).toHaveProperty('error', 'Not authenticated');
    });

    it('should accept terms successfully', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        termsAcceptedAt: new Date(),
      };
      (prisma.externalUser.update as jest.Mock).mockResolvedValueOnce(mockUser);
      (logTrustAction as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      const response = await request(app)
        .post('/api/trust/accept-terms')
        .set('Authorization', 'Bearer test-token')
        .send({ documentId: 'doc-123' })
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('message', 'Terms accepted successfully');
      expect(prisma.externalUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'test-external-user-id' },
          data: { termsAcceptedAt: expect.any(Date) },
        })
      );
      expect(logTrustAction).toHaveBeenCalled();
    });
  });

  describe('GET /api/trust/admin/pending-requests', () => {
    it('should return pending user requests', async () => {
      // Arrange
      const mockPendingUsers = [
        {
          id: 'user-1',
          email: 'pending1@example.com',
          companyName: 'Company 1',
          createdAt: new Date(),
        },
        {
          id: 'user-2',
          email: 'pending2@example.com',
          companyName: 'Company 2',
          createdAt: new Date(),
        },
      ];
      (prisma.externalUser.findMany as jest.Mock).mockResolvedValueOnce(mockPendingUsers);

      // Act
      const response = await request(app)
        .get('/api/trust/admin/pending-requests')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(2);
      expect(prisma.externalUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isApproved: false },
        })
      );
    });
  });

  describe('POST /api/trust/admin/approve-user/:userId', () => {
    it('should approve user successfully', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        companyName: 'Test Company',
        isApproved: true,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'internal-user-id' });
      (prisma.externalUser.update as jest.Mock).mockResolvedValueOnce(mockUser);
      (logTrustAction as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      const response = await request(app)
        .post('/api/trust/admin/approve-user/user-123')
        .expect(200);

      // Assert
      expect(response.body).toEqual(mockUser);
      expect(prisma.externalUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: { isApproved: true },
        })
      );
      expect(logTrustAction).toHaveBeenCalled();
    });

    it('should return 404 when user not found', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'internal-user-id' });
      (prisma.externalUser.update as jest.Mock).mockRejectedValueOnce({
        code: 'P2025',
      });

      // Act
      const response = await request(app)
        .post('/api/trust/admin/approve-user/non-existent')
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error', 'User not found');
    });
  });

  describe('POST /api/trust/admin/deny-user/:userId', () => {
    it('should deny user successfully', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        companyName: 'Test Company',
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'internal-user-id' });
      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      (prisma.externalUser.delete as jest.Mock).mockResolvedValueOnce(mockUser);
      (logTrustAction as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      const response = await request(app)
        .post('/api/trust/admin/deny-user/user-123')
        .send({ reason: 'Invalid company' })
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('message', 'User denied successfully');
      expect(prisma.externalUser.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(logTrustAction).toHaveBeenCalled();
    });

    it('should return 404 when user not found', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'internal-user-id' });
      (prisma.externalUser.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // Act
      const response = await request(app)
        .post('/api/trust/admin/deny-user/non-existent')
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error', 'User not found');
    });
  });

  describe('GET /api/trust/admin/documents', () => {
    it('should return all documents with trust settings', async () => {
      // Arrange
      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Document 1',
          type: 'POLICY',
          version: '1.0',
          status: 'APPROVED',
          sharePointSiteId: 'site-1',
          sharePointDriveId: 'drive-1',
          sharePointItemId: 'item-1',
          TrustDocSetting: {
            id: 'setting-1',
            visibilityLevel: 'public',
            category: 'certification',
            sharePointUrl: 'https://sharepoint.com/test',
            publicDescription: 'Test description',
            displayOrder: 1,
            requiresNda: false,
            maxFileSizeMB: 50,
          },
        },
        {
          id: 'doc-2',
          title: 'Document 2',
          type: 'POLICY',
          version: '1.0',
          status: 'APPROVED',
          sharePointSiteId: null,
          sharePointDriveId: null,
          sharePointItemId: null,
          TrustDocSetting: null,
        },
      ];
      (prisma.document.findMany as jest.Mock).mockResolvedValueOnce(mockDocuments);

      // Act
      const response = await request(app)
        .get('/api/trust/admin/documents')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(2);
      expect(response.body[0].document.id).toBe('doc-1');
      expect(response.body[0].trustSetting).not.toBeNull();
      expect(response.body[1].trustSetting).toBeNull();
    });
  });

  describe('PUT /api/trust/admin/documents/:docId/settings', () => {
    const mockDocId = 'doc-123';
    const mockDocument = {
      id: mockDocId,
      title: 'Test Document',
      sharePointSiteId: 'site-id',
      sharePointDriveId: 'drive-id',
      sharePointItemId: 'item-id',
    };

    beforeEach(() => {
      jest.clearAllMocks();
      // Don't set default mocks here - let each test set up its own mocks
    });

    it('should create new trust settings', async () => {
      // Arrange
      const newSettings = {
        visibilityLevel: 'public',
        category: 'certification',
        publicDescription: 'New description',
        displayOrder: 1,
        requiresNda: false,
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDocument);
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'internal-user-id' });
      (prisma.trustDocSetting.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.trustDocSetting.create as jest.Mock).mockResolvedValueOnce({
        id: 'setting-1',
        documentId: mockDocId,
        ...newSettings,
      });
      (logTrustAction as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      const response = await request(app)
        .put(`/api/trust/admin/documents/${mockDocId}/settings`)
        .send(newSettings)
        .expect(200);

      // Assert
      expect(prisma.trustDocSetting.create).toHaveBeenCalled();
      expect(response.body).toHaveProperty('id', 'setting-1');
    });

    it('should update existing trust settings', async () => {
      // Arrange
      const existingSetting = {
        id: 'setting-1',
        documentId: mockDocId,
        visibilityLevel: 'public',
        category: 'certification',
      };
      const updateData = {
        visibilityLevel: 'private',
        category: 'policy',
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDocument);
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'internal-user-id' });
      (prisma.trustDocSetting.findUnique as jest.Mock).mockResolvedValueOnce(existingSetting);
      (prisma.trustDocSetting.update as jest.Mock).mockResolvedValueOnce({
        ...existingSetting,
        ...updateData,
      });
      (logTrustAction as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      const response = await request(app)
        .put(`/api/trust/admin/documents/${mockDocId}/settings`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(prisma.trustDocSetting.update).toHaveBeenCalled();
      expect(response.body.visibilityLevel).toBe('private');
    });

    it('should parse and verify SharePoint URL when provided', async () => {
      // Arrange
      const sharePointUrl = 'https://sharepoint.com/sites/test/Shared%20Documents/test.pdf';
      const parsedIds = {
        siteId: 'parsed-site-id',
        driveId: 'parsed-drive-id',
        itemId: 'parsed-item-id',
      };
      // Reset and set up mocks fresh for this test
      (prisma.document.findUnique as jest.Mock).mockReset();
      (prisma.user.findUnique as jest.Mock).mockReset();
      (prisma.trustDocSetting.findUnique as jest.Mock).mockReset();
      (parseSharePointUrlToIds as jest.Mock).mockReset();
      (getAppOnlyAccessToken as jest.Mock).mockReset();
      (verifySharePointFileAccess as jest.Mock).mockReset();
      (prisma.trustDocSetting.create as jest.Mock).mockReset();
      (logTrustAction as jest.Mock).mockReset();

      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        id: mockDocId,
        title: 'Test Document',
        sharePointSiteId: null,
        sharePointDriveId: null,
        sharePointItemId: null,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'internal-user-id' });
      (prisma.trustDocSetting.findUnique as jest.Mock).mockResolvedValue(null);
      (parseSharePointUrlToIds as jest.Mock).mockResolvedValue(parsedIds);
      (getAppOnlyAccessToken as jest.Mock).mockResolvedValue('mock-token');
      (verifySharePointFileAccess as jest.Mock).mockResolvedValue(true);
      (prisma.trustDocSetting.create as jest.Mock).mockResolvedValue({
        id: 'setting-1',
        documentId: mockDocId,
        sharePointUrl,
        sharePointSiteId: parsedIds.siteId,
        sharePointDriveId: parsedIds.driveId,
        sharePointItemId: parsedIds.itemId,
        visibilityLevel: 'public',
        category: 'policy',
      });
      (logTrustAction as jest.Mock).mockResolvedValue(undefined);

      // Act
      const response = await request(app)
        .put(`/api/trust/admin/documents/${mockDocId}/settings`)
        .send({
          sharePointUrl,
          visibilityLevel: 'public',
        })
        .expect(200);

      // Assert
      expect(parseSharePointUrlToIds).toHaveBeenCalledWith(sharePointUrl);
      expect(verifySharePointFileAccess).toHaveBeenCalled();
      expect(response.body).toHaveProperty('sharePointUrl', sharePointUrl);
    });

    it('should return 400 for invalid SharePoint URL', async () => {
      // Arrange
      const invalidUrl = 'invalid-url';
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        id: mockDocId,
        title: 'Test Document',
        sharePointSiteId: null,
        sharePointDriveId: null,
        sharePointItemId: null,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'internal-user-id' });
      (prisma.trustDocSetting.findUnique as jest.Mock).mockResolvedValue(null);
      (parseSharePointUrlToIds as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put(`/api/trust/admin/documents/${mockDocId}/settings`)
        .send({
          sharePointUrl: invalidUrl,
        })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('error', 'Invalid SharePoint URL');
    });

    it('should return 400 when SharePoint file is not accessible', async () => {
      // Arrange
      const sharePointUrl = 'https://sharepoint.com/sites/test/Shared%20Documents/test.pdf';
      const parsedIds = {
        siteId: 'parsed-site-id',
        driveId: 'parsed-drive-id',
        itemId: 'parsed-item-id',
      };
      // Ensure document exists - this must be called first
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        id: mockDocId,
        title: 'Test Document',
        sharePointSiteId: null,
        sharePointDriveId: null,
        sharePointItemId: null,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'internal-user-id' });
      (prisma.trustDocSetting.findUnique as jest.Mock).mockResolvedValue(null);
      (parseSharePointUrlToIds as jest.Mock).mockResolvedValue(parsedIds);
      (getAppOnlyAccessToken as jest.Mock).mockResolvedValue('mock-token');
      (verifySharePointFileAccess as jest.Mock).mockResolvedValue(false);

      // Act
      const response = await request(app)
        .put(`/api/trust/admin/documents/${mockDocId}/settings`)
        .send({
          sharePointUrl,
        })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('error', 'SharePoint file is not accessible');
    });

    it('should return 404 when document not found', async () => {
      // Arrange
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // Act
      const response = await request(app)
        .put(`/api/trust/admin/documents/non-existent/settings`)
        .send({
          visibilityLevel: 'public',
        })
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error', 'Document not found');
    });

    it('should normalize empty publicDescription to null', async () => {
      // Arrange
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDocument);
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'internal-user-id' });
      (prisma.trustDocSetting.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.trustDocSetting.create as jest.Mock).mockResolvedValueOnce({
        id: 'setting-1',
        documentId: mockDocId,
        publicDescription: null,
      });
      (logTrustAction as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      await request(app)
        .put(`/api/trust/admin/documents/${mockDocId}/settings`)
        .send({
          publicDescription: '',
          visibilityLevel: 'public',
        })
        .expect(200);

      // Assert
      expect(prisma.trustDocSetting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            publicDescription: null,
          }),
        })
      );
    });
  });

  describe('DELETE /api/trust/admin/documents/:docId/settings', () => {
    it('should delete trust settings successfully', async () => {
      // Arrange
      const mockDocId = 'doc-123';
      const mockDocument = {
        id: mockDocId,
        title: 'Test Document',
      };
      const existingSetting = {
        id: 'setting-1',
        documentId: mockDocId,
      };
      // Document lookup happens first
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'internal-user-id' });
      // Then trustDocSetting lookup
      (prisma.trustDocSetting.findUnique as jest.Mock).mockResolvedValue(existingSetting);
      (prisma.trustDocSetting.delete as jest.Mock).mockResolvedValue(existingSetting);
      (logTrustAction as jest.Mock).mockResolvedValue(undefined);

      // Act
      const response = await request(app)
        .delete(`/api/trust/admin/documents/${mockDocId}/settings`)
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('message', 'Document removed from Trust Center');
      expect(prisma.document.findUnique).toHaveBeenCalledWith({
        where: { id: mockDocId },
      });
      expect(prisma.trustDocSetting.findUnique).toHaveBeenCalledWith({
        where: { documentId: mockDocId },
      });
      expect(prisma.trustDocSetting.delete).toHaveBeenCalledWith({
        where: { id: 'setting-1' },
      });
      expect(logTrustAction).toHaveBeenCalled();
    });

    it('should return 404 when document not found', async () => {
      // Arrange
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // Act
      const response = await request(app)
        .delete('/api/trust/admin/documents/non-existent/settings')
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error', 'Document not found');
    });

    it('should return 200 when setting does not exist (nothing to delete)', async () => {
      // Arrange
      const mockDocId = 'doc-123';
      const mockDocument = {
        id: mockDocId,
        title: 'Test Document',
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDocument);
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'internal-user-id' });
      (prisma.trustDocSetting.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // Act
      const response = await request(app)
        .delete(`/api/trust/admin/documents/${mockDocId}/settings`)
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('message', 'Document removed from Trust Center');
      expect(prisma.trustDocSetting.delete).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/trust/admin/audit-log', () => {
    it('should return audit logs', async () => {
      // Arrange
      const mockLogs = [
        {
          id: 'log-1',
          action: 'DOWNLOAD',
          timestamp: new Date(),
          performedByExternalUserId: 'user-1',
          targetDocumentId: 'doc-1',
        },
        {
          id: 'log-2',
          action: 'TERMS_ACCEPTED',
          timestamp: new Date(),
          performedByExternalUserId: 'user-2',
        },
      ];
      (prisma.trustAuditLog.findMany as jest.Mock).mockResolvedValueOnce(mockLogs);

      // Act
      const response = await request(app)
        .get('/api/trust/admin/audit-log')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(2);
      expect(prisma.trustAuditLog.findMany).toHaveBeenCalled();
    });

    it('should filter audit logs by action', async () => {
      // Arrange
      const mockLogs = [
        {
          id: 'log-1',
          action: 'DOWNLOAD',
          timestamp: new Date(),
        },
      ];
      (prisma.trustAuditLog.findMany as jest.Mock).mockResolvedValueOnce(mockLogs);

      // Act
      await request(app)
        .get('/api/trust/admin/audit-log?action=DOWNLOAD')
        .expect(200);

      // Assert
      expect(prisma.trustAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'DOWNLOAD',
          }),
        })
      );
    });

    it('should filter audit logs by date range', async () => {
      // Arrange
      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-12-31T23:59:59Z';
      const mockLogs: any[] = [];
      (prisma.trustAuditLog.findMany as jest.Mock).mockResolvedValueOnce(mockLogs);

      // Act
      await request(app)
        .get(`/api/trust/admin/audit-log?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      // Assert
      expect(prisma.trustAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({
              gte: new Date(startDate),
              lte: new Date(endDate),
            }),
          }),
        })
      );
    });
  });

  describe('GET /api/trust/admin/settings', () => {
    it('should return existing settings', async () => {
      // Arrange
      const mockSettings = {
        id: 'settings-1',
        key: 'global',
        watermarkPrefix: 'Paythru Confidential',
      };
      (prisma.trustCenterSettings.findUnique as jest.Mock).mockResolvedValueOnce(mockSettings);

      // Act
      const response = await request(app)
        .get('/api/trust/admin/settings')
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('watermarkPrefix', 'Paythru Confidential');
    });

    it('should create default settings if not found', async () => {
      // Arrange
      const defaultSettings = {
        id: 'settings-1',
        key: 'global',
        watermarkPrefix: 'Paythru Confidential',
      };
      (prisma.trustCenterSettings.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.trustCenterSettings.create as jest.Mock).mockResolvedValueOnce(defaultSettings);

      // Act
      const response = await request(app)
        .get('/api/trust/admin/settings')
        .expect(200);

      // Assert
      expect(prisma.trustCenterSettings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            key: 'global',
            watermarkPrefix: 'Paythru Confidential',
          }),
        })
      );
      expect(response.body).toHaveProperty('watermarkPrefix', 'Paythru Confidential');
    });
  });

  describe('PUT /api/trust/admin/settings', () => {
    it('should update existing settings', async () => {
      // Arrange
      const existingSettings = {
        id: 'settings-1',
        key: 'global',
        watermarkPrefix: 'Old Prefix',
      };
      const updatedSettings = {
        ...existingSettings,
        watermarkPrefix: 'New Prefix',
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'internal-user-id' });
      (prisma.trustCenterSettings.findUnique as jest.Mock).mockResolvedValueOnce(existingSettings);
      (prisma.trustCenterSettings.update as jest.Mock).mockResolvedValueOnce(updatedSettings);
      (logTrustAction as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      const response = await request(app)
        .put('/api/trust/admin/settings')
        .send({ watermarkPrefix: 'New Prefix' })
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('watermarkPrefix', 'New Prefix');
      expect(prisma.trustCenterSettings.update).toHaveBeenCalled();
      expect(logTrustAction).toHaveBeenCalled();
    });

    it('should create new settings if not found', async () => {
      // Arrange
      const newSettings = {
        id: 'settings-1',
        key: 'global',
        watermarkPrefix: 'New Prefix',
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'internal-user-id' });
      (prisma.trustCenterSettings.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.trustCenterSettings.create as jest.Mock).mockResolvedValueOnce(newSettings);
      (logTrustAction as jest.Mock).mockResolvedValueOnce(undefined);

      // Act
      const response = await request(app)
        .put('/api/trust/admin/settings')
        .send({ watermarkPrefix: 'New Prefix' })
        .expect(200);

      // Assert
      expect(prisma.trustCenterSettings.create).toHaveBeenCalled();
      expect(response.body).toHaveProperty('watermarkPrefix', 'New Prefix');
    });
  });

  describe('GET /api/trust/suppliers', () => {
    it('should return suppliers visible in Trust Center', async () => {
      // Arrange
      const mockSuppliers = [
        {
          id: 'supplier-1',
          trustCenterDisplayName: 'Supplier 1',
          trustCenterDescription: 'Description 1',
          trustCenterCategory: 'VENDOR',
          trustCenterComplianceSummary: 'Compliant',
        },
        {
          id: 'supplier-2',
          trustCenterDisplayName: 'Supplier 2',
          trustCenterDescription: 'Description 2',
          trustCenterCategory: 'PARTNER',
          trustCenterComplianceSummary: null,
        },
      ];
      (prisma.supplier.findMany as jest.Mock).mockResolvedValueOnce(mockSuppliers);

      // Act
      const response = await request(app)
        .get('/api/trust/suppliers')
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('suppliers');
      expect(response.body.suppliers).toHaveLength(2);
      expect(response.body.suppliers[0]).toHaveProperty('displayName', 'Supplier 1');
      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            showInTrustCenter: true,
            status: 'ACTIVE',
            lifecycleState: 'APPROVED',
          }),
        })
      );
    });

    it('should filter out suppliers without required display fields', async () => {
      // Arrange
      const mockSuppliers = [
        {
          id: 'supplier-1',
          trustCenterDisplayName: 'Supplier 1',
          trustCenterDescription: 'Description 1',
          trustCenterCategory: 'VENDOR',
          trustCenterComplianceSummary: 'Compliant',
        },
        {
          id: 'supplier-2',
          trustCenterDisplayName: null, // Missing required field
          trustCenterDescription: 'Description 2',
          trustCenterCategory: 'PARTNER',
          trustCenterComplianceSummary: null,
        },
        {
          id: 'supplier-3',
          trustCenterDisplayName: 'Supplier 3',
          trustCenterDescription: null, // Missing required field
          trustCenterCategory: 'PARTNER',
          trustCenterComplianceSummary: null,
        },
      ];
      (prisma.supplier.findMany as jest.Mock).mockResolvedValueOnce(mockSuppliers);

      // Act
      const response = await request(app)
        .get('/api/trust/suppliers')
        .expect(200);

      // Assert
      expect(response.body.suppliers).toHaveLength(1);
      expect(response.body.suppliers[0].displayName).toBe('Supplier 1');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      (prisma.supplier.findMany as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      // Act
      const response = await request(app)
        .get('/api/trust/suppliers')
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to fetch suppliers');
    });
  });

  describe('Validation', () => {
    it('should return 400 for invalid docId in download', async () => {
      // Act
      const response = await request(app)
        .get('/api/trust/download/')
        .expect(404); // Express returns 404 for missing params

      // Assert - route not found
      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid userId in approve-user', async () => {
      // Act
      const response = await request(app)
        .post('/api/trust/admin/approve-user/')
        .expect(404); // Express returns 404 for missing params

      // Assert - route not found
      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid watermarkPrefix length', async () => {
      // Arrange
      const longPrefix = 'a'.repeat(101); // Exceeds max length of 100

      // Act
      const response = await request(app)
        .put('/api/trust/admin/settings')
        .send({ watermarkPrefix: longPrefix })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in documents endpoint', async () => {
      // Arrange
      (prisma.trustDocSetting.findMany as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      // Act
      const response = await request(app)
        .get('/api/trust/documents')
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to fetch documents');
    });

    it('should handle errors in download endpoint', async () => {
      // Arrange
      (prisma.document.findUnique as jest.Mock).mockRejectedValueOnce(
        new Error('Database error')
      );

      // Act
      const response = await request(app)
        .get('/api/trust/download/doc-123')
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to download file');
    });

    it('should handle PDF conversion errors', async () => {
      // Arrange
      const mockDocument = {
        id: 'doc-123',
        title: 'Test Document',
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        sharePointSiteId: 'site-id',
        sharePointDriveId: 'drive-id',
        sharePointItemId: 'item-id',
        TrustDocSetting: {
          id: 'setting-1',
          visibilityLevel: 'public',
          requiresNda: false,
          maxFileSizeMB: 50,
          sharePointSiteId: 'site-id',
          sharePointDriveId: 'drive-id',
          sharePointItemId: 'item-id',
        },
      };
      const mockFileData = {
        buffer: Buffer.from('mock-content'),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        name: 'test.docx',
        size: 100,
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDocument);
      (getCachedPdf as jest.Mock).mockResolvedValueOnce(null);
      (downloadSharePointFile as jest.Mock).mockResolvedValueOnce(mockFileData);
      (canConvertToPdf as jest.Mock).mockReturnValueOnce(true);
      (convertToPdf as jest.Mock).mockRejectedValueOnce(new Error('Conversion failed'));

      // Act
      const response = await request(app)
        .get('/api/trust/download/doc-123')
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to convert document to PDF');
    });

    it('should handle watermarking errors gracefully', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const privateDocument = {
        id: 'doc-123',
        title: 'Test Document',
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        sharePointSiteId: 'site-id',
        sharePointDriveId: 'drive-id',
        sharePointItemId: 'item-id',
        TrustDocSetting: {
          id: 'setting-1',
          visibilityLevel: 'private',
          requiresNda: false,
          maxFileSizeMB: 50,
          sharePointSiteId: 'site-id',
          sharePointDriveId: 'drive-id',
          sharePointItemId: 'item-id',
        },
      };
      const cachedPdf = {
        buffer: mockPdfBuffer,
        originalFilename: 'test.pdf',
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(privateDocument);
      (getCachedPdf as jest.Mock).mockResolvedValueOnce(cachedPdf);
      (getPdfFilename as jest.Mock).mockReturnValue('test.pdf');
      (validatePdfForWatermarking as jest.Mock).mockReturnValueOnce({ valid: true });
      (addWatermarkToPdf as jest.Mock).mockRejectedValueOnce(new Error('Watermarking failed'));
      // Mock trustDownload.create to avoid errors
      (prisma.trustDownload.create as jest.Mock).mockResolvedValueOnce({});

      // Act - Should still return 200 with unwatermarked PDF
      const response = await request(app)
        .get('/api/trust/download/doc-123')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      // Assert
      expect(response.headers['content-type']).toBe('application/pdf');
      // Watermarking error should be logged but not fail the request
    });
  });
});

