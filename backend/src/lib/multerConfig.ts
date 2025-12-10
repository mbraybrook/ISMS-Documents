/* eslint-disable @typescript-eslint/no-explicit-any */
import multer from 'multer';

/**
 * CSV file magic numbers/signatures for validation
 * CSV files typically start with text, but we check for common CSV patterns
 */
const CSV_MAGIC_BYTES = [
  // UTF-8 BOM (optional)
  Buffer.from([0xEF, 0xBB, 0xBF]),
  // UTF-16 LE BOM
  Buffer.from([0xFF, 0xFE]),
  // UTF-16 BE BOM
  Buffer.from([0xFE, 0xFF]),
];

/**
 * Validates file content by checking magic numbers and content structure
 * This provides additional security beyond mimetype/extension checking
 */
function validateCsvContent(buffer: Buffer): boolean {
  if (!buffer || buffer.length === 0) {
    return false;
  }

  // Check for BOM (optional, but if present should match known BOMs)
  const hasValidBOM = CSV_MAGIC_BYTES.some((bom) => buffer.subarray(0, bom.length).equals(bom));
  
  // Get content start (skip BOM if present)
  const startOffset = hasValidBOM ? 3 : 0;
  const contentStart = buffer.subarray(startOffset, Math.min(startOffset + 100, buffer.length));
  
  // CSV files should contain printable characters and common CSV delimiters
  // Check for presence of commas, semicolons, or tabs (common CSV delimiters)
  const contentStr = contentStart.toString('utf-8', 0, Math.min(100, contentStart.length));
  const hasDelimiter = /[,;\t]/.test(contentStr);
  const hasPrintableChars = /^[\x20-\x7E\n\r\t]*$/.test(contentStr.substring(0, 100));
  
  // Basic validation: should have delimiters and printable characters
  return hasDelimiter && hasPrintableChars;
}

/**
 * Shared multer configuration for CSV file uploads
 * Used across multiple routes for consistent file upload security
 */
export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // First check mimetype and extension
    if (file.mimetype !== 'text/csv' && !file.originalname.toLowerCase().endsWith('.csv')) {
      return cb(new Error('Only CSV files are allowed'));
    }
    
    // Additional validation will be done after file is uploaded
    // by checking the buffer content in the route handler
    cb(null, true);
  },
});

/**
 * Validates uploaded CSV file content
 * Should be called after multer processes the file
 * @param buffer File buffer from multer
 * @returns Validation result with error message if invalid
 */
export function validateCsvFile(buffer: Buffer): { valid: boolean; error?: string } {
  if (!buffer) {
    return { valid: false, error: 'File buffer is empty' };
  }

  if (buffer.length === 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (buffer.length > 10 * 1024 * 1024) {
    return { valid: false, error: 'File exceeds maximum size of 10MB' };
  }

  // Validate file content structure
  if (!validateCsvContent(buffer)) {
    return { 
      valid: false, 
      error: 'File does not appear to be a valid CSV file. Content validation failed.' 
    };
  }

  return { valid: true };
}

/**
 * Error handler for multer errors
 * Can be used as middleware to handle multer-specific errors
 */
export const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    return res.status(400).json({ error: err.message || 'File upload error' });
  }
  next();
};

