/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Cache directory - use CACHE_DIR env var or default to local cache directory
const CACHE_DIR = process.env.CACHE_DIR || path.join(process.cwd(), 'cache', 'pdf-conversions');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log('[PDFCache] Created cache directory:', CACHE_DIR);
}

interface CacheMetadata {
  documentId: string;
  version: string;
  updatedAt: string;
  convertedAt: string;
  originalMimeType: string;
  originalFilename: string;
  fileSize: number;
  isWatermarked: boolean;
  watermarkUserEmail?: string;
}

/**
 * Get cache file paths
 */
function getCachePaths(cacheKey: string): { pdfPath: string; metaPath: string } {
  return {
    pdfPath: path.join(CACHE_DIR, `${cacheKey}.pdf`),
    metaPath: path.join(CACHE_DIR, `${cacheKey}.meta.json`),
  };
}

/**
 * Check if cached PDF exists and is valid
 * Returns the PDF buffer and original filename if found
 */
export async function getCachedPdf(cacheKey: string): Promise<{ buffer: Buffer; originalFilename: string } | null> {
  try {
    const { pdfPath, metaPath } = getCachePaths(cacheKey);

    console.log('[PDFCache] Checking cache:', {
      cacheKey,
      pdfExists: fs.existsSync(pdfPath),
      metaExists: fs.existsSync(metaPath),
    });

    // Check if both PDF and metadata exist
    if (!fs.existsSync(pdfPath) || !fs.existsSync(metaPath)) {
      console.log('[PDFCache] Cache miss - files do not exist');
      return null;
    }

    // Read and validate metadata
    const metaContent = fs.readFileSync(metaPath, 'utf-8');
    const metadata: CacheMetadata = JSON.parse(metaContent);

    // Check if PDF file still exists and has correct size
    const stats = fs.statSync(pdfPath);
    if (stats.size !== metadata.fileSize) {
      // File size mismatch, cache is invalid
      console.log('[PDFCache] Cache miss - file size mismatch:', {
        expected: metadata.fileSize,
        actual: stats.size,
      });
      try {
        fs.unlinkSync(pdfPath);
        fs.unlinkSync(metaPath);
      } catch (error) {
        // Ignore errors when removing invalid cache
      }
      return null;
    }

    // Cache is valid, return PDF with original filename
    console.log('[PDFCache] Cache hit:', {
      cacheKey,
      size: stats.size,
    });
    return {
      buffer: fs.readFileSync(pdfPath),
      originalFilename: metadata.originalFilename,
    };
  } catch (error: any) {
    console.error('[PDFCache] Error reading cache:', error);
    return null;
  }
}

/**
 * Store converted PDF in cache
 */
export async function setCachedPdf(
  cacheKey: string,
  pdfBuffer: Buffer,
  originalMimeType: string,
  originalFilename: string,
  isWatermarked: boolean,
  watermarkUserEmail?: string
): Promise<void> {
  try {
    const { pdfPath, metaPath } = getCachePaths(cacheKey);

    // Write PDF file
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Write metadata
    const metadata: CacheMetadata = {
      documentId: cacheKey, // Using cacheKey as documentId for simplicity
      version: '1',
      updatedAt: new Date().toISOString(),
      convertedAt: new Date().toISOString(),
      originalMimeType,
      originalFilename,
      fileSize: pdfBuffer.length,
      isWatermarked,
      watermarkUserEmail,
    };
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

    console.log('[PDFCache] Cached PDF:', {
      cacheKey,
      size: pdfBuffer.length,
      isWatermarked,
      watermarkUserEmail,
    });
  } catch (error: any) {
    console.error('[PDFCache] Error writing cache:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Invalidate cache for a document (when document is updated)
 */
export async function invalidateCache(documentId: string): Promise<number> {
  try {
    // Find all cache files for this document
    const files = fs.readdirSync(CACHE_DIR);
    let invalidated = 0;

    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        const metaPath = path.join(CACHE_DIR, file);
        try {
          const metaContent = fs.readFileSync(metaPath, 'utf-8');
          const metadata: CacheMetadata = JSON.parse(metaContent);

          if (metadata.documentId === documentId) {
            // Remove both PDF and metadata files
            const cacheKey = file.replace('.meta.json', '');
            const pdfPath = path.join(CACHE_DIR, `${cacheKey}.pdf`);
            if (fs.existsSync(pdfPath)) {
              fs.unlinkSync(pdfPath);
            }
            fs.unlinkSync(metaPath);
            invalidated++;
          }
        } catch (error) {
          // Skip invalid metadata files
          console.warn('[PDFCache] Invalid metadata file:', file);
        }
      }
    }

    if (invalidated > 0) {
      console.log('[PDFCache] Invalidated cache for document:', { documentId, count: invalidated });
    }

    return invalidated;
  } catch (error: any) {
    console.error('[PDFCache] Error invalidating cache:', error);
    return 0;
  }
}





