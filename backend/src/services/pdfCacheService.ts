import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Cache directory for converted PDFs
const CACHE_DIR = path.join(process.cwd(), 'cache', 'pdf-conversions');

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
 * Generate cache key from document metadata
 */
function getCacheKey(
  documentId: string,
  version: string,
  updatedAt: Date,
  isWatermarked: boolean,
  watermarkUserEmail?: string
): string {
  const keyData = `${documentId}-${version}-${updatedAt.toISOString()}-${isWatermarked}-${watermarkUserEmail || ''}`;
  return crypto.createHash('sha256').update(keyData).digest('hex');
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
export async function getCachedPdf(
  documentId: string,
  version: string,
  updatedAt: Date,
  isWatermarked: boolean,
  watermarkUserEmail?: string
): Promise<{ buffer: Buffer; originalFilename: string } | null> {
  try {
    const cacheKey = getCacheKey(documentId, version, updatedAt, isWatermarked, watermarkUserEmail);
    const { pdfPath, metaPath } = getCachePaths(cacheKey);

    console.log('[PDFCache] Checking cache:', {
      documentId,
      version,
      updatedAt: updatedAt.toISOString(),
      isWatermarked,
      watermarkUserEmail,
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

    // Verify metadata matches
    const updatedAtIso = updatedAt.toISOString();
    const documentIdMatch = metadata.documentId === documentId;
    const versionMatch = metadata.version === version;
    const updatedAtMatch = metadata.updatedAt === updatedAtIso;
    const isWatermarkedMatch = metadata.isWatermarked === isWatermarked;
    // For watermarked documents, email must match; for non-watermarked, both should be undefined/empty
    const emailMatch = isWatermarked
      ? metadata.watermarkUserEmail === watermarkUserEmail
      : !metadata.watermarkUserEmail && !watermarkUserEmail;

    if (!documentIdMatch || !versionMatch || !updatedAtMatch || !isWatermarkedMatch || !emailMatch) {
      // Cache is stale, remove it
      console.log('[PDFCache] Cache miss - metadata mismatch:', {
        documentIdMatch,
        versionMatch,
        updatedAtMatch,
        updatedAtExpected: updatedAtIso,
        updatedAtActual: metadata.updatedAt,
        isWatermarkedMatch,
        emailMatch,
        emailExpected: watermarkUserEmail,
        emailActual: metadata.watermarkUserEmail,
      });
      try {
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      } catch (error) {
        // Ignore errors when removing stale cache
      }
      return null;
    }

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
      documentId,
      version,
      cacheKey,
      isWatermarked,
      watermarkUserEmail,
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
  documentId: string,
  version: string,
  updatedAt: Date,
  pdfBuffer: Buffer,
  originalMimeType: string,
  originalFilename: string,
  isWatermarked: boolean,
  watermarkUserEmail?: string
): Promise<void> {
  try {
    const cacheKey = getCacheKey(documentId, version, updatedAt, isWatermarked, watermarkUserEmail);
    const { pdfPath, metaPath } = getCachePaths(cacheKey);

    // Write PDF file
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Write metadata
    const metadata: CacheMetadata = {
      documentId,
      version,
      updatedAt: updatedAt.toISOString(),
      convertedAt: new Date().toISOString(),
      originalMimeType,
      originalFilename,
      fileSize: pdfBuffer.length,
      isWatermarked,
      watermarkUserEmail,
    };
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

    console.log('[PDFCache] Cached PDF:', {
      documentId,
      version,
      cacheKey,
      size: pdfBuffer.length,
      isWatermarked,
      watermarkUserEmail,
      updatedAt: updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('[PDFCache] Error writing cache:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Invalidate cache for a document (when document is updated)
 */
export async function invalidateCache(documentId: string): Promise<void> {
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
  } catch (error: any) {
    console.error('[PDFCache] Error invalidating cache:', error);
  }
}

/**
 * Clean up old cache files (older than specified days)
 */
export async function cleanupCache(maxAgeDays: number = 30): Promise<void> {
  try {
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const files = fs.readdirSync(CACHE_DIR);
    let cleaned = 0;

    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        const metaPath = path.join(CACHE_DIR, file);
        try {
          const stats = fs.statSync(metaPath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            // Remove old cache files
            const cacheKey = file.replace('.meta.json', '');
            const pdfPath = path.join(CACHE_DIR, `${cacheKey}.pdf`);
            if (fs.existsSync(pdfPath)) {
              fs.unlinkSync(pdfPath);
            }
            fs.unlinkSync(metaPath);
            cleaned++;
          }
        } catch (error) {
          // Skip files that can't be processed
        }
      }
    }

    if (cleaned > 0) {
      console.log('[PDFCache] Cleaned up old cache files:', { count: cleaned });
    }
  } catch (error: any) {
    console.error('[PDFCache] Error cleaning cache:', error);
  }
}

