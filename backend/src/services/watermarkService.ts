import { PDFDocument, rgb } from 'pdf-lib';
import { config } from '../config';
import crypto from 'crypto';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
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
  maxSizeMB?: number
): Promise<Buffer> {
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

    // Load PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Get all pages
    const pages = pdfDoc.getPages();
    const pageCount = pages.length;

    // Create watermark text
    const watermarkText = `Confidential - Prepared for ${userEmail} - ${date.toISOString().split('T')[0]}\nDocument Hash: ${documentHash}`;

    // Add watermark to each page
    for (let i = 0; i < pageCount; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();

      // Create watermark using pdf-lib's text drawing
      // We'll draw the text diagonally across the page
      const fontSize = Math.min(width, height) / 20; // Scale font size with page size
      const textWidth = watermarkText.length * fontSize * 0.6; // Approximate text width

      // Draw watermark text multiple times for better visibility
      page.drawText(watermarkText, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: fontSize,
        color: rgb(0.7, 0.7, 0.7), // Light gray
        opacity: 0.3,
        rotate: { angleInDegrees: -45 }, // Diagonal
      });

      // Add another watermark at bottom
      page.drawText(`Confidential - ${userEmail} - ${documentHash}`, {
        x: 20,
        y: 20,
        size: fontSize * 0.5,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.5,
      });
    }

    // Serialize PDF
    const watermarkedPdfBytes = await pdfDoc.save();

    console.log('[WatermarkService] Successfully watermarked PDF', {
      originalSize: pdfBuffer.length,
      watermarkedSize: watermarkedPdfBytes.length,
      pageCount,
      userEmail,
    });

    return Buffer.from(watermarkedPdfBytes);
  } catch (error: any) {
    console.error('[WatermarkService] Error watermarking PDF:', error);

    // If watermarking fails, return original PDF with logged warning
    // This ensures users can still access the document even if watermarking fails
    console.warn('[WatermarkService] Returning original PDF due to watermarking failure');
    return pdfBuffer;
  }
}

