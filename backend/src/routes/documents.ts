/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { getSharePointItem, generateSharePointUrl } from '../services/sharePointService';
import { generateConfluenceUrl } from '../services/confluenceService';
import { invalidateCache } from '../services/pdfCacheService';
import { config } from '../config';
import { generateEmbedding, cosineSimilarity, mapToScore } from '../services/llmService';

const router = Router();

// Validation middleware
const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/documents - list with filtering
router.get(
  '/',
  authenticateToken,
  [
    query('type').optional().isIn(['POLICY', 'PROCEDURE', 'MANUAL', 'RECORD', 'TEMPLATE', 'CERTIFICATE', 'OTHER']),
    query('status').optional().isIn(['DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED']),
    query('ownerId').optional().isUUID(),
    query('nextReviewFrom').optional().isISO8601(),
    query('nextReviewTo').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 10000 }),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Get user role for filtering
      let userRole: string | null = null;
      if (req.user?.email) {
        const user = await prisma.user.findUnique({
          where: { email: req.user.email },
          select: { role: true },
        });
        userRole = user?.role || null;
      }

      const {
        type,
        status,
        ownerId,
        nextReviewFrom,
        nextReviewTo,
        page = '1',
        limit = '20',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      // STAFF and CONTRIBUTOR users can only see APPROVED documents
      if (userRole === 'STAFF' || userRole === 'CONTRIBUTOR') {
        where.status = 'APPROVED';
      } else {
        // ADMIN/EDITOR can see all documents, but respect status filter if provided
        if (status) where.status = status;
      }

      if (type) where.type = type;
      if (ownerId) where.ownerUserId = ownerId as string;

      if (nextReviewFrom || nextReviewTo) {
        where.nextReviewDate = {};
        if (nextReviewFrom) {
          where.nextReviewDate.gte = new Date(nextReviewFrom as string);
        }
        if (nextReviewTo) {
          where.nextReviewDate.lte = new Date(nextReviewTo as string);
        }
      }

      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where,
          include: {
            owner: {
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            },
          },
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.document.count({ where }),
      ]);

      // Generate and store missing URLs for documents in the current page
      // This ensures URLs are stored and returned in the response
      const accessToken = req.headers['x-graph-token'] as string;
      const documentsNeedingUrls = documents.filter(
        doc => !doc.documentUrl &&
          ((doc.storageLocation === 'SHAREPOINT' && doc.sharePointSiteId && doc.sharePointDriveId && doc.sharePointItemId) ||
            (doc.storageLocation === 'CONFLUENCE' && doc.confluenceSpaceKey && doc.confluencePageId))
      );

      if (documentsNeedingUrls.length > 0) {
        console.log(`[DOCUMENTS] Generating URLs for ${documentsNeedingUrls.length} documents missing documentUrl`);

        // Generate URLs and update documents array and database
        const urlPromises = documentsNeedingUrls.map(async (doc) => {
          try {
            let url: string | null = null;

            if (doc.storageLocation === 'SHAREPOINT' && doc.sharePointSiteId && doc.sharePointDriveId && doc.sharePointItemId) {
              url = await generateSharePointUrl(
                doc.sharePointSiteId,
                doc.sharePointDriveId,
                doc.sharePointItemId,
                accessToken
              );
            } else if (doc.storageLocation === 'CONFLUENCE' && doc.confluenceSpaceKey && doc.confluencePageId) {
              if (config.confluence.baseUrl) {
                url = generateConfluenceUrl(
                  config.confluence.baseUrl,
                  doc.confluenceSpaceKey,
                  doc.confluencePageId
                );
              }
            }

            if (url) {
              // Update database
              await prisma.document.update({
                where: { id: doc.id },
                data: { documentUrl: url },
              });

              // Update the document in the array so it's returned with the URL
              doc.documentUrl = url;
              console.log(`[DOCUMENTS] Stored URL for document ${doc.id}: ${url}`);
            }
          } catch (error) {
            console.error(`[DOCUMENTS] Error generating URL for document ${doc.id}:`, error);
          }
        });

        // Wait for all URL generations to complete (with timeout to avoid blocking too long)
        await Promise.allSettled(urlPromises);
      }

      // Add computed fields for review status
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      const documentsWithComputedFields = documents.map((doc) => {
        const docData: any = {
          ...doc,
          requiresAcknowledgement: doc.requiresAcknowledgement,
          lastChangedDate: doc.lastChangedDate,
          lastReviewDate: doc.lastReviewDate,
          nextReviewDate: doc.nextReviewDate,
        };

        // Compute review status flags
        if (doc.nextReviewDate && (doc.status === 'APPROVED' || doc.status === 'IN_REVIEW')) {
          const nextReview = new Date(doc.nextReviewDate);
          docData.isOverdueReview = nextReview < now;
          docData.isUpcomingReview = nextReview >= now && nextReview <= thirtyDaysFromNow;
        } else {
          docData.isOverdueReview = false;
          docData.isUpcomingReview = false;
        }

        return docData;
      });


      // Log for debugging
      const sharePointDocs = documents.filter(d => d.storageLocation === 'SHAREPOINT');
      const _sampleSharePointDoc = sharePointDocs[0];
      

      res.json({
        data: documentsWithComputedFields,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  }
);

// GET /api/documents/:id - get document details
router.get(
  '/:id',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Get user role for access control
      let userRole: string | null = null;
      if (req.user?.email) {
        const user = await prisma.user.findUnique({
          where: { email: req.user.email },
          select: { role: true },
        });
        userRole = user?.role || null;
      }

      const { id } = req.params;

      const document = await prisma.document.findUnique({
        where: { id },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          DocumentControl: {
            include: {
              control: true,
            },
          },
          DocumentRisk: {
            include: {
              risk: true,
            },
          },
        },
      });

      // Fetch current version notes separately
      let currentVersionNotes = null;
      if (document) {
        const versionHistory = await prisma.documentVersionHistory.findFirst({
          where: {
            documentId: id,
            version: document.version,
          },
          orderBy: { updatedAt: 'desc' },
        });
        currentVersionNotes = versionHistory?.notes || null;
      }

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // STAFF and CONTRIBUTOR users can only see APPROVED documents
      if ((userRole === 'STAFF' || userRole === 'CONTRIBUTOR') && document.status !== 'APPROVED') {
        return res.status(403).json({ error: 'Access denied. Only approved documents are available.' });
      }

      // Attach current version notes to response
      const response = {
        ...document,
        currentVersionNotes,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching document:', error);
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  }
);

// GET /api/documents/:id/version-notes - get version notes for a specific version
router.get(
  '/:id/version-notes',
  authenticateToken,
  [
    param('id').isUUID(),
    query('version').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const versionParam = req.query.version as string | undefined;

      // Fetch document to get current version
      const document = await prisma.document.findUnique({
        where: { id },
        select: { version: true },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Resolve version: if 'current' or not provided, use document's current version
      const resolvedVersion = versionParam === 'current' || !versionParam
        ? document.version
        : versionParam;

      // Query DocumentVersionHistory for the resolved version
      const versionHistory = await prisma.documentVersionHistory.findFirst({
        where: {
          documentId: id,
          version: resolvedVersion,
        },
        orderBy: { updatedAt: 'desc' },
      });

      res.json({
        documentId: id,
        version: resolvedVersion,
        notes: versionHistory?.notes || null,
      });
    } catch (error) {
      console.error('Error fetching version notes:', error);
      res.status(500).json({ error: 'Failed to fetch version notes' });
    }
  }
);

// GET /api/documents/:id/version-history - get full version history (Admin/Editor only)
router.get(
  '/:id/version-history',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Verify document exists
      const document = await prisma.document.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Get all version history for this document, ordered by creation date
      const versionHistory = await prisma.documentVersionHistory.findMany({
        where: { documentId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              version: true,
            },
          },
        },
      });

      res.json(versionHistory);
    } catch (error) {
      console.error('Error fetching version history:', error);
      res.status(500).json({ error: 'Failed to fetch version history' });
    }
  }
);

// POST /api/documents - create document
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('title').notEmpty().trim(),
    body('type').isIn(['POLICY', 'PROCEDURE', 'MANUAL', 'RECORD', 'TEMPLATE', 'CERTIFICATE', 'OTHER']),
    body('storageLocation').isIn(['SHAREPOINT', 'CONFLUENCE']),
    body('version').notEmpty().trim(),
    body('status').isIn(['DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED']),
    body('ownerUserId').isUUID(),
    body('sharePointSiteId').optional().isString(),
    body('sharePointDriveId').optional().isString(),
    body('sharePointItemId').optional().isString(),
    body('confluenceSpaceKey').optional().isString(),
    body('confluencePageId').optional().isString(),
    body('lastReviewDate').optional().isISO8601(),
    body('nextReviewDate').optional().isISO8601(),
    body('requiresAcknowledgement').optional().isBoolean(),
    body('lastChangedDate').optional().isISO8601(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Convert date strings to DateTime objects if provided
      const data: any = { ...req.body };

      // Auto-set requiresAcknowledgement based on type
      if (data.type === 'POLICY' && !('requiresAcknowledgement' in data)) {
        data.requiresAcknowledgement = true;
      }
      if (data.lastReviewDate && typeof data.lastReviewDate === 'string') {
        // If it's just a date (YYYY-MM-DD), convert to full datetime
        if (data.lastReviewDate.length === 10) {
          data.lastReviewDate = new Date(data.lastReviewDate + 'T00:00:00.000Z');
        } else {
          data.lastReviewDate = new Date(data.lastReviewDate);
        }
      }
      if (data.nextReviewDate && typeof data.nextReviewDate === 'string') {
        // If it's just a date (YYYY-MM-DD), convert to full datetime
        if (data.nextReviewDate.length === 10) {
          data.nextReviewDate = new Date(data.nextReviewDate + 'T00:00:00.000Z');
        } else {
          data.nextReviewDate = new Date(data.nextReviewDate);
        }
      }

      // Generate and store document URL if storage location IDs are provided
      if (data.storageLocation === 'SHAREPOINT' && data.sharePointSiteId && data.sharePointDriveId && data.sharePointItemId) {
        try {
          const accessToken = req.headers['x-graph-token'] as string;
          const url = await generateSharePointUrl(
            data.sharePointSiteId,
            data.sharePointDriveId,
            data.sharePointItemId,
            accessToken
          );
          if (url) {
            data.documentUrl = url;
          } else {
            console.warn('[Document Creation] Could not generate SharePoint URL - access token may be missing');
          }
        } catch (error) {
          console.error('[Document Creation] Error generating SharePoint URL:', error);
          // Continue without URL - it can be generated later
        }
      } else if (data.storageLocation === 'CONFLUENCE' && data.confluenceSpaceKey && data.confluencePageId) {
        try {
          if (config.confluence.baseUrl) {
            const url = generateConfluenceUrl(
              config.confluence.baseUrl,
              data.confluenceSpaceKey,
              data.confluencePageId
            );
            data.documentUrl = url;
            console.log('[Document Creation] Generated Confluence URL:', url);
          } else {
            console.warn('[Document Creation] Confluence base URL not configured');
          }
        } catch (error) {
          console.error('[Document Creation] Error generating Confluence URL:', error);
          // Continue without URL - it can be generated later
        }
      }

      // Generate UUID for document ID (required in PostgreSQL)
      if (!data.id) {
        data.id = randomUUID();
      }

      // Handle versionNotes separately (it belongs to DocumentVersionHistory, not Document)
      const versionNotes = data.versionNotes;
      delete data.versionNotes; // Remove from document creation data

      // Get current user ID for version history
      let currentUser = null;
      if (req.user?.email) {
        currentUser = await prisma.user.findUnique({
          where: { email: req.user.email },
          select: { id: true },
        });
      }

      // Note: updatedAt is now handled automatically by Prisma via @updatedAt

      const document = await prisma.document.create({
        data,
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Create initial version history entry if versionNotes provided
      if (versionNotes && currentUser) {
        try {
          await prisma.documentVersionHistory.create({
            data: {
              id: randomUUID(),
              documentId: document.id,
              version: document.version,
              notes: versionNotes || null,
              createdAt: new Date(),
              createdBy: currentUser.id,
              updatedAt: new Date(),
              updatedBy: currentUser.id,
              sharePointSiteId: document.sharePointSiteId || null,
              sharePointDriveId: document.sharePointDriveId || null,
              sharePointItemId: document.sharePointItemId || null,
            },
          });
        } catch (error) {
          console.error('[Document Creation] Error creating version history:', error);
          // Don't fail document creation if version history fails
        }
      }

      res.status(201).json(document);
    } catch (error) {
      console.error('Error creating document:', error);
      res.status(500).json({ error: 'Failed to create document' });
    }
  }
);

// PUT /api/documents/:id - update document
router.put(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('title').optional().notEmpty().trim(),
    body('type').optional().isIn(['POLICY', 'PROCEDURE', 'MANUAL', 'RECORD', 'TEMPLATE', 'CERTIFICATE', 'OTHER']),
    body('storageLocation').optional().isIn(['SHAREPOINT', 'CONFLUENCE']),
    body('status').optional().isIn(['DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED']),
    body('ownerUserId').optional().isUUID(),
    body('requiresAcknowledgement').optional().isBoolean(),
    body('lastChangedDate').optional().isISO8601(),
    body('versionNotes').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Get existing document to check for version changes
      const existingDocument = await prisma.document.findUnique({
        where: { id },
      });

      if (!existingDocument) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Convert date strings to DateTime objects if provided
      const data: any = { ...req.body };
      delete data.version; // Prevent version update via this endpoint
      if (data.lastReviewDate && typeof data.lastReviewDate === 'string') {
        // If it's just a date (YYYY-MM-DD), convert to full datetime
        if (data.lastReviewDate.length === 10) {
          data.lastReviewDate = new Date(data.lastReviewDate + 'T00:00:00.000Z');
        } else {
          data.lastReviewDate = new Date(data.lastReviewDate);
        }
      }
      if (data.nextReviewDate && typeof data.nextReviewDate === 'string') {
        // If it's just a date (YYYY-MM-DD), convert to full datetime
        if (data.nextReviewDate.length === 10) {
          data.nextReviewDate = new Date(data.nextReviewDate + 'T00:00:00.000Z');
        } else {
          data.nextReviewDate = new Date(data.nextReviewDate);
        }
      }
      if (data.lastChangedDate && typeof data.lastChangedDate === 'string') {
        if (data.lastChangedDate.length === 10) {
          data.lastChangedDate = new Date(data.lastChangedDate + 'T00:00:00.000Z');
        } else {
          data.lastChangedDate = new Date(data.lastChangedDate);
        }
      }

      // Note: Review dates (lastReviewDate and nextReviewDate) are now managed through
      // the version update flow. They can still be set here for new documents or manual updates,
      // but they are no longer auto-updated on every document edit.

      // Handle version notes update for current version
      // Note: Version changes must be done through the /version-updates endpoint
      if ('versionNotes' in data) {
        const versionNotes = data.versionNotes;
        delete data.versionNotes; // Remove from document update data

        // Get current user ID for version history
        if (req.user?.email) {
          const currentUser = await prisma.user.findUnique({
            where: { email: req.user.email },
            select: { id: true },
          });

          if (currentUser) {
            // Upsert version notes for current version
            const existingVersionHistory = await prisma.documentVersionHistory.findFirst({
              where: {
                documentId: id,
                version: existingDocument.version,
              },
            });

            if (existingVersionHistory) {
              // Update existing record
              await prisma.documentVersionHistory.update({
                where: { id: existingVersionHistory.id },
                data: {
                  notes: versionNotes || null,
                  updatedAt: new Date(),
                  updatedBy: currentUser.id,
                  // Preserve SharePoint IDs
                  sharePointSiteId: existingDocument.sharePointSiteId || undefined,
                  sharePointDriveId: existingDocument.sharePointDriveId || undefined,
                  sharePointItemId: existingDocument.sharePointItemId || undefined,
                },
              });
            } else {
              // Create new record for current version
              await prisma.documentVersionHistory.create({
                data: {
                  id: randomUUID(),
                  documentId: id,
                  version: existingDocument.version,
                  notes: versionNotes || null,
                  createdAt: new Date(),
                  createdBy: currentUser.id,
                  updatedAt: new Date(),
                  updatedBy: currentUser.id,
                  // Store SharePoint IDs for history restoration
                  sharePointSiteId: existingDocument.sharePointSiteId || null,
                  sharePointDriveId: existingDocument.sharePointDriveId || null,
                  sharePointItemId: existingDocument.sharePointItemId || null,
                },
              });
            }
          }
        }
      }

      // Auto-set requiresAcknowledgement based on type
      // If type is being changed to POLICY, default to true (but allow manual override)
      if (data.type && data.type === 'POLICY' && existingDocument.type !== 'POLICY') {
        // Type changed to POLICY - default to true if not explicitly provided
        if (!('requiresAcknowledgement' in data)) {
          data.requiresAcknowledgement = true;
        }
      } else if (data.type && data.type !== 'POLICY' && existingDocument.type === 'POLICY') {
        // Type changed away from POLICY - allow the value to be set (no auto-enforcement)
        // The value in data.requiresAcknowledgement will be used as-is
      }
      // Note: If type is not changing, requiresAcknowledgement can be set to any value by the user

      // Determine the storage location (use new value if provided, otherwise existing)
      const storageLocation = data.storageLocation || existingDocument.storageLocation;

      // Check if SharePoint IDs have changed and regenerate URL if needed
      const sharePointIdsChanged =
        data.sharePointSiteId !== undefined && data.sharePointSiteId !== existingDocument.sharePointSiteId ||
        data.sharePointDriveId !== undefined && data.sharePointDriveId !== existingDocument.sharePointDriveId ||
        data.sharePointItemId !== undefined && data.sharePointItemId !== existingDocument.sharePointItemId ||
        data.storageLocation !== undefined && data.storageLocation !== existingDocument.storageLocation;

      // Check if Confluence IDs have changed and regenerate URL if needed
      const confluenceIdsChanged =
        data.confluenceSpaceKey !== undefined && data.confluenceSpaceKey !== existingDocument.confluenceSpaceKey ||
        data.confluencePageId !== undefined && data.confluencePageId !== existingDocument.confluencePageId ||
        data.storageLocation !== undefined && data.storageLocation !== existingDocument.storageLocation;

      // Regenerate URL if storage location IDs have changed
      if (sharePointIdsChanged && storageLocation === 'SHAREPOINT') {
        const siteId = data.sharePointSiteId !== undefined ? data.sharePointSiteId : existingDocument.sharePointSiteId;
        const driveId = data.sharePointDriveId !== undefined ? data.sharePointDriveId : existingDocument.sharePointDriveId;
        const itemId = data.sharePointItemId !== undefined ? data.sharePointItemId : existingDocument.sharePointItemId;

        if (siteId && driveId && itemId) {
          try {
            const accessToken = req.headers['x-graph-token'] as string;
            const url = await generateSharePointUrl(siteId, driveId, itemId, accessToken);
            if (url) {
              data.documentUrl = url;
              console.log('[Document Update] Regenerated SharePoint URL:', url);
            } else {
              console.warn('[Document Update] Could not regenerate SharePoint URL - access token may be missing');
              // Clear the URL if we can't generate it
              data.documentUrl = null;
            }
          } catch (error) {
            console.error('[Document Update] Error regenerating SharePoint URL:', error);
            // Clear the URL on error
            data.documentUrl = null;
          }
        } else {
          // Clear URL if IDs are incomplete
          data.documentUrl = null;
        }
      } else if (confluenceIdsChanged && storageLocation === 'CONFLUENCE') {
        const spaceKey = data.confluenceSpaceKey !== undefined ? data.confluenceSpaceKey : existingDocument.confluenceSpaceKey;
        const pageId = data.confluencePageId !== undefined ? data.confluencePageId : existingDocument.confluencePageId;

        if (spaceKey && pageId) {
          try {
            if (config.confluence.baseUrl) {
              const url = generateConfluenceUrl(config.confluence.baseUrl, spaceKey, pageId);
              data.documentUrl = url;
              console.log('[Document Update] Regenerated Confluence URL:', url);
            } else {
              console.warn('[Document Update] Confluence base URL not configured');
              data.documentUrl = null;
            }
          } catch (error) {
            console.error('[Document Update] Error regenerating Confluence URL:', error);
            data.documentUrl = null;
          }
        } else {
          // Clear URL if IDs are incomplete
          data.documentUrl = null;
        }
      }

      const document = await prisma.document.update({
        where: { id },
        data,
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Invalidate PDF cache when document is updated (version or content may have changed)
      invalidateCache(id).catch((err) => {
        console.error('[Document Update] Error invalidating PDF cache:', err);
      });

      res.json(document);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Document not found' });
      }
      console.error('Error updating document:', error);
      res.status(500).json({ error: 'Failed to update document' });
    }
  }
);

// POST /api/documents/:id/version-updates - update document version
router.post(
  '/:id/version-updates',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('currentVersion').notEmpty().trim(),
    body('newVersion').notEmpty().trim(),
    body('notes').notEmpty().trim(),
    body('lastReviewDate').optional().isISO8601(),
    body('nextReviewDate').optional().isISO8601(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { currentVersion, newVersion, notes, lastReviewDate, nextReviewDate } = req.body;

      // Get current user ID
      if (!req.user?.email) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const currentUser = await prisma.user.findUnique({
        where: { email: req.user.email },
        select: { id: true },
      });

      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Fetch existing document
      const existingDocument = await prisma.document.findUnique({
        where: { id },
        select: {
          id: true,
          version: true,
          status: true,
          sharePointSiteId: true,
          sharePointDriveId: true,
          sharePointItemId: true,
        },
      });

      if (!existingDocument) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Validate currentVersion matches document's stored version
      if (existingDocument.version !== currentVersion) {
        return res.status(409).json({
          error: 'Version mismatch',
          message: `Document version has changed. Current version is "${existingDocument.version}". Please refresh and try again.`,
          currentVersion: existingDocument.version,
        });
      }

      // Convert date strings to DateTime objects if provided
      const updateData: any = {
        version: newVersion,
        updatedAt: new Date(),
      };

      if (existingDocument.status === 'APPROVED') {
        updateData.lastChangedDate = new Date();
      }

      // Handle review dates
      if (lastReviewDate !== undefined) {
        if (lastReviewDate === null || lastReviewDate === '') {
          updateData.lastReviewDate = null;
        } else if (typeof lastReviewDate === 'string') {
          // If it's just a date (YYYY-MM-DD), convert to full datetime
          if (lastReviewDate.length === 10) {
            updateData.lastReviewDate = new Date(lastReviewDate + 'T00:00:00.000Z');
          } else {
            updateData.lastReviewDate = new Date(lastReviewDate);
          }
        }
      }

      if (nextReviewDate !== undefined) {
        if (nextReviewDate === null || nextReviewDate === '') {
          updateData.nextReviewDate = null;
        } else if (typeof nextReviewDate === 'string') {
          // If it's just a date (YYYY-MM-DD), convert to full datetime
          if (nextReviewDate.length === 10) {
            updateData.nextReviewDate = new Date(nextReviewDate + 'T00:00:00.000Z');
          } else {
            updateData.nextReviewDate = new Date(nextReviewDate);
          }
        }
      }

      // Upsert into DocumentVersionHistory
      const existingVersionHistory = await prisma.documentVersionHistory.findFirst({
        where: {
          documentId: id,
          version: newVersion,
        },
      });

      if (existingVersionHistory) {
        // Update existing record
        await prisma.documentVersionHistory.update({
          where: { id: existingVersionHistory.id },
          data: {
            notes,
            updatedAt: new Date(),
            updatedBy: currentUser.id,
            // Preserve SharePoint IDs if they exist
            sharePointSiteId: existingDocument.sharePointSiteId || undefined,
            sharePointDriveId: existingDocument.sharePointDriveId || undefined,
            sharePointItemId: existingDocument.sharePointItemId || undefined,
          },
        });
      } else {
        // Create new record
        await prisma.documentVersionHistory.create({
          data: {
            id: randomUUID(),
            documentId: id,
            version: newVersion,
            notes,
            createdAt: new Date(),
            createdBy: currentUser.id,
            updatedAt: new Date(),
            updatedBy: currentUser.id,
            // Store SharePoint IDs for history restoration
            sharePointSiteId: existingDocument.sharePointSiteId || null,
            sharePointDriveId: existingDocument.sharePointDriveId || null,
            sharePointItemId: existingDocument.sharePointItemId || null,
          },
        });
      }

      // Update the document
      const document = await prisma.document.update({
        where: { id },
        data: updateData,
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Invalidate PDF cache when version changes
      invalidateCache(id).catch((err) => {
        console.error('[Version Update] Error invalidating PDF cache:', err);
      });

      res.json(document);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Document not found' });
      }
      if (error.code === 'P2002') {
        return res.status(409).json({
          error: 'Version already exists',
          message: `Version "${req.body.newVersion}" already exists for this document.`,
        });
      }
      console.error('Error updating document version:', error);
      res.status(500).json({ error: 'Failed to update document version' });
    }
  }
);

// POST /api/documents/bulk-import - bulk import documents from SharePoint
router.post(
  '/bulk-import',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('items').isArray().notEmpty(),
    body('items.*.itemId').notEmpty().isString(),
    body('items.*.siteId').optional().isString(),
    body('items.*.driveId').optional().isString(),
    body('defaults').optional().isObject(),
    body('defaults.type').optional().isIn(['POLICY', 'PROCEDURE', 'MANUAL', 'RECORD', 'TEMPLATE', 'CERTIFICATE', 'OTHER']),
    body('defaults.status').optional().isIn(['DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED']),
    body('defaults.version').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const accessToken = req.headers['x-graph-token'] as string;
      if (!accessToken) {
        return res.status(400).json({
          error:
            'Access token required. Please provide x-graph-token header with Microsoft Graph access token.',
        });
      }

      const { items, defaults = {} } = req.body;
      const results: any[] = [];
      const errors: any[] = [];

      // Use defaults or fallback values
      const defaultType = defaults.type || 'OTHER';
      const defaultStatus = defaults.status || 'DRAFT';
      const defaultVersion = defaults.version || '1.0';

      // Look up the user in the database using the email from the token
      // The req.user object has email/oid from the token, but we need the database user ID
      let ownerUserId = defaults.ownerUserId;

      if (!ownerUserId && req.user?.email) {
        const user = await prisma.user.findUnique({
          where: { email: req.user.email },
        });

        if (user) {
          ownerUserId = user.id;
        } else {
          console.warn('[Bulk Import] User not found in database:', req.user.email);
        }
      }

      if (!ownerUserId) {
        return res.status(400).json({
          error: 'Owner user ID is required. User must be authenticated and exist in the database, or ownerUserId must be provided in defaults.',
          details: req.user?.email
            ? `User with email ${req.user.email} not found in database`
            : 'No user email found in authentication token',
        });
      }

      for (const item of items) {
        try {
          // Use provided IDs or fall back to config defaults
          const siteId = item.siteId || config.sharePoint.siteId;
          const driveId = item.driveId || config.sharePoint.driveId;
          const itemId = item.itemId;

          if (!siteId || !driveId) {
            errors.push({
              itemId,
              error: 'Site ID and Drive ID are required',
            });
            continue;
          }

          // Fetch SharePoint item metadata
          const sharePointItem = await getSharePointItem(accessToken, siteId, driveId, itemId);

          if (!sharePointItem) {
            errors.push({
              itemId,
              error: 'SharePoint item not found or inaccessible',
            });
            continue;
          }

          // Check if document already exists (by SharePoint item ID)
          // SharePoint item IDs are unique and constant, so we can use them to identify duplicates
          const existing = await prisma.document.findFirst({
            where: {
              sharePointSiteId: siteId,
              sharePointDriveId: driveId,
              sharePointItemId: itemId,
            },
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              },
            },
          });

          if (existing) {
            // Update existing document instead of creating a duplicate
            // Update metadata from SharePoint (title might have changed) and apply defaults
            const updateData: any = {
              title: sharePointItem.name, // Update title in case file was renamed
              type: defaults.type || existing.type, // Only update if provided in defaults
              version: defaults.version || existing.version, // Only update if provided in defaults
              status: defaults.status || existing.status, // Only update if provided in defaults
              // Update SharePoint IDs to ensure they're current (shouldn't change, but just in case)
              sharePointSiteId: siteId,
              sharePointDriveId: driveId,
              sharePointItemId: itemId,
              updatedAt: new Date(),
            };

            // Update document URL if available from SharePoint item
            if (sharePointItem.webUrl) {
              updateData.documentUrl = sharePointItem.webUrl;
              console.log('[Bulk Import] Updated document URL:', sharePointItem.webUrl);
            }

            const document = await prisma.document.update({
              where: { id: existing.id },
              data: updateData,
              include: {
                owner: {
                  select: {
                    id: true,
                    displayName: true,
                    email: true,
                  },
                },
              },
            });

            // Invalidate PDF cache when document is updated
            invalidateCache(existing.id).catch((err) => {
              console.error('[Bulk Import] Error invalidating PDF cache:', err);
            });

            results.push({
              itemId,
              name: sharePointItem.name,
              action: 'updated',
              document: document,
            });
            continue;
          }

          // Create new document with auto-populated metadata
          const createData: any = {
            title: sharePointItem.name,
            type: defaultType,
            storageLocation: 'SHAREPOINT',
            version: defaultVersion,
            status: defaultStatus,
            ownerUserId,
            sharePointSiteId: siteId,
            sharePointDriveId: driveId,
            sharePointItemId: itemId,
          };

          // Store document URL if available from SharePoint item
          if (sharePointItem.webUrl) {
            createData.documentUrl = sharePointItem.webUrl;
            console.log('[Bulk Import] Generated document URL:', sharePointItem.webUrl);
          }

          const document = await prisma.document.create({
            data: createData,
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              },
            },
          });

          results.push({
            itemId,
            name: sharePointItem.name,
            action: 'created',
            document: document,
          });
        } catch (error: any) {
          console.error(`Error importing item ${item.itemId}:`, error);
          errors.push({
            itemId: item.itemId,
            error: error.message || 'Failed to import document',
          });
        }
      }

      res.json({
        success: results.length,
        failed: errors.length,
        total: items.length,
        results,
        errors,
      });
    } catch (error) {
      console.error('Error in bulk import:', error);
      res.status(500).json({ error: 'Failed to perform bulk import' });
    }
  }
);

// DELETE /api/documents/:id - soft delete (mark as superseded) or hard delete
router.delete(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    query('hard').optional().isBoolean(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const hardDelete = req.query.hard === 'true';

      let document;
      if (hardDelete) {
        // For hard delete, manually delete related records first to avoid timeout
        // This is more efficient than relying on cascade deletes
        await prisma.$transaction(async (tx) => {
          // Delete related records in order
          await tx.reviewTask.deleteMany({
            where: { documentId: id },
          });
          await tx.acknowledgment.deleteMany({
            where: { documentId: id },
          });
          await tx.documentControl.deleteMany({
            where: { documentId: id },
          });
          await tx.documentRisk.deleteMany({
            where: { documentId: id },
          });

          // Finally delete the document
          document = await tx.document.delete({
            where: { id },
          });
        }, {
          timeout: 30000, // 30 second timeout
        });
      } else {
        document = await prisma.document.update({
          where: { id },
          data: { status: 'SUPERSEDED' },
        });
      }

      res.json(document);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Document not found' });
      }
      if (error.code === 'P2034') {
        return res.status(408).json({
          error: 'Delete operation timed out. The document may have too many related records.',
        });
      }
      console.error('Error deleting document:', error);
      res.status(500).json({
        error: 'Failed to delete document',
        details: error.message,
      });
    }
  }
);

// GET /api/documents/:id/controls - get all controls linked to a document
router.get(
  '/:id/controls',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Verify document exists
      const document = await prisma.document.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Get all linked controls
      const documentControls = await prisma.documentControl.findMany({
        where: { documentId: id },
        include: {
          control: {
            select: {
              id: true,
              code: true,
              title: true,
              category: true,
              isStandardControl: true,
            },
          },
        },
      });

      res.json(documentControls.map((dc) => dc.control));
    } catch (error) {
      console.error('Error fetching document controls:', error);
      res.status(500).json({ error: 'Failed to fetch document controls' });
    }
  }
);

// POST /api/documents/:id/controls - link a control to a document
router.post(
  '/:id/controls',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('controlId').isUUID(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { controlId } = req.body;

      // Verify document exists
      const document = await prisma.document.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Verify control exists
      const control = await prisma.control.findUnique({
        where: { id: controlId },
        select: { id: true },
      });

      if (!control) {
        return res.status(404).json({ error: 'Control not found' });
      }

      // Check if link already exists
      const existingLink = await prisma.documentControl.findUnique({
        where: {
          documentId_controlId: {
            documentId: id,
            controlId: controlId,
          },
        },
      });

      if (existingLink) {
        return res.status(400).json({ error: 'Control is already linked to this document' });
      }

      // Create link
      await prisma.documentControl.create({
        data: {
          documentId: id,
          controlId: controlId,
        },
      });

      // Return the linked control
      const linkedControl = await prisma.control.findUnique({
        where: { id: controlId },
        select: {
          id: true,
          code: true,
          title: true,
          category: true,
          isStandardControl: true,
        },
      });

      res.status(201).json(linkedControl);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Control is already linked to this document' });
      }
      console.error('Error linking control to document:', error);
      res.status(500).json({ error: 'Failed to link control to document' });
    }
  }
);

// POST /api/documents/suggest-controls - AI-based control suggestions for documents
router.post(
  '/suggest-controls',
  authenticateToken,
  [
    body('title').optional().isString(),
    body('type').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, type } = req.body;

      if (!title || title.trim().length === 0) {
        return res.status(400).json({ error: 'Document title is required' });
      }

      // Normalize document text for embedding
      const documentText = `${title} ${type || ''}`.trim().toLowerCase();

      // Generate embedding for the document text
      const documentEmbedding = await generateEmbedding(documentText);
      if (!documentEmbedding) {
        console.warn('[Document Control Suggestions] Embedding generation failed, falling back to keyword matching');
        // Fallback to keyword-based matching
        const allControls = await prisma.control.findMany({
          where: {
            isStandardControl: true,
          },
          select: {
            id: true,
            code: true,
            title: true,
          },
        });

        const titleLower = title.toLowerCase();
        const titleWords = titleLower.split(/\s+/).filter((word: string) => word.length > 3);
        
        const suggestedControlIds: string[] = [];
        for (const control of allControls) {
          const controlText = `${control.code} ${control.title || ''}`.toLowerCase();
          let score = 0;

          
          // Check for word matches
          for (const word of titleWords) {
            if (controlText.includes(word)) {
              score += word.length > 5 ? 3 : 2;
            }
          }

          
          if (score >= 2) {
            suggestedControlIds.push(control.id);
          }
        }

        return res.json({
          suggestedControlIds: suggestedControlIds.slice(0, 8),
          totalMatches: suggestedControlIds.length,
        });
      }

      // Get all controls with their stored embeddings
      const allControls = await prisma.control.findMany({
        where: {
          isStandardControl: true,
          embedding: { not: Prisma.DbNull },
        },
        select: {
          id: true,
          code: true,
          title: true,
          embedding: true,
        },
      });

      // Extract keywords from document text for boosting
      const documentTextLower = documentText.toLowerCase();
      const documentWords = documentTextLower
        .split(/\s+/)
        .filter((word) => word.length > 3)
        .map((word) => word.replace(/[^\w]/g, ''));

      const controlScores: Array<{ id: string; score: number; code: string; title: string }> = [];

      for (const control of allControls) {
        if (!control.embedding || !Array.isArray(control.embedding)) {
          continue;
        }

        // Calculate cosine similarity using stored embedding
        const controlEmbedding = control.embedding as number[];
        const cosineSim = cosineSimilarity(documentEmbedding, controlEmbedding);
        let similarityScore = mapToScore(cosineSim);

        // Keyword boosting: Check for word matches in control title/code
        const controlTextLower = `${control.code} ${control.title || ''}`.toLowerCase();
        let keywordBoost = 0;

        
        // Boost for word matches
        for (const word of documentWords) {
          if (word.length > 3 && controlTextLower.includes(word)) {
            keywordBoost += word.length > 6 ? 8 : 5;
          }
        }

        // Special boost for important security terms
        const importantTerms = ['awareness', 'training', 'education', 'security', 'policy',
          'procedure', 'access', 'control', 'incident', 'monitoring'];
        for (const term of importantTerms) {
          if (documentTextLower.includes(term) && controlTextLower.includes(term)) {
            keywordBoost += 10;
          }
        }

        // Apply keyword boost
        similarityScore = Math.min(100, similarityScore + Math.min(keywordBoost, 30));

        if (similarityScore >= 55) {
          controlScores.push({
            id: control.id,
            score: similarityScore,
            code: control.code,
            title: control.title || '',
          });
        }
      }

      // Sort by similarity score and limit to top 8 suggestions
      const sortedSuggestions = controlScores
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((item) => item.id);

      res.json({
        suggestedControlIds: sortedSuggestions,
        totalMatches: controlScores.length,
      });
    } catch (error: any) {
      console.error('Error suggesting controls for document:', error);
      res.status(500).json({ error: 'Failed to generate control suggestions' });
    }
  }
);

// DELETE /api/documents/:id/controls/:controlId - unlink a control from a document
router.delete(
  '/:id/controls/:controlId',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    param('controlId').isUUID(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id, controlId } = req.params;

      // Verify document exists
      const document = await prisma.document.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Verify control exists
      const control = await prisma.control.findUnique({
        where: { id: controlId },
        select: { id: true },
      });

      if (!control) {
        return res.status(404).json({ error: 'Control not found' });
      }

      // Check if link exists
      const existingLink = await prisma.documentControl.findUnique({
        where: {
          documentId_controlId: {
            documentId: id,
            controlId: controlId,
          },
        },
      });

      if (!existingLink) {
        return res.status(404).json({ error: 'Control is not linked to this document' });
      }

      // Delete link
      await prisma.documentControl.delete({
        where: {
          documentId_controlId: {
            documentId: id,
            controlId: controlId,
          },
        },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Link not found' });
      }
      console.error('Error unlinking control from document:', error);
      res.status(500).json({ error: 'Failed to unlink control from document' });
    }
  }
);

export { router as documentsRouter };

