/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';
import { getAppOnlyAccessToken, getSharePointItem } from './sharePointService';

export interface ChangeCheckResult {
  checked: number;
  changed: number;
  errors: number;
  skipped: number;
}

/**
 * Check a single document for changes in SharePoint
 * @param documentId - The document ID to check
 * @returns true if document was changed, false if not, null if error
 */
export async function checkSingleDocument(documentId: string): Promise<boolean | null> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        storageLocation: true,
        sharePointSiteId: true,
        sharePointDriveId: true,
        sharePointItemId: true,
        lastChecked: true,
        lastModified: true,
      },
    });

    if (!document) {
      log.warn('[DocumentChangeService] Document not found', { documentId });
      return null;
    }

    // Only check SharePoint documents
    if (document.storageLocation !== 'SHAREPOINT') {
      log.debug('[DocumentChangeService] Skipping non-SharePoint document', {
        documentId,
        storageLocation: document.storageLocation,
      });
      return null;
    }

    // Check if document has required SharePoint IDs
    if (!document.sharePointSiteId || !document.sharePointDriveId || !document.sharePointItemId) {
      log.warn('[DocumentChangeService] Document missing SharePoint IDs', {
        documentId,
        title: document.title,
      });
      return null;
    }

    // Get app-only access token
    const accessToken = await getAppOnlyAccessToken();
    if (!accessToken) {
      log.error('[DocumentChangeService] Failed to get app-only access token');
      return null;
    }

    // Get SharePoint item metadata
    const item = await getSharePointItem(
      accessToken,
      document.sharePointSiteId,
      document.sharePointDriveId,
      document.sharePointItemId
    );

    if (!item) {
      log.warn('[DocumentChangeService] Failed to fetch SharePoint item', {
        documentId,
        title: document.title,
        siteId: document.sharePointSiteId,
        driveId: document.sharePointDriveId,
        itemId: document.sharePointItemId,
      });
      return null;
    }

    // Parse lastModifiedDateTime from SharePoint
    const sharePointLastModified = item.lastModifiedDateTime
      ? new Date(item.lastModifiedDateTime)
      : null;

    if (!sharePointLastModified) {
      log.warn('[DocumentChangeService] SharePoint item missing lastModifiedDateTime', {
        documentId,
        title: document.title,
      });
      return null;
    }

    // Determine if document has changed
    let hasChanged = false;
    if (document.lastChecked) {
      // Document was checked before - compare dates
      hasChanged = sharePointLastModified > document.lastChecked;
    } else {
      // First check - don't mark as changed, just record the date
      hasChanged = false;
    }

    // Update database
    await prisma.document.update({
      where: { id: documentId },
      data: {
        hasChanged,
        lastChecked: new Date(),
        lastModified: sharePointLastModified,
      },
    });

    log.debug('[DocumentChangeService] Document checked', {
      documentId,
      title: document.title,
      hasChanged,
      lastModified: sharePointLastModified.toISOString(),
      previousLastChecked: document.lastChecked?.toISOString() || null,
    });

    return hasChanged;
  } catch (error: any) {
    log.error('[DocumentChangeService] Error checking single document', {
      documentId,
      error: error.message,
      statusCode: error.statusCode,
      code: error.code,
    });
    return null;
  }
}

/**
 * Check all SharePoint documents for changes
 * Processes documents in batches to avoid overwhelming the Graph API
 * @param batchSize - Number of documents to process in each batch (default: 50)
 * @param delayBetweenBatches - Delay in milliseconds between batches (default: 1000)
 * @returns Summary of the check operation
 */
export async function checkDocumentChanges(
  batchSize = 50,
  delayBetweenBatches = 1000
): Promise<ChangeCheckResult> {
  const result: ChangeCheckResult = {
    checked: 0,
    changed: 0,
    errors: 0,
    skipped: 0,
  };

  try {
    log.info('[DocumentChangeService] Starting document change check', {
      batchSize,
      delayBetweenBatches,
    });

    // Get app-only access token once for all checks
    const accessToken = await getAppOnlyAccessToken();
    if (!accessToken) {
      log.error('[DocumentChangeService] Failed to get app-only access token');
      throw new Error('Failed to get app-only access token');
    }

    // Fetch all SharePoint documents
    const documents = await prisma.document.findMany({
      where: {
        storageLocation: 'SHAREPOINT',
        sharePointSiteId: { not: null },
        sharePointDriveId: { not: null },
        sharePointItemId: { not: null },
      },
      select: {
        id: true,
        title: true,
        sharePointSiteId: true,
        sharePointDriveId: true,
        sharePointItemId: true,
        lastChecked: true,
        lastModified: true,
      },
    });

    log.info('[DocumentChangeService] Found documents to check', {
      totalDocuments: documents.length,
    });

    // Process documents in batches
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      log.debug('[DocumentChangeService] Processing batch', {
        batchNumber: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
        totalBatches: Math.ceil(documents.length / batchSize),
      });

      // Process batch in parallel (with concurrency limit)
      const batchPromises = batch.map(async (doc) => {
        try {
          // Get SharePoint item metadata
          const item = await getSharePointItem(
            accessToken,
            doc.sharePointSiteId!,
            doc.sharePointDriveId!,
            doc.sharePointItemId!
          );

          if (!item) {
            result.skipped++;
            log.debug('[DocumentChangeService] Skipped document (item not found)', {
              documentId: doc.id,
              title: doc.title,
            });
            return;
          }

          // Parse lastModifiedDateTime from SharePoint
          const sharePointLastModified = item.lastModifiedDateTime
            ? new Date(item.lastModifiedDateTime)
            : null;

          if (!sharePointLastModified) {
            result.skipped++;
            log.debug('[DocumentChangeService] Skipped document (no lastModifiedDateTime)', {
              documentId: doc.id,
              title: doc.title,
            });
            return;
          }

          // Determine if document has changed
          let hasChanged = false;
          if (doc.lastChecked) {
            // Document was checked before - compare dates
            hasChanged = sharePointLastModified > doc.lastChecked;
          } else {
            // First check - don't mark as changed, just record the date
            hasChanged = false;
          }

          // Update database
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              hasChanged,
              lastChecked: new Date(),
              lastModified: sharePointLastModified,
            },
          });

          result.checked++;
          if (hasChanged) {
            result.changed++;
          }

          log.debug('[DocumentChangeService] Document checked', {
            documentId: doc.id,
            title: doc.title,
            hasChanged,
            lastModified: sharePointLastModified.toISOString(),
            previousLastChecked: doc.lastChecked?.toISOString() || null,
          });
        } catch (error: any) {
          result.errors++;
          log.warn('[DocumentChangeService] Error checking document', {
            documentId: doc.id,
            title: doc.title,
            error: error.message,
            statusCode: error.statusCode,
            code: error.code,
          });
        }
      });

      // Wait for batch to complete
      await Promise.all(batchPromises);

      // Add delay between batches (except for the last batch)
      if (i + batchSize < documents.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    log.info('[DocumentChangeService] Document change check completed', result);
    return result;
  } catch (error: any) {
    log.error('[DocumentChangeService] Fatal error during document change check', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

