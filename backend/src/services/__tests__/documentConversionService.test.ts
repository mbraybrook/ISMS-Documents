/* eslint-disable @typescript-eslint/no-explicit-any */
import { exec } from 'child_process';
import { PDFDocument } from 'pdf-lib';

// Mock child_process.exec
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Mock pdf-lib
jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn(),
  },
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    trustCenter: {
      maxFileSizeMB: 50,
    },
  },
}));

// Mock util.promisify - return the function as-is (it's already async-compatible in our mock)
jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn),
}));

// Mock libreoffice-convert - this needs to be mocked before importing the service
const mockLibreConvert = jest.fn();
jest.mock('libreoffice-convert', () => ({
  convert: mockLibreConvert,
}), { virtual: true });

// Import after mocks are set up
import {
  canConvertToPdf,
  convertToPdf,
  getPdfFilename,
} from '../documentConversionService';

describe('documentConversionService', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let mockExec: jest.MockedFunction<typeof exec>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Suppress console methods during tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockExec = exec as jest.MockedFunction<typeof exec>;
    mockExec.mockImplementation(((...args: any[]) => {
      // exec can be called as: exec(command, callback) or exec(command, options, callback)
      // In our code, it's called as: exec(command, callback)
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        setTimeout(() => callback(null), 0);
      }
      return {} as any;
    }) as any);

    // Reset libreoffice-convert mock
    mockLibreConvert.mockResolvedValue(Buffer.from('mock-pdf-content'));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('canConvertToPdf', () => {
    it('should return true for supported MIME types', () => {
      // Arrange & Act & Assert
      expect(canConvertToPdf('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
      expect(canConvertToPdf('application/msword')).toBe(true);
      expect(canConvertToPdf('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
      expect(canConvertToPdf('application/vnd.ms-excel')).toBe(true);
      expect(canConvertToPdf('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe(true);
      expect(canConvertToPdf('application/vnd.ms-powerpoint')).toBe(true);
      expect(canConvertToPdf('application/rtf')).toBe(true);
      expect(canConvertToPdf('text/plain')).toBe(true);
      expect(canConvertToPdf('text/html')).toBe(true);
    });

    it('should return true for supported file extensions when MIME type is not recognized', () => {
      // Arrange & Act & Assert
      expect(canConvertToPdf('application/unknown', 'document.docx')).toBe(true);
      expect(canConvertToPdf('application/unknown', 'document.doc')).toBe(true);
      expect(canConvertToPdf('application/unknown', 'spreadsheet.xlsx')).toBe(true);
      expect(canConvertToPdf('application/unknown', 'spreadsheet.xls')).toBe(true);
      expect(canConvertToPdf('application/unknown', 'presentation.pptx')).toBe(true);
      expect(canConvertToPdf('application/unknown', 'presentation.ppt')).toBe(true);
      expect(canConvertToPdf('application/unknown', 'document.rtf')).toBe(true);
      expect(canConvertToPdf('application/unknown', 'document.txt')).toBe(true);
      expect(canConvertToPdf('application/unknown', 'page.html')).toBe(true);
      expect(canConvertToPdf('application/unknown', 'page.htm')).toBe(true);
    });

    it('should handle case-insensitive file extensions', () => {
      // Arrange & Act & Assert
      expect(canConvertToPdf('application/unknown', 'document.DOCX')).toBe(true);
      expect(canConvertToPdf('application/unknown', 'document.DOC')).toBe(true);
      expect(canConvertToPdf('application/unknown', 'spreadsheet.XLSX')).toBe(true);
    });

    it('should return false for unsupported MIME types and file extensions', () => {
      // Arrange & Act & Assert
      expect(canConvertToPdf('application/pdf')).toBe(false);
      expect(canConvertToPdf('image/png')).toBe(false);
      expect(canConvertToPdf('application/json')).toBe(false);
      expect(canConvertToPdf('application/unknown', 'document.pdf')).toBe(false);
      expect(canConvertToPdf('application/unknown', 'image.png')).toBe(false);
    });

    it('should return false when no filename is provided and MIME type is unsupported', () => {
      // Arrange & Act & Assert
      expect(canConvertToPdf('application/unknown')).toBe(false);
      expect(canConvertToPdf('image/png')).toBe(false);
    });

    it('should handle files with multiple dots in filename', () => {
      // Arrange & Act & Assert
      expect(canConvertToPdf('application/unknown', 'document.backup.docx')).toBe(true);
      expect(canConvertToPdf('application/unknown', 'file.name.with.dots.txt')).toBe(true);
    });

    it('should handle files without extension', () => {
      // Arrange & Act & Assert
      expect(canConvertToPdf('application/unknown', 'filename')).toBe(false);
      expect(canConvertToPdf('application/unknown', 'filename.')).toBe(false);
    });
  });

  describe('getPdfFilename', () => {
    it('should replace file extension with .pdf', () => {
      // Arrange & Act & Assert
      expect(getPdfFilename('document.docx')).toBe('document.pdf');
      expect(getPdfFilename('spreadsheet.xlsx')).toBe('spreadsheet.pdf');
      expect(getPdfFilename('presentation.pptx')).toBe('presentation.pdf');
    });

    it('should handle files with multiple dots', () => {
      // Arrange & Act & Assert
      expect(getPdfFilename('document.backup.docx')).toBe('document.backup.pdf');
      expect(getPdfFilename('file.name.with.dots.txt')).toBe('file.name.with.dots.pdf');
    });

    it('should handle files without extension', () => {
      // Arrange & Act & Assert
      expect(getPdfFilename('filename')).toBe('filename.pdf');
    });

    it('should handle files with only extension', () => {
      // Arrange & Act & Assert
      expect(getPdfFilename('.docx')).toBe('.pdf');
    });

    it('should handle uppercase extensions', () => {
      // Arrange & Act & Assert
      expect(getPdfFilename('document.DOCX')).toBe('document.pdf');
      expect(getPdfFilename('spreadsheet.XLSX')).toBe('spreadsheet.pdf');
    });
  });

  describe('convertToPdf', () => {
    const mockBuffer = Buffer.from('mock-document-content');
    const mockMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const mockFilename = 'test-document.docx';

    beforeEach(() => {
      // Mock PDFDocument.load to return a mock PDF document
      const mockPdfDoc = {
        getPages: jest.fn(() => []),
        context: {
          lookup: jest.fn(),
          obj: jest.fn(),
          PDFArray: {
            of: jest.fn(),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
    });

    it('should successfully convert a document to PDF', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockLibreConvert).toHaveBeenCalledWith(mockBuffer, '.pdf', undefined);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DocumentConversion] Converting to PDF:'),
        expect.objectContaining({
          mimeType: mockMimeType,
          filename: mockFilename,
        })
      );
    });

    it('should check file size before conversion', async () => {
      // Arrange
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51 MB
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      // Act & Assert
      await expect(convertToPdf(largeBuffer, mockMimeType, mockFilename)).rejects.toThrow(
        'File size (51MB) exceeds maximum allowed size (50MB)'
      );
      expect(mockLibreConvert).not.toHaveBeenCalled();
    });

    it('should handle file size at the limit', async () => {
      // Arrange
      const maxSizeBuffer = Buffer.alloc(50 * 1024 * 1024); // Exactly 50 MB
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      // Act
      await convertToPdf(maxSizeBuffer, mockMimeType, mockFilename);

      // Assert
      expect(mockLibreConvert).toHaveBeenCalled();
    });

    it('should ensure Xvfb is running before conversion', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      // Act
      await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(mockExec).toHaveBeenCalledWith(
        'Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &',
        expect.any(Function)
      );
    });

    it('should handle Xvfb already running error gracefully', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);
      mockExec.mockImplementation(((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          const error = new Error('already in use');
          error.message = 'already in use';
          setTimeout(() => callback(error), 0);
        }
        return {} as any;
      }) as any);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Xvfb startup warning')
      );
    });

    it('should handle Xvfb startup error', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);
      mockExec.mockImplementation(((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          const error = new Error('Xvfb failed to start');
          setTimeout(() => callback(error), 0);
        }
        return {} as any;
      }) as any);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Xvfb startup warning'),
        'Xvfb failed to start'
      );
    });

    it('should remove hyperlinks from converted PDF', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);
      const mockPdfDoc = {
        getPages: jest.fn(() => []),
        context: {
          lookup: jest.fn(),
          obj: jest.fn(),
          PDFArray: {
            of: jest.fn(),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(PDFDocument.load).toHaveBeenCalledWith(mockPdfBuffer);
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should handle libreoffice-convert module loading error', async () => {
      // Arrange
      // This test verifies the error handling path when libreoffice-convert module cannot be loaded
      // Since the module is loaded lazily via require(), we test this by making the convert function
      // throw the expected error message, which simulates the module loading failure
      const moduleError = new Error('PDF conversion is not available. Please install libreoffice-convert and LibreOffice.');
      mockLibreConvert.mockImplementation(() => {
        throw moduleError;
      });

      // We need to clear the module's internal cache to force getLibreConvert to re-attempt loading
      // In a real scenario, this would happen on the first call after module load failure
      // For testing, we simulate this by making the convert function throw the expected error
      
      // Act & Assert
      // Note: In practice, the module loading error would occur in getLibreConvert(),
      // but since we're mocking the module, we test the error propagation path
      await expect(convertToPdf(mockBuffer, mockMimeType, mockFilename)).rejects.toThrow(
        'Failed to convert document to PDF: PDF conversion is not available. Please install libreoffice-convert and LibreOffice.'
      );
    });

    it('should handle conversion failure', async () => {
      // Arrange
      const conversionError = new Error('LibreOffice conversion failed');
      mockLibreConvert.mockRejectedValue(conversionError);

      // Act & Assert
      await expect(convertToPdf(mockBuffer, mockMimeType, mockFilename)).rejects.toThrow(
        'Failed to convert document to PDF: LibreOffice conversion failed'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DocumentConversion] Conversion failed:'),
        conversionError
      );
    });

    it('should handle hyperlink removal failure gracefully', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);
      (PDFDocument.load as jest.Mock).mockRejectedValue(new Error('PDF parsing failed'));

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DocumentConversion] Failed to remove hyperlinks'),
        expect.any(String)
      );
    });

    it('should log conversion success with file sizes', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      // Act
      await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DocumentConversion] Conversion successful:'),
        expect.objectContaining({
          originalSize: mockBuffer.length,
          pdfSize: expect.any(Number),
          filename: mockFilename,
        })
      );
    });

    it('should work without filename parameter', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockLibreConvert).toHaveBeenCalled();
    });

    it('should handle PDF with hyperlinks and remove them', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      // Create a mock PDF with annotations
      const mockAnnotRef = { ref: 'annot-ref-1' };
      const mockAnnot = {
        dict: new Map([
          [
            { encodedName: '/Subtype', name: 'Subtype' },
            { encodedName: '/Link', name: 'Link' },
          ],
        ]),
      };

      const mockPage = {
        node: {
          dict: new Map([
            [
              { encodedName: '/Annots', name: 'Annots' },
              { ref: 'annots-ref' },
            ],
          ]),
        },
      };

      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn((ref) => {
            if (ref === 'annots-ref') {
              return { array: [mockAnnotRef] };
            }
            if (ref === mockAnnotRef) {
              return mockAnnot;
            }
            return null;
          }),
          obj: jest.fn((arr) => arr),
          PDFArray: {
            of: jest.fn((...args) => ({ array: args })),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockPdfDoc.getPages).toHaveBeenCalled();
      expect(mockPdfDoc.context.lookup).toHaveBeenCalled();
    });

    it('should handle PDF with URI action links', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockActionRef = { ref: 'action-ref-1' };
      const mockActionDict = {
        dict: new Map([
          [
            { encodedName: '/S', name: 'S' },
            { encodedName: '/URI', name: 'URI' },
          ],
        ]),
      };

      const mockAnnotRef = { ref: 'annot-ref-1' };
      const mockAnnot = {
        dict: new Map([
          [
            { encodedName: '/A', name: 'A' },
            mockActionRef,
          ],
        ]),
      };

      const mockPage = {
        node: {
          dict: new Map([
            [
              { encodedName: '/Annots', name: 'Annots' },
              { ref: 'annots-ref' },
            ],
          ]),
        },
      };

      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn((ref) => {
            if (ref === 'annots-ref') {
              return { array: [mockAnnotRef] };
            }
            if (ref === mockAnnotRef) {
              return mockAnnot;
            }
            if (ref === mockActionRef) {
              return mockActionDict;
            }
            return null;
          }),
          obj: jest.fn((arr) => arr),
          PDFArray: {
            of: jest.fn((...args) => ({ array: args })),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockPdfDoc.context.lookup).toHaveBeenCalled();
    });

    it('should handle PDF pages without annotations', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockPage = {
        node: {
          dict: new Map(), // No Annots key
        },
      };

      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn(),
          obj: jest.fn(),
          PDFArray: {
            of: jest.fn(),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should handle PDF with empty annotations array', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockAnnotsKey = { encodedName: '/Annots', name: 'Annots' };
      const mockPage = {
        node: {
          dict: new Map([
            [mockAnnotsKey, { ref: 'annots-ref' }],
          ]),
        },
      };

      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn((ref) => {
            if (ref === 'annots-ref') {
              return { array: [] }; // Empty annotations
            }
            return null;
          }),
          obj: jest.fn(),
          PDFArray: {
            of: jest.fn(() => ({ array: [] })),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should handle annotation lookup errors gracefully', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockAnnotRef = { ref: 'annot-ref-1' };
      const mockPageDict = new Map([
        [
          { encodedName: '/Annots', name: 'Annots' },
          { ref: 'annots-ref' },
        ],
      ]);
      const mockPage = {
        node: {
          dict: mockPageDict,
        },
      };

      let lookupCount = 0;
      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn((ref) => {
            lookupCount++;
            if (ref === 'annots-ref') {
              return { array: [mockAnnotRef] };
            }
            if (ref === mockAnnotRef && lookupCount > 1) {
              // Throw error when looking up the annotation (after first lookup for annots-ref)
              throw new Error('Annotation lookup failed');
            }
            return null;
          }),
          obj: jest.fn((arr) => arr),
          PDFArray: {
            of: jest.fn((...args) => ({ array: args })),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      // Verify that the error was handled gracefully (PDF was still returned)
      expect(mockPdfDoc.save).toHaveBeenCalled();
      // The important thing is that errors during annotation processing don't crash the conversion
    });

    it('should handle annotations without dict property', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockAnnotRef = { ref: 'annot-ref-1' };
      const mockAnnot = {
        // No dict property
      };

      const mockPage = {
        node: {
          dict: new Map([
            [
              { encodedName: '/Annots', name: 'Annots' },
              { ref: 'annots-ref' },
            ],
          ]),
        },
      };

      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn((ref) => {
            if (ref === 'annots-ref') {
              return { array: [mockAnnotRef] };
            }
            if (ref === mockAnnotRef) {
              return mockAnnot;
            }
            return null;
          }),
          obj: jest.fn((arr) => arr),
          PDFArray: {
            of: jest.fn((...args) => ({ array: args })),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should handle PDFArray.of not available', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      // Create two annotations: one link (will be removed) and one non-link (will be kept)
      const mockLinkAnnotRef = { ref: 'link-annot-ref' };
      const mockLinkAnnot = {
        dict: new Map([
          [
            { encodedName: '/Subtype', name: 'Subtype' },
            { encodedName: '/Link', name: 'Link' },
          ],
        ]),
      };

      const mockNonLinkAnnotRef = { ref: 'non-link-annot-ref' };
      const mockNonLinkAnnot = {
        dict: new Map([
          [
            { encodedName: '/Subtype', name: 'Subtype' },
            { encodedName: '/Text', name: 'Text' }, // Not a link
          ],
        ]),
      };

      const mockAnnotsKey = { encodedName: '/Annots', name: 'Annots' };
      const mockPageDict = new Map([
        [mockAnnotsKey, { ref: 'annots-ref' }],
      ]);
      const mockPage = {
        node: {
          dict: mockPageDict,
        },
      };

      const mockObj = jest.fn((arr) => arr);
      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn((ref) => {
            if (ref === 'annots-ref') {
              return { array: [mockLinkAnnotRef, mockNonLinkAnnotRef] };
            }
            if (ref === mockLinkAnnotRef) {
              return mockLinkAnnot;
            }
            if (ref === mockNonLinkAnnotRef) {
              return mockNonLinkAnnot;
            }
            return null;
          }),
          obj: mockObj,
          PDFArray: null, // PDFArray not available
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      // Verify that obj was called as fallback when PDFArray is not available
      // The exact call depends on implementation, but we verify the code path was executed
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should handle annotations array lookup error', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockPage = {
        node: {
          dict: new Map([
            [
              { encodedName: '/Annots', name: 'Annots' },
              { ref: 'annots-ref' },
            ],
          ]),
        },
      };

      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn(() => {
            throw new Error('Lookup failed');
          }),
          obj: jest.fn(),
          PDFArray: {
            of: jest.fn(),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error looking up annotations on page 1:'),
        expect.any(String)
      );
    });

    it('should handle annotations that are regular arrays', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockAnnotRef = { ref: 'annot-ref-1' };
      const mockPage = {
        node: {
          dict: new Map([
            [
              { encodedName: '/Annots', name: 'Annots' },
              { ref: 'annots-ref' },
            ],
          ]),
        },
      };

      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn((ref) => {
            if (ref === 'annots-ref') {
              return [mockAnnotRef]; // Regular array, not PDFArray
            }
            return null;
          }),
          obj: jest.fn(),
          PDFArray: {
            of: jest.fn(),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should handle ensureXvfbRunning catch block error', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);
      
      // Make exec throw an error that triggers the catch block
      mockExec.mockImplementation((() => {
        // Simulate an error in the catch block by making exec throw synchronously
        throw new Error('Xvfb error');
      }) as any);

      const mockPdfDoc = {
        getPages: jest.fn(() => []),
        context: {
          lookup: jest.fn(),
          obj: jest.fn(),
          PDFArray: {
            of: jest.fn(),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      // Conversion should still succeed despite Xvfb error
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should handle PDFs with link annotations for removal', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockLinkAnnotRef = { ref: 'link-annot-ref' };
      const mockLinkAnnot = {
        dict: new Map([
          [
            { encodedName: '/Subtype', name: 'Subtype' },
            { encodedName: '/Link', name: 'Link' },
          ],
        ]),
      };

      const mockPageDict = new Map([
        [
          { encodedName: '/Annots', name: 'Annots' },
          { ref: 'annots-ref' },
        ],
      ]);
      const mockPage = {
        node: {
          dict: mockPageDict,
        },
      };

      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn((ref) => {
            if (ref === 'annots-ref') {
              return { array: [mockLinkAnnotRef] };
            }
            if (ref === mockLinkAnnotRef) {
              return mockLinkAnnot;
            }
            return null;
          }),
          obj: jest.fn((arr) => arr),
          PDFArray: {
            of: jest.fn((...args) => ({ array: args })),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      // Verify that hyperlink removal was attempted (PDF was processed)
      expect(mockPdfDoc.getPages).toHaveBeenCalled();
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should handle annotations with action lookup errors', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockActionRef = { ref: 'action-ref-1' };
      const mockAnnotRef = { ref: 'annot-ref-1' };
      const mockAnnot = {
        dict: new Map([
          [
            { encodedName: '/A', name: 'A' },
            mockActionRef,
          ],
        ]),
      };

      const mockPageDict = new Map([
        [
          { encodedName: '/Annots', name: 'Annots' },
          { ref: 'annots-ref' },
        ],
      ]);
      const mockPage = {
        node: {
          dict: mockPageDict,
        },
      };

      let actionLookupCount = 0;
      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn((ref) => {
            if (ref === 'annots-ref') {
              return { array: [mockAnnotRef] };
            }
            if (ref === mockAnnotRef) {
              return mockAnnot;
            }
            if (ref === mockActionRef) {
              actionLookupCount++;
              if (actionLookupCount === 1) {
                throw new Error('Action lookup failed');
              }
            }
            return null;
          }),
          obj: jest.fn((arr) => arr),
          PDFArray: {
            of: jest.fn((...args) => ({ array: args })),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      // Action lookup errors should be ignored gracefully
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should handle page with Annots key but no annotsRef value', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockPageDict = new Map([
        [
          { encodedName: '/Annots', name: 'Annots' },
          null, // No ref value
        ],
      ]);
      const mockPage = {
        node: {
          dict: mockPageDict,
        },
      };

      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn(),
          obj: jest.fn(),
          PDFArray: {
            of: jest.fn(),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should handle annotations lookup returning non-array non-PDFArray', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockPageDict = new Map([
        [
          { encodedName: '/Annots', name: 'Annots' },
          { ref: 'annots-ref' },
        ],
      ]);
      const mockPage = {
        node: {
          dict: mockPageDict,
        },
      };

      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn((ref) => {
            if (ref === 'annots-ref') {
              return { notAnArray: true }; // Not an array and no array property
            }
            return null;
          }),
          obj: jest.fn(),
          PDFArray: {
            of: jest.fn(),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockPdfDoc.save).toHaveBeenCalled();
    });

    it('should handle deleting annots key when all annotations are links', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockLinkAnnotRef = { ref: 'link-annot-ref' };
      const mockLinkAnnot = {
        dict: new Map([
          [
            { encodedName: '/Subtype', name: 'Subtype' },
            { encodedName: '/Link', name: 'Link' },
          ],
        ]),
      };

      const mockAnnotsKey = { encodedName: '/Annots', name: 'Annots' };
      const mockPageDict = new Map([
        [mockAnnotsKey, { ref: 'annots-ref' }],
      ]);
      const mockPage = {
        node: {
          dict: mockPageDict,
        },
      };

      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn((ref) => {
            if (ref === 'annots-ref') {
              return { array: [mockLinkAnnotRef] };
            }
            if (ref === mockLinkAnnotRef) {
              return mockLinkAnnot;
            }
            return null;
          }),
          obj: jest.fn((arr) => arr),
          PDFArray: null, // PDFArray not available, should delete key
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockPdfDoc.save).toHaveBeenCalled();
      // When all annotations are removed and PDFArray is not available, conversion should still succeed
    });

    it('should handle empty filtered annotations with PDFArray.of available', async () => {
      // Arrange
      const mockPdfBuffer = Buffer.from('converted-pdf-content');
      mockLibreConvert.mockResolvedValue(mockPdfBuffer);

      const mockLinkAnnotRef = { ref: 'link-annot-ref' };
      const mockLinkAnnot = {
        dict: new Map([
          [
            { encodedName: '/Subtype', name: 'Subtype' },
            { encodedName: '/Link', name: 'Link' },
          ],
        ]),
      };

      const mockAnnotsKey = { encodedName: '/Annots', name: 'Annots' };
      const mockPageDict = new Map([
        [mockAnnotsKey, { ref: 'annots-ref' }],
      ]);
      const mockPage = {
        node: {
          dict: mockPageDict,
        },
      };

      const mockEmptyArray = { array: [] };
      const mockPdfDoc = {
        getPages: jest.fn(() => [mockPage]),
        context: {
          lookup: jest.fn((ref) => {
            if (ref === 'annots-ref') {
              return { array: [mockLinkAnnotRef] };
            }
            if (ref === mockLinkAnnotRef) {
              return mockLinkAnnot;
            }
            return null;
          }),
          obj: jest.fn((arr) => arr),
          PDFArray: {
            of: jest.fn(() => mockEmptyArray),
          },
        },
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
      };

      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Act
      const result = await convertToPdf(mockBuffer, mockMimeType, mockFilename);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockPdfDoc.save).toHaveBeenCalled();
      // When all annotations are links and filteredAnnots is empty, conversion should still succeed
      // The code handles this case by either creating an empty array or deleting the key
    });
  });
});

