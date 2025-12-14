/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  getCachedPdf,
  setCachedPdf,
  invalidateCache,
  cleanupCache,
} from '../pdfCacheService';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  cwd: jest.fn(() => '/test/workspace'),
}));

// Mock crypto module
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'mock-hash-value'),
    })),
  })),
}));

// Mock console methods to avoid noise in test output
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('pdfCacheService', () => {
  let mockFs: any;
  let mockPath: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs = require('fs');
    mockPath = require('path');

    // Reset path.join to default behavior
    (mockPath.join as jest.Mock).mockImplementation((...args: string[]) => args.join('/'));
    (mockPath.cwd as jest.Mock).mockReturnValue('/test/workspace');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('getCachedPdf', () => {
    const documentId = 'doc-123';
    const version = 'v1.0';
    const updatedAt = new Date('2024-01-01T00:00:00Z');
    const originalFilename = 'test-document.pdf';
    const pdfBuffer = Buffer.from('mock-pdf-content');

    it('should return null when PDF file does not exist', async () => {
      // Arrange
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, false);

      // Assert
      expect(result).toBeNull();
      expect(mockFs.existsSync).toHaveBeenCalled();
    });

    it('should return null when metadata file does not exist', async () => {
      // Arrange
      (mockFs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('.pdf');
      });

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, false);

      // Assert
      expect(result).toBeNull();
    });

    it('should return cached PDF when cache is valid and not watermarked', async () => {
      // Arrange
      const metadata = {
        documentId,
        version,
        updatedAt: updatedAt.toISOString(),
        convertedAt: new Date().toISOString(),
        originalMimeType: 'application/pdf',
        originalFilename,
        fileSize: pdfBuffer.length,
        isWatermarked: false,
      };

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('.meta.json')) {
          return JSON.stringify(metadata);
        }
        if (filePath.includes('.pdf')) {
          return pdfBuffer;
        }
        return '';
      });
      (mockFs.statSync as jest.Mock).mockReturnValue({
        size: pdfBuffer.length,
      });

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, false);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.buffer).toEqual(pdfBuffer);
      expect(result?.originalFilename).toBe(originalFilename);
    });

    it('should return cached PDF when cache is valid and watermarked', async () => {
      // Arrange
      const watermarkUserEmail = 'user@example.com';
      const metadata = {
        documentId,
        version,
        updatedAt: updatedAt.toISOString(),
        convertedAt: new Date().toISOString(),
        originalMimeType: 'application/pdf',
        originalFilename,
        fileSize: pdfBuffer.length,
        isWatermarked: true,
        watermarkUserEmail,
      };

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('.meta.json')) {
          return JSON.stringify(metadata);
        }
        if (filePath.includes('.pdf')) {
          return pdfBuffer;
        }
        return '';
      });
      (mockFs.statSync as jest.Mock).mockReturnValue({
        size: pdfBuffer.length,
      });

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, true, watermarkUserEmail);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.buffer).toEqual(pdfBuffer);
      expect(result?.originalFilename).toBe(originalFilename);
    });

    it('should return null and remove cache when documentId does not match', async () => {
      // Arrange
      const metadata = {
        documentId: 'different-doc-id',
        version,
        updatedAt: updatedAt.toISOString(),
        convertedAt: new Date().toISOString(),
        originalMimeType: 'application/pdf',
        originalFilename,
        fileSize: pdfBuffer.length,
        isWatermarked: false,
      };

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(metadata));

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, false);

      // Assert
      expect(result).toBeNull();
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should return null and remove cache when version does not match', async () => {
      // Arrange
      const metadata = {
        documentId,
        version: 'v2.0',
        updatedAt: updatedAt.toISOString(),
        convertedAt: new Date().toISOString(),
        originalMimeType: 'application/pdf',
        originalFilename,
        fileSize: pdfBuffer.length,
        isWatermarked: false,
      };

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(metadata));

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, false);

      // Assert
      expect(result).toBeNull();
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should return null and remove cache when updatedAt does not match', async () => {
      // Arrange
      const differentDate = new Date('2024-01-02T00:00:00Z');
      const metadata = {
        documentId,
        version,
        updatedAt: differentDate.toISOString(),
        convertedAt: new Date().toISOString(),
        originalMimeType: 'application/pdf',
        originalFilename,
        fileSize: pdfBuffer.length,
        isWatermarked: false,
      };

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(metadata));

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, false);

      // Assert
      expect(result).toBeNull();
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should return null and remove cache when isWatermarked does not match', async () => {
      // Arrange
      const metadata = {
        documentId,
        version,
        updatedAt: updatedAt.toISOString(),
        convertedAt: new Date().toISOString(),
        originalMimeType: 'application/pdf',
        originalFilename,
        fileSize: pdfBuffer.length,
        isWatermarked: true, // Different from request (false)
      };

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(metadata));

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, false);

      // Assert
      expect(result).toBeNull();
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should return null and remove cache when watermark email does not match for watermarked document', async () => {
      // Arrange
      const metadata = {
        documentId,
        version,
        updatedAt: updatedAt.toISOString(),
        convertedAt: new Date().toISOString(),
        originalMimeType: 'application/pdf',
        originalFilename,
        fileSize: pdfBuffer.length,
        isWatermarked: true,
        watermarkUserEmail: 'different@example.com',
      };

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(metadata));

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, true, 'user@example.com');

      // Assert
      expect(result).toBeNull();
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should return null and remove cache when watermark email exists for non-watermarked document', async () => {
      // Arrange
      const metadata = {
        documentId,
        version,
        updatedAt: updatedAt.toISOString(),
        convertedAt: new Date().toISOString(),
        originalMimeType: 'application/pdf',
        originalFilename,
        fileSize: pdfBuffer.length,
        isWatermarked: false,
        watermarkUserEmail: 'user@example.com', // Should not exist for non-watermarked
      };

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(metadata));

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, false);

      // Assert
      expect(result).toBeNull();
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should return null and remove cache when file size does not match', async () => {
      // Arrange
      const metadata = {
        documentId,
        version,
        updatedAt: updatedAt.toISOString(),
        convertedAt: new Date().toISOString(),
        originalMimeType: 'application/pdf',
        originalFilename,
        fileSize: pdfBuffer.length,
        isWatermarked: false,
      };

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(metadata));
      (mockFs.statSync as jest.Mock).mockReturnValue({
        size: pdfBuffer.length + 100, // Different size
      });

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, false);

      // Assert
      expect(result).toBeNull();
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should return null when error occurs during cache read', async () => {
      // Arrange
      (mockFs.existsSync as jest.Mock).mockImplementation(() => {
        throw new Error('File system error');
      });

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, false);

      // Assert
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle errors gracefully when removing stale cache', async () => {
      // Arrange
      const metadata = {
        documentId: 'different-doc-id',
        version,
        updatedAt: updatedAt.toISOString(),
        convertedAt: new Date().toISOString(),
        originalMimeType: 'application/pdf',
        originalFilename,
        fileSize: pdfBuffer.length,
        isWatermarked: false,
      };

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(metadata));
      (mockFs.unlinkSync as jest.Mock).mockImplementation(() => {
        throw new Error('Delete failed');
      });

      // Act
      const result = await getCachedPdf(documentId, version, updatedAt, false);

      // Assert
      expect(result).toBeNull();
      // Should not throw, error should be caught
    });
  });

  describe('setCachedPdf', () => {
    const documentId = 'doc-123';
    const version = 'v1.0';
    const updatedAt = new Date('2024-01-01T00:00:00Z');
    const pdfBuffer = Buffer.from('mock-pdf-content');
    const originalMimeType = 'application/pdf';
    const originalFilename = 'test-document.pdf';

    it('should cache PDF successfully for non-watermarked document', async () => {
      // Arrange
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});

      // Act
      await setCachedPdf(
        documentId,
        version,
        updatedAt,
        pdfBuffer,
        originalMimeType,
        originalFilename,
        false
      );

      // Assert
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2); // PDF and metadata
      const metadataCall = (mockFs.writeFileSync as jest.Mock).mock.calls.find((call: any[]) =>
        call[0].includes('.meta.json')
      );
      expect(metadataCall).toBeDefined();
      const metadata = JSON.parse(metadataCall[1]);
      expect(metadata.documentId).toBe(documentId);
      expect(metadata.version).toBe(version);
      expect(metadata.originalFilename).toBe(originalFilename);
      expect(metadata.isWatermarked).toBe(false);
      expect(metadata.watermarkUserEmail).toBeUndefined();
    });

    it('should cache PDF successfully for watermarked document', async () => {
      // Arrange
      const watermarkUserEmail = 'user@example.com';
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});

      // Act
      await setCachedPdf(
        documentId,
        version,
        updatedAt,
        pdfBuffer,
        originalMimeType,
        originalFilename,
        true,
        watermarkUserEmail
      );

      // Assert
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
      const metadataCall = (mockFs.writeFileSync as jest.Mock).mock.calls.find((call: any[]) =>
        call[0].includes('.meta.json')
      );
      expect(metadataCall).toBeDefined();
      const metadata = JSON.parse(metadataCall[1]);
      expect(metadata.isWatermarked).toBe(true);
      expect(metadata.watermarkUserEmail).toBe(watermarkUserEmail);
    });

    it('should handle errors gracefully when writing cache', async () => {
      // Arrange
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Write failed');
      });

      // Act & Assert - should not throw
      await expect(
        setCachedPdf(
          documentId,
          version,
          updatedAt,
          pdfBuffer,
          originalMimeType,
          originalFilename,
          false
        )
      ).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should store correct file size in metadata', async () => {
      // Arrange
      const largeBuffer = Buffer.alloc(5000);
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});

      // Act
      await setCachedPdf(
        documentId,
        version,
        updatedAt,
        largeBuffer,
        originalMimeType,
        originalFilename,
        false
      );

      // Assert
      const metadataCall = (mockFs.writeFileSync as jest.Mock).mock.calls.find((call: any[]) =>
        call[0].includes('.meta.json')
      );
      const metadata = JSON.parse(metadataCall[1]);
      expect(metadata.fileSize).toBe(5000);
    });
  });

  describe('invalidateCache', () => {
    const documentId = 'doc-123';

    it('should invalidate all cache files for a document', async () => {
      // Arrange
      const metadata1 = {
        documentId,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
      };
      const metadata2 = {
        documentId,
        version: 'v2.0',
        updatedAt: new Date().toISOString(),
      };
      const otherMetadata = {
        documentId: 'other-doc',
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
      };

      (mockFs.readdirSync as jest.Mock).mockReturnValue([
        'hash1.meta.json',
        'hash1.pdf',
        'hash2.meta.json',
        'hash2.pdf',
        'hash3.meta.json',
        'hash3.pdf',
      ]);

      (mockFs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('hash1')) {
          return JSON.stringify(metadata1);
        }
        if (filePath.includes('hash2')) {
          return JSON.stringify(metadata2);
        }
        if (filePath.includes('hash3')) {
          return JSON.stringify(otherMetadata);
        }
        return '';
      });

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.unlinkSync as jest.Mock).mockImplementation(() => {});

      // Act
      await invalidateCache(documentId);

      // Assert
      // Should delete hash1 and hash2 (matching documentId), but not hash3
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(4); // 2 PDFs + 2 metadata files
    });

    it('should not invalidate cache for different document', async () => {
      // Arrange
      const otherMetadata = {
        documentId: 'other-doc',
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
      };

      (mockFs.readdirSync as jest.Mock).mockReturnValue(['hash1.meta.json', 'hash1.pdf']);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(otherMetadata));
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      // Act
      await invalidateCache(documentId);

      // Assert
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should handle invalid metadata files gracefully', async () => {
      // Arrange
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['hash1.meta.json']);
      (mockFs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      // Act & Assert - should not throw
      await expect(invalidateCache(documentId)).resolves.not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle missing PDF files when invalidating', async () => {
      // Arrange
      const metadata = {
        documentId,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
      };

      (mockFs.readdirSync as jest.Mock).mockReturnValue(['hash1.meta.json']);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(metadata));
      (mockFs.existsSync as jest.Mock).mockReturnValue(false); // PDF doesn't exist

      // Act
      await invalidateCache(documentId);

      // Assert
      // Should still delete metadata file
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully during invalidation', async () => {
      // Arrange
      (mockFs.readdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Read directory failed');
      });

      // Act & Assert - should not throw
      await expect(invalidateCache(documentId)).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log when cache is invalidated', async () => {
      // Arrange
      const metadata = {
        documentId,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
      };

      (mockFs.readdirSync as jest.Mock).mockReturnValue(['hash1.meta.json', 'hash1.pdf']);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(metadata));
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.unlinkSync as jest.Mock).mockImplementation(() => {});

      // Act
      await invalidateCache(documentId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PDFCache] Invalidated cache for document:'),
        expect.objectContaining({ documentId, count: 1 })
      );
    });
  });

  describe('cleanupCache', () => {
    it('should remove old cache files older than maxAgeDays', async () => {
      // Arrange
      const now = Date.now();
      const oldTime = now - 31 * 24 * 60 * 60 * 1000; // 31 days ago
      const recentTime = now - 10 * 24 * 60 * 60 * 1000; // 10 days ago

      (mockFs.readdirSync as jest.Mock).mockReturnValue([
        'old1.meta.json',
        'old1.pdf',
        'recent1.meta.json',
        'recent1.pdf',
      ]);

      (mockFs.statSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('old1')) {
          return { mtimeMs: oldTime };
        }
        if (filePath.includes('recent1')) {
          return { mtimeMs: recentTime };
        }
        return { mtimeMs: now };
      });

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.unlinkSync as jest.Mock).mockImplementation(() => {});

      // Act
      await cleanupCache(30);

      // Assert
      // Should only delete old1 files (2 files: PDF + metadata)
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2);
    });

    it('should not remove recent cache files', async () => {
      // Arrange
      const now = Date.now();
      const recentTime = now - 10 * 24 * 60 * 60 * 1000; // 10 days ago

      (mockFs.readdirSync as jest.Mock).mockReturnValue(['recent1.meta.json', 'recent1.pdf']);

      (mockFs.statSync as jest.Mock).mockReturnValue({ mtimeMs: recentTime });
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      // Act
      await cleanupCache(30);

      // Assert
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should use default maxAgeDays of 30 when not provided', async () => {
      // Arrange
      const now = Date.now();
      const oldTime = now - 31 * 24 * 60 * 60 * 1000; // 31 days ago

      (mockFs.readdirSync as jest.Mock).mockReturnValue(['old1.meta.json', 'old1.pdf']);
      (mockFs.statSync as jest.Mock).mockReturnValue({ mtimeMs: oldTime });
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.unlinkSync as jest.Mock).mockImplementation(() => {});

      // Act
      await cleanupCache();

      // Assert
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should handle missing PDF files when cleaning up', async () => {
      // Arrange
      const now = Date.now();
      const oldTime = now - 31 * 24 * 60 * 60 * 1000; // 31 days ago

      (mockFs.readdirSync as jest.Mock).mockReturnValue(['old1.meta.json']);
      (mockFs.statSync as jest.Mock).mockReturnValue({ mtimeMs: oldTime });
      (mockFs.existsSync as jest.Mock).mockReturnValue(false); // PDF doesn't exist

      // Act
      await cleanupCache(30);

      // Assert
      // Should still delete metadata file
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully when cleaning up', async () => {
      // Arrange
      (mockFs.readdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Read directory failed');
      });

      // Act & Assert - should not throw
      await expect(cleanupCache(30)).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle errors when processing individual files', async () => {
      // Arrange
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['old1.meta.json']);
      (mockFs.statSync as jest.Mock).mockImplementation(() => {
        throw new Error('Stat failed');
      });

      // Act & Assert - should not throw
      await expect(cleanupCache(30)).resolves.not.toThrow();
    });

    it('should log when cache files are cleaned up', async () => {
      // Arrange
      const now = Date.now();
      const oldTime = now - 31 * 24 * 60 * 60 * 1000;

      (mockFs.readdirSync as jest.Mock).mockReturnValue(['old1.meta.json', 'old1.pdf']);
      (mockFs.statSync as jest.Mock).mockReturnValue({ mtimeMs: oldTime });
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.unlinkSync as jest.Mock).mockImplementation(() => {});

      // Act
      await cleanupCache(30);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PDFCache] Cleaned up old cache files:'),
        expect.objectContaining({ count: 1 })
      );
    });

    it('should not log when no files are cleaned up', async () => {
      // Arrange
      const now = Date.now();
      const recentTime = now - 10 * 24 * 60 * 60 * 1000;

      (mockFs.readdirSync as jest.Mock).mockReturnValue(['recent1.meta.json']);
      (mockFs.statSync as jest.Mock).mockReturnValue({ mtimeMs: recentTime });

      // Act
      await cleanupCache(30);

      // Assert
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[PDFCache] Cleaned up old cache files:')
      );
    });
  });
});



