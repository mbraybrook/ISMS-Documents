import { promisify } from 'util';
import { config } from '../config';

// Type definition for libreoffice-convert (if types package doesn't exist)
declare module 'libreoffice-convert' {
  export function convert(
    buffer: Buffer,
    format: string,
    options: any,
    callback: (err: Error | null, result: Buffer) => void
  ): void;
}

// Lazy load libreoffice-convert to handle cases where it's not available
let libre: any = null;
let libreConvert: any = null;

function getLibreConvert() {
  if (!libre) {
    try {
      libre = require('libreoffice-convert');
      libreConvert = promisify(libre.convert);
    } catch (error) {
      console.error('[DocumentConversion] libreoffice-convert not available:', error);
      throw new Error('PDF conversion is not available. Please install libreoffice-convert and LibreOffice.');
    }
  }
  return libreConvert;
}

/**
 * Supported file types for conversion to PDF
 */
const SUPPORTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-powerpoint', // .ppt
  'application/rtf', // .rtf
  'text/plain', // .txt
  'text/html', // .html
];

/**
 * Check if a file type can be converted to PDF
 */
export function canConvertToPdf(mimeType: string, filename?: string): boolean {
  // Check by MIME type
  if (SUPPORTED_TYPES.includes(mimeType)) {
    return true;
  }

  // Fallback: check by file extension
  if (filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const convertibleExtensions = [
      'docx', 'doc',
      'xlsx', 'xls',
      'pptx', 'ppt',
      'rtf',
      'txt',
      'html', 'htm',
    ];
    return convertibleExtensions.includes(ext || '');
  }

  return false;
}

/**
 * Convert a document to PDF
 * @param buffer - Original file buffer
 * @param mimeType - MIME type of the original file
 * @param filename - Original filename (for logging)
 * @returns PDF buffer
 */
export async function convertToPdf(
  buffer: Buffer,
  mimeType: string,
  filename?: string
): Promise<Buffer> {
  try {
    console.log('[DocumentConversion] Converting to PDF:', {
      mimeType,
      filename,
      size: buffer.length,
    });

    // Check file size limit
    const maxSizeMB = config.trustCenter.maxFileSizeMB || 50;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (buffer.length > maxSizeBytes) {
      throw new Error(
        `File size (${Math.round(buffer.length / 1024 / 1024)}MB) exceeds maximum allowed size (${maxSizeMB}MB)`
      );
    }

    // Convert to PDF using LibreOffice
    const convert = getLibreConvert();
    const pdfBuffer = await convert(buffer, '.pdf', undefined);

    console.log('[DocumentConversion] Conversion successful:', {
      originalSize: buffer.length,
      pdfSize: pdfBuffer.length,
      filename,
    });

    return Buffer.from(pdfBuffer);
  } catch (error: any) {
    console.error('[DocumentConversion] Conversion failed:', error);
    throw new Error(`Failed to convert document to PDF: ${error.message}`);
  }
}

/**
 * Get PDF filename from original filename
 */
export function getPdfFilename(originalFilename: string): string {
  const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
  return `${nameWithoutExt}.pdf`;
}

