/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  validatePdfForWatermarking,
  addWatermarkToPdf,
} from '../watermarkService';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import crypto from 'crypto';

// Mock pdf-lib
jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn(),
    create: jest.fn(),
  },
  rgb: jest.fn((r: number, g: number, b: number) => ({ r, g, b })),
  degrees: jest.fn((angle: number) => angle),
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    trustCenter: {
      maxFileSizeMB: 50,
    },
  },
}));

// Mock prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    trustCenterSettings: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock crypto
jest.mock('crypto', () => ({
  createHash: jest.fn(),
}));

describe('watermarkService', () => {
  let mockPdfDoc: any;
  let mockPage: any;
  let prisma: any;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  // Helper to create a valid PDF buffer
  const createValidPdfBuffer = (): Buffer => {
    // Create a minimal valid PDF header
    const pdfHeader = Buffer.from('%PDF-1.4\n');
    const pdfContent = Buffer.from('1 0 obj\n<< /Type /Catalog >>\nendobj\n');
    const pdfTrailer = Buffer.from('xref\n0 0\ntrailer\n<< /Size 0 >>\nstartxref\n0\n%%EOF');
    return Buffer.concat([pdfHeader, pdfContent, pdfTrailer]);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    prisma = require('../../lib/prisma').prisma;

    // Setup mock page
    mockPage = {
      getSize: jest.fn(() => ({ width: 612, height: 792 })),
      drawText: jest.fn(),
    };

    // Setup mock PDF document
    mockPdfDoc = {
      getPages: jest.fn(() => [mockPage]),
      save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
    };

    // Setup PDFDocument.load mock
    (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

    // Setup crypto mock - createHash returns an object with chainable update and digest
    const mockUpdate = jest.fn().mockReturnThis();
    const mockDigest = jest.fn().mockReturnValue('abcdef1234567890abcdef1234567890');
    const mockHashObject = {
      update: mockUpdate,
      digest: mockDigest,
    };
    (crypto.createHash as jest.Mock).mockReturnValue(mockHashObject);

    // Suppress console methods during tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('validatePdfForWatermarking', () => {
    it('should return invalid when buffer is empty', () => {
      // Arrange
      const emptyBuffer = Buffer.alloc(0);

      // Act
      const result = validatePdfForWatermarking(emptyBuffer);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Empty PDF buffer');
    });

    it('should return invalid when buffer is null', () => {
      // Arrange
      const nullBuffer = null as unknown as Buffer;

      // Act
      const result = validatePdfForWatermarking(nullBuffer);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Empty PDF buffer');
    });

    it('should return invalid when buffer does not start with PDF header', () => {
      // Arrange
      const invalidBuffer = Buffer.from('NOT A PDF');

      // Act
      const result = validatePdfForWatermarking(invalidBuffer);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Not a valid PDF file');
    });

    it('should return valid when buffer starts with PDF header', () => {
      // Arrange
      const validBuffer = createValidPdfBuffer();

      // Act
      const result = validatePdfForWatermarking(validBuffer);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should handle errors during validation', () => {
      // Arrange
      const buffer = Buffer.from('%PDF');
      // Mock toString to throw an error
      const originalToString = Buffer.prototype.toString;
      Buffer.prototype.toString = jest.fn(() => {
        throw new Error('Test error');
      });

      // Act
      const result = validatePdfForWatermarking(buffer);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Test error');

      // Restore
      Buffer.prototype.toString = originalToString;
    });

    it('should handle errors without message', () => {
      // Arrange
      const buffer = Buffer.from('%PDF');
      // Mock toString to throw an error without message
      const originalToString = Buffer.prototype.toString;
      Buffer.prototype.toString = jest.fn(() => {
        const error = new Error();
        delete (error as any).message;
        throw error;
      });

      // Act
      const result = validatePdfForWatermarking(buffer);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Unknown validation error');

      // Restore
      Buffer.prototype.toString = originalToString;
    });
  });

  describe('addWatermarkToPdf', () => {
    const userEmail = 'test@example.com';
    const date = new Date('2024-01-15T10:00:00Z');
    const validPdfBuffer = createValidPdfBuffer();

    it('should successfully add watermark to PDF', async () => {
      // Arrange
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Custom Prefix',
      });

      // Act
      const result = await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(PDFDocument.load).toHaveBeenCalledWith(validPdfBuffer);
      expect(mockPdfDoc.getPages).toHaveBeenCalled();
      expect(mockPage.drawText).toHaveBeenCalledTimes(2); // Diagonal and bottom watermarks
      expect(mockPdfDoc.save).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] Starting watermark process:'),
        expect.any(Object)
      );
    });

    it('should use custom watermark prefix from settings', async () => {
      // Arrange
      const customPrefix = 'Company Confidential';
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: customPrefix,
      });

      // Act
      await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      expect(mockPage.drawText).toHaveBeenCalledWith(
        expect.stringContaining(customPrefix),
        expect.any(Object)
      );
    });

    it('should use default watermark prefix when settings not found', async () => {
      // Arrange
      prisma.trustCenterSettings.findUnique.mockResolvedValue(null);

      // Act
      await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      expect(mockPage.drawText).toHaveBeenCalledWith(
        expect.stringContaining('Paythru Confidential'),
        expect.any(Object)
      );
    });

    it('should use default watermark prefix when settings query fails', async () => {
      // Arrange
      prisma.trustCenterSettings.findUnique.mockRejectedValue(new Error('Database error'));

      // Act
      await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      expect(mockPage.drawText).toHaveBeenCalledWith(
        expect.stringContaining('Paythru Confidential'),
        expect.any(Object)
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] Error fetching watermark prefix'),
        expect.any(Error)
      );
    });

    it('should include issued date in watermark when provided', async () => {
      // Arrange
      const issuedDate = new Date('2024-01-10T08:00:00Z');
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });

      // Act
      await addWatermarkToPdf(validPdfBuffer, userEmail, date, undefined, issuedDate);

      // Assert
      const issuedDateStr = issuedDate.toISOString().split('T')[0];
      expect(mockPage.drawText).toHaveBeenCalledWith(
        expect.stringContaining(`Issued: ${issuedDateStr}`),
        expect.any(Object)
      );
    });

    it('should not include issued date in watermark when not provided', async () => {
      // Arrange
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });

      // Act
      await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      const calls = (mockPage.drawText as jest.Mock).mock.calls;
      const watermarkText = calls[0][0];
      expect(watermarkText).not.toContain('Issued:');
    });

    it('should return original PDF when PDF size exceeds maximum allowed size', async () => {
      // Arrange
      const maxSizeMB = 10;
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      const largeBuffer = Buffer.alloc(maxSizeBytes + 1); // 10MB + 1 byte
      // Write PDF header at the start
      largeBuffer.write('%PDF', 0, 'ascii');

      // Act
      const result = await addWatermarkToPdf(largeBuffer, userEmail, date, maxSizeMB);

      // Assert
      expect(result).toBe(largeBuffer); // Returns original PDF
      expect(PDFDocument.load).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] Error watermarking PDF:'),
        expect.objectContaining({
          error: expect.stringContaining('PDF size'),
        })
      );
    });

    it('should return original PDF when PDF size exceeds config maxFileSizeMB', async () => {
      // Arrange
      const maxSizeMB = 50; // From config mock
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      const largeBuffer = Buffer.alloc(maxSizeBytes + 1); // 50MB + 1 byte
      // Write PDF header at the start
      largeBuffer.write('%PDF', 0, 'ascii');

      // Act
      const result = await addWatermarkToPdf(largeBuffer, userEmail, date);

      // Assert
      expect(result).toBe(largeBuffer); // Returns original PDF
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] Error watermarking PDF:'),
        expect.objectContaining({
          error: expect.stringContaining('PDF size'),
        })
      );
    });

    it('should return original PDF when validation fails', async () => {
      // Arrange
      const invalidBuffer = Buffer.from('NOT A PDF');
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });

      // Act
      const result = await addWatermarkToPdf(invalidBuffer, userEmail, date);

      // Assert
      expect(result).toBe(invalidBuffer);
      expect(PDFDocument.load).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] PDF validation failed:'),
        'Not a valid PDF file'
      );
    });

    it('should return original PDF when PDF loading fails', async () => {
      // Arrange
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });
      (PDFDocument.load as jest.Mock).mockRejectedValue(new Error('PDF load error'));

      // Act
      const result = await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      expect(result).toBe(validPdfBuffer);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] Error watermarking PDF:'),
        expect.objectContaining({
          error: 'PDF load error',
        })
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] Returning original PDF due to watermarking failure')
      );
    });

    it('should return original PDF when save fails', async () => {
      // Arrange
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });
      mockPdfDoc.save.mockRejectedValue(new Error('Save error'));

      // Act
      const result = await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      expect(result).toBe(validPdfBuffer);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] Error watermarking PDF:'),
        expect.objectContaining({
          error: 'Save error',
        })
      );
    });

    it('should add watermark to all pages', async () => {
      // Arrange
      const page1 = { getSize: jest.fn(() => ({ width: 612, height: 792 })), drawText: jest.fn() };
      const page2 = { getSize: jest.fn(() => ({ width: 612, height: 792 })), drawText: jest.fn() };
      const page3 = { getSize: jest.fn(() => ({ width: 612, height: 792 })), drawText: jest.fn() };
      mockPdfDoc.getPages.mockReturnValue([page1, page2, page3]);
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });

      // Act
      await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      expect(page1.drawText).toHaveBeenCalledTimes(2);
      expect(page2.drawText).toHaveBeenCalledTimes(2);
      expect(page3.drawText).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] Found pages:'),
        3
      );
    });

    it('should calculate document hash correctly', async () => {
      // Arrange
      const expectedHash = 'abcdef1234567890';
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });

      // Act
      await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
      const calls = (mockPage.drawText as jest.Mock).mock.calls;
      const watermarkText = calls[0][0];
      expect(watermarkText).toContain(`Document Hash: ${expectedHash}`);
    });

    it('should format dates correctly in watermark', async () => {
      // Arrange
      const downloadDate = new Date('2024-03-20T14:30:00Z');
      const issuedDate = new Date('2024-02-15T09:00:00Z');
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });

      // Act
      await addWatermarkToPdf(validPdfBuffer, userEmail, downloadDate, undefined, issuedDate);

      // Assert
      const calls = (mockPage.drawText as jest.Mock).mock.calls;
      const watermarkText = calls[0][0];
      expect(watermarkText).toContain('2024-03-20'); // Download date
      expect(watermarkText).toContain('2024-02-15'); // Issued date
    });

    it('should use correct watermark styling for diagonal watermark', async () => {
      // Arrange
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });

      // Act
      await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      const calls = (mockPage.drawText as jest.Mock).mock.calls;
      const diagonalWatermark = calls[0];
      expect(diagonalWatermark[1]).toMatchObject({
        size: expect.any(Number),
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.3,
        rotate: degrees(-45),
      });
    });

    it('should use correct watermark styling for bottom watermark', async () => {
      // Arrange
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });

      // Act
      await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      const calls = (mockPage.drawText as jest.Mock).mock.calls;
      const bottomWatermark = calls[1];
      expect(bottomWatermark[1]).toMatchObject({
        x: 20,
        y: 20,
        size: expect.any(Number),
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.5,
      });
    });

    it('should scale font size based on page dimensions', async () => {
      // Arrange
      const smallPage = {
        getSize: jest.fn(() => ({ width: 300, height: 400 })),
        drawText: jest.fn(),
      };
      mockPdfDoc.getPages.mockReturnValue([smallPage]);
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });

      // Act
      await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      const calls = (smallPage.drawText as jest.Mock).mock.calls;
      const fontSize = calls[0][1].size;
      // Font size should be min(width, height) / 20 = min(300, 400) / 20 = 15
      expect(fontSize).toBe(15);
    });

    it('should log watermark process details', async () => {
      // Arrange
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });

      // Act
      await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] Starting watermark process:'),
        expect.objectContaining({
          originalSize: validPdfBuffer.length,
          userEmail,
          date: date.toISOString(),
        })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] PDF validated, document hash:'),
        expect.any(String)
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] Loading PDF document...')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] PDF loaded successfully')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] Successfully watermarked PDF'),
        expect.any(Object)
      );
    });

    it('should handle PDF with zero pages', async () => {
      // Arrange
      mockPdfDoc.getPages.mockReturnValue([]);
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });

      // Act
      const result = await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockPage.drawText).not.toHaveBeenCalled();
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should return original PDF when watermarking throws unexpected error', async () => {
      // Arrange
      prisma.trustCenterSettings.findUnique.mockResolvedValue({
        key: 'global',
        watermarkPrefix: 'Test Prefix',
      });
      mockPage.drawText.mockImplementation(() => {
        throw new Error('Unexpected drawing error');
      });

      // Act
      const result = await addWatermarkToPdf(validPdfBuffer, userEmail, date);

      // Assert
      expect(result).toBe(validPdfBuffer);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WatermarkService] Error watermarking PDF:'),
        expect.objectContaining({
          error: 'Unexpected drawing error',
        })
      );
    });
  });
});

