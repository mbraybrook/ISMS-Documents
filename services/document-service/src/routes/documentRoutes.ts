import { Router, Request, Response } from 'express';
import { convertToPdf, getPdfFilename } from '../services/documentConversionService';
import { addWatermarkToPdf, validatePdfForWatermarking } from '../services/watermarkService';
import { getCachedPdf, setCachedPdf, invalidateCache } from '../services/pdfCacheService';

const router = Router();

/**
 * POST /v1/convert
 * Convert a document to PDF
 * Body: { bufferBase64: string, mimeType: string, filename?: string }
 * Returns: { pdfBufferBase64: string, filename: string }
 */
router.post('/convert', async (req: Request, res: Response) => {
  try {
    const { bufferBase64, mimeType, filename } = req.body;

    if (!bufferBase64 || !mimeType) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        details: 'bufferBase64 and mimeType are required',
      });
    }

    const buffer = Buffer.from(bufferBase64, 'base64');
    const pdfBuffer = await convertToPdf(buffer, mimeType, filename);
    const pdfFilename = filename ? getPdfFilename(filename) : 'converted.pdf';

    res.json({
      pdfBufferBase64: pdfBuffer.toString('base64'),
      filename: pdfFilename,
    });
  } catch (error: any) {
    console.error('[DocumentRoutes] Convert error:', error);
    res.status(500).json({
      error: error.message || 'Failed to convert document',
      code: 'CONVERSION_ERROR',
    });
  }
});

/**
 * POST /v1/watermark
 * Add watermark to PDF
 * Body: { pdfBufferBase64: string, watermarkPrefix: string, userEmail: string, date: string, maxSizeMB?: number, issuedDate?: string }
 * Returns: { pdfBufferBase64: string }
 */
router.post('/watermark', async (req: Request, res: Response) => {
  try {
    const { pdfBufferBase64, watermarkPrefix, userEmail, date, maxSizeMB, issuedDate } = req.body;

    if (!pdfBufferBase64 || !watermarkPrefix || !userEmail || !date) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        details: 'pdfBufferBase64, watermarkPrefix, userEmail, and date are required',
      });
    }

    const pdfBuffer = Buffer.from(pdfBufferBase64, 'base64');
    const validation = validatePdfForWatermarking(pdfBuffer);
    
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid PDF',
        code: 'INVALID_PDF',
        details: validation.reason,
      });
    }

    const watermarkedBuffer = await addWatermarkToPdf(
      pdfBuffer,
      watermarkPrefix,
      userEmail,
      new Date(date),
      maxSizeMB,
      issuedDate ? new Date(issuedDate) : undefined
    );

    res.json({
      pdfBufferBase64: watermarkedBuffer.toString('base64'),
    });
  } catch (error: any) {
    console.error('[DocumentRoutes] Watermark error:', error);
    res.status(500).json({
      error: error.message || 'Failed to watermark PDF',
      code: 'WATERMARK_ERROR',
    });
  }
});

/**
 * GET /v1/cache/:cacheKey
 * Get cached PDF
 * Returns: { buffer: string (base64), originalFilename: string } or 404
 */
router.get('/cache/:cacheKey', async (req: Request, res: Response) => {
  try {
    const { cacheKey } = req.params;
    const result = await getCachedPdf(cacheKey);

    if (!result) {
      return res.status(404).json({
        error: 'Cache miss',
        code: 'CACHE_MISS',
      });
    }

    res.json({
      buffer: result.buffer.toString('base64'),
      originalFilename: result.originalFilename,
    });
  } catch (error: any) {
    console.error('[DocumentRoutes] Get cache error:', error);
    res.status(500).json({
      error: error.message || 'Failed to get cached PDF',
      code: 'CACHE_ERROR',
    });
  }
});

/**
 * POST /v1/cache
 * Store cached PDF
 * Body: { cacheKey: string, pdfBufferBase64: string, metadata: { documentId, version, updatedAt, originalMimeType, originalFilename, isWatermarked, watermarkUserEmail? } }
 * Returns: { success: true }
 */
router.post('/cache', async (req: Request, res: Response) => {
  try {
    const { cacheKey, pdfBufferBase64, metadata } = req.body;

    if (!cacheKey || !pdfBufferBase64 || !metadata) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        details: 'cacheKey, pdfBufferBase64, and metadata are required',
      });
    }

    const pdfBuffer = Buffer.from(pdfBufferBase64, 'base64');
    await setCachedPdf(
      cacheKey,
      pdfBuffer,
      metadata.originalMimeType,
      metadata.originalFilename,
      metadata.isWatermarked,
      metadata.watermarkUserEmail
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('[DocumentRoutes] Set cache error:', error);
    res.status(500).json({
      error: error.message || 'Failed to cache PDF',
      code: 'CACHE_ERROR',
    });
  }
});

/**
 * DELETE /v1/cache/:documentId
 * Invalidate cache for a document
 * Returns: { invalidated: number }
 */
router.delete('/cache/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    await invalidateCache(documentId);

    res.json({ invalidated: 1 });
  } catch (error: any) {
    console.error('[DocumentRoutes] Invalidate cache error:', error);
    res.status(500).json({
      error: error.message || 'Failed to invalidate cache',
      code: 'CACHE_ERROR',
    });
  }
});

export { router as documentRoutes };




