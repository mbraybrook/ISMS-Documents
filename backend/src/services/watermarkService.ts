import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { config } from '../config';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Get watermark prefix from Trust Center settings
 * Returns default 'Paythru Confidential' if not configured
 */
async function getWatermarkPrefix(): Promise<string> {
  try {
    const settings = await prisma.trustCenterSettings.findUnique({
      where: { key: 'global' },
    });
    return settings?.watermarkPrefix || 'Paythru Confidential';
  } catch (error) {
    console.warn('[WatermarkService] Error fetching watermark prefix, using default:', error);
    return 'Paythru Confidential';
  }
}

/**
 * Validate PDF before watermarking
 */
export function validatePdfForWatermarking(pdfBuffer: Buffer): ValidationResult {
  try {
    // Check if buffer is empty
    if (!pdfBuffer || pdfBuffer.length === 0) {
      return { valid: false, reason: 'Empty PDF buffer' };
    }

    // Check if it starts with PDF header
    const header = pdfBuffer.toString('ascii', 0, 4);
    if (header !== '%PDF') {
      return { valid: false, reason: 'Not a valid PDF file' };
    }

    // Basic validation passed
    return { valid: true };
  } catch (error: any) {
    return { valid: false, reason: error.message || 'Unknown validation error' };
  }
}

/**
 * Add watermark to PDF
 * Returns watermarked PDF buffer or original if watermarking fails
 */
export async function addWatermarkToPdf(
  pdfBuffer: Buffer,
  userEmail: string,
  date: Date,
  maxSizeMB?: number,
  issuedDate?: Date
): Promise<Buffer> {
  const originalSize = pdfBuffer.length;
  console.log('[WatermarkService] Starting watermark process:', {
    originalSize,
    userEmail,
    date: date.toISOString(),
    issuedDate: issuedDate?.toISOString(),
    maxSizeMB,
  });

  try {
    // Check file size
    const maxSizeBytes = (maxSizeMB || config.trustCenter.maxFileSizeMB) * 1024 * 1024;
    if (pdfBuffer.length > maxSizeBytes) {
      throw new Error(
        `PDF size (${Math.round(pdfBuffer.length / 1024 / 1024)}MB) exceeds maximum allowed size (${maxSizeMB || config.trustCenter.maxFileSizeMB}MB)`
      );
    }

    // Validate PDF
    const validation = validatePdfForWatermarking(pdfBuffer);
    if (!validation.valid) {
      console.warn('[WatermarkService] PDF validation failed:', validation.reason);
      // Return original PDF with warning
      return pdfBuffer;
    }

    // Calculate document hash for verification
    const documentHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex').substring(0, 16);
    console.log('[WatermarkService] PDF validated, document hash:', documentHash);

    // Load PDF
    console.log('[WatermarkService] Loading PDF document...');
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    console.log('[WatermarkService] PDF loaded successfully');

    // Get all pages
    const pages = pdfDoc.getPages();
    const pageCount = pages.length;
    console.log('[WatermarkService] Found pages:', pageCount);

    // Get watermark prefix from settings (once, before the loop)
    const watermarkPrefix = await getWatermarkPrefix();
    console.log('[WatermarkService] Using watermark prefix:', watermarkPrefix);

    // Format dates
    const downloadDate = date.toISOString().split('T')[0];
    const issuedDateStr = issuedDate ? ` - Issued: ${issuedDate.toISOString().split('T')[0]}` : '';
    
    // Create watermark text
    const watermarkText = `${watermarkPrefix} - Prepared for ${userEmail} - ${downloadDate}${issuedDateStr}\nDocument Hash: ${documentHash}`;
    const bottomWatermarkText = `${watermarkPrefix} - ${userEmail} - ${issuedDate ? `Issued: ${issuedDate.toISOString().split('T')[0]} - ` : ''}${documentHash}`;
    console.log('[WatermarkService] Watermark text:', watermarkText);

    // Add watermark to each page
    for (let i = 0; i < pageCount; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();

      // Create watermark using pdf-lib's text drawing
      // We'll draw the text diagonally across the page
      const fontSize = Math.min(width, height) / 20; // Scale font size with page size
      const textWidth = watermarkText.length * fontSize * 0.6; // Approximate text width

      console.log(`[WatermarkService] Adding watermark to page ${i + 1}/${pageCount}:`, {
        width,
        height,
        fontSize,
      });

      // Draw watermark text diagonally across the page
      page.drawText(watermarkText, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: fontSize,
        color: rgb(0.7, 0.7, 0.7), // Light gray
        opacity: 0.3,
        rotate: degrees(-45), // Diagonal - use degrees() function from pdf-lib
      });

      // Add another watermark at bottom
      page.drawText(bottomWatermarkText, {
        x: 20,
        y: 20,
        size: fontSize * 0.5,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.5,
      });

      console.log(`[WatermarkService] Watermark added to page ${i + 1}`);
    }

    // Serialize PDF
    console.log('[WatermarkService] Serializing watermarked PDF...');
    const watermarkedPdfBytes = await pdfDoc.save();
    const watermarkedSize = watermarkedPdfBytes.length;
    const sizeChange = watermarkedSize - originalSize;

    console.log('[WatermarkService] Successfully watermarked PDF', {
      originalSize,
      watermarkedSize,
      sizeChange,
      sizeChangePercent: ((sizeChange / originalSize) * 100).toFixed(2) + '%',
      pageCount,
      userEmail,
      documentHash,
      watermarkText,
    });

    const result = Buffer.from(watermarkedPdfBytes);
    console.log('[WatermarkService] Returning watermarked buffer, size:', result.length);
    return result;
  } catch (error: any) {
    console.error('[WatermarkService] Error watermarking PDF:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });

    // If watermarking fails, return original PDF with logged warning
    // This ensures users can still access the document even if watermarking fails
    console.warn('[WatermarkService] Returning original PDF due to watermarking failure');
    return pdfBuffer;
  }
}

