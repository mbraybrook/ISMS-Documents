import { promisify } from 'util';
import { config } from '../config';
import { PDFDocument } from 'pdf-lib';

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
 * Remove hyperlinks from PDF while keeping the text
 * @param pdfBuffer - PDF buffer
 * @returns PDF buffer with hyperlinks removed
 */
async function removeHyperlinksFromPdf(pdfBuffer: Buffer): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    let totalLinksRemoved = 0;

    // Remove link annotations from each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageDict = page.node.dict;
      
      // Get annotations array reference
      // pdf-lib uses PDFName objects as keys - need to use the PDFName object directly
      const pageKeys = Array.from(pageDict.keys());
      let annotsRef = null;
      let annotsKey: any = null; // Store the PDFName key for later updates
      
      for (const key of pageKeys) {
        const keyName = (key as any).encodedName || (key as any).name || key.toString();
        if (keyName === '/Annots' || keyName === 'Annots') {
          annotsKey = key; // Store the PDFName key
          annotsRef = pageDict.get(key);
          if (annotsRef) break;
        }
      }
      
      if (!annotsRef || !annotsKey) {
        continue; // No annotations on this page
      }

      // Lookup the annotations array (lookup is synchronous in pdf-lib)
      // The result is a PDFArray object, not a regular JavaScript array
      let annotsArray: any[] = [];
      try {
        const annots = pdfDoc.context.lookup(annotsRef);
        
        // Check if it's a PDFArray (has an 'array' property) or a regular array
        if (Array.isArray(annots)) {
          annotsArray = annots;
        } else if ((annots as any)?.array && Array.isArray((annots as any).array)) {
          // It's a PDFArray - get the actual array of references
          annotsArray = (annots as any).array;
        } else {
          continue;
        }
      } catch (lookupErr: any) {
        console.warn(`[DocumentConversion] Error looking up annotations on page ${i + 1}:`, lookupErr.message);
        continue;
      }

      // Filter out link annotations
      const filteredAnnots = [];
      let linksRemovedOnPage = 0;
      
      for (let j = 0; j < annotsArray.length; j++) {
        const annotRef = annotsArray[j];
        try {
          // Lookup is synchronous, not async
          const annot = pdfDoc.context.lookup(annotRef);
          const annotDict = annot?.dict;
          if (!annotDict) {
            filteredAnnots.push(annotRef);
            continue;
          }

          // Check if this is a link annotation
          const annotKeys = Array.from(annotDict.keys());
          let isLinkAnnotation = false;
          
          // Find Subtype key and get its value
          for (const key of annotKeys) {
            const keyName = (key as any).encodedName || (key as any).name || key.toString();
            if (keyName === '/Subtype' || keyName === 'Subtype') {
              const subtype = annotDict.get(key);
              if (subtype) {
                const subtypeName = ((subtype as any).encodedName || (subtype as any).name || subtype.toString()).replace(/^\//, '');
                if (subtypeName === 'Link') {
                  isLinkAnnotation = true;
                  break;
                }
              }
            }
          }
          
          // Also check for A (Action) dictionary which contains URI actions
          if (!isLinkAnnotation) {
            for (const key of annotKeys) {
              const keyName = (key as any).encodedName || (key as any).name || key.toString();
              if (keyName === '/A' || keyName === 'A') {
                try {
                  const actionRef = annotDict.get(key);
                  if (actionRef) {
                    const actionDict = pdfDoc.context.lookup(actionRef);
                    const actionDictObj = actionDict?.dict;
                    if (actionDictObj) {
                      const actionKeys = Array.from(actionDictObj.keys());
                      for (const actionKey of actionKeys) {
                        const actionKeyName = (actionKey as any).encodedName || (actionKey as any).name || actionKey.toString();
                        if (actionKeyName === '/S' || actionKeyName === 'S') {
                          const actionType = actionDictObj.get(actionKey);
                          const actionTypeName = ((actionType as any)?.encodedName || (actionType as any)?.name || actionType?.toString())?.replace(/^\//, '');
                          if (actionTypeName === 'URI') {
                            isLinkAnnotation = true;
                            break;
                          }
                        }
                      }
                    }
                  }
                } catch (actionErr: any) {
                  // Ignore action lookup errors
                }
                break;
              }
            }
          }
          
          // Keep only non-link annotations
          if (!isLinkAnnotation) {
            filteredAnnots.push(annotRef);
          } else {
            linksRemovedOnPage++;
            totalLinksRemoved++;
          }
        } catch (err: any) {
          console.warn(`[DocumentConversion] Page ${i + 1}, Annotation ${j + 1}: Error processing:`, err.message);
          // If we can't read the annotation, keep it to be safe
          filteredAnnots.push(annotRef);
        }
      }

      // Update annotations array if we removed any links
      if (linksRemovedOnPage > 0) {
        const PDFArray = (pdfDoc.context as any).PDFArray;
        
        if (filteredAnnots.length === 0) {
          // Set to empty array or delete the key
          if (PDFArray && PDFArray.of) {
            const emptyAnnotsArray = PDFArray.of();
            pageDict.set(annotsKey, emptyAnnotsArray);
          } else {
            pageDict.delete(annotsKey);
          }
        } else {
          // Create new PDFArray with filtered annotations
          if (PDFArray && PDFArray.of) {
            const newAnnotsArray = PDFArray.of(...filteredAnnots);
            pageDict.set(annotsKey, newAnnotsArray);
          } else {
            const newAnnotsArray = pdfDoc.context.obj(filteredAnnots);
            pageDict.set(annotsKey, newAnnotsArray);
          }
        }
      }
    }

    if (totalLinksRemoved > 0) {
      console.log(`[DocumentConversion] Removed ${totalLinksRemoved} hyperlink(s) from PDF`);
    }

    // Serialize the PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error: any) {
    console.warn('[DocumentConversion] Failed to remove hyperlinks, using original PDF:', error.message);
    // Return original PDF if hyperlink removal fails
    return pdfBuffer;
  }
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
    let pdfBuffer = await convert(buffer, '.pdf', undefined);

    // Remove hyperlinks from the converted PDF
    pdfBuffer = await removeHyperlinksFromPdf(Buffer.from(pdfBuffer));

    console.log('[DocumentConversion] Conversion successful:', {
      originalSize: buffer.length,
      pdfSize: pdfBuffer.length,
      filename,
    });

    return pdfBuffer;
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

