import { Router, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { getSharePointItem } from '../services/sharePointService';
import { config } from '../config';

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
    query('type').optional().isIn(['POLICY', 'PROCEDURE', 'MANUAL', 'RECORD', 'TEMPLATE', 'OTHER']),
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

      if (type) where.type = type;
      if (status) where.status = status;
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

      // Log for debugging
      console.log('[DOCUMENTS] Query result:', {
        filters: where,
        found: documents.length,
        total,
        page: pageNum,
        limit: limitNum,
        databaseUrl: process.env.DATABASE_URL || 'default',
        sampleTitles: documents.slice(0, 3).map(d => d.title),
      });

      res.json({
        data: documents,
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
          documentControls: {
            include: {
              control: true,
            },
          },
          documentRisks: {
            include: {
              risk: true,
            },
          },
        },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      res.json(document);
    } catch (error) {
      console.error('Error fetching document:', error);
      res.status(500).json({ error: 'Failed to fetch document' });
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
    body('type').isIn(['POLICY', 'PROCEDURE', 'MANUAL', 'RECORD', 'TEMPLATE', 'OTHER']),
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
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Convert date strings to DateTime objects if provided
      const data: any = { ...req.body };
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
    body('type').optional().isIn(['POLICY', 'PROCEDURE', 'MANUAL', 'RECORD', 'TEMPLATE', 'OTHER']),
    body('storageLocation').optional().isIn(['SHAREPOINT', 'CONFLUENCE']),
    body('version').optional().notEmpty().trim(),
    body('status').optional().isIn(['DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED']),
    body('ownerUserId').optional().isUUID(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Convert date strings to DateTime objects if provided
      const data: any = { ...req.body };
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
    body('defaults.type').optional().isIn(['POLICY', 'PROCEDURE', 'MANUAL', 'RECORD', 'TEMPLATE', 'OTHER']),
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
      const ownerUserId = req.user.id;

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
          const existing = await prisma.document.findFirst({
            where: {
              sharePointSiteId: siteId,
              sharePointDriveId: driveId,
              sharePointItemId: itemId,
            },
          });

          if (existing) {
            errors.push({
              itemId,
              name: sharePointItem.name,
              error: 'Document already exists',
            });
            continue;
          }

          // Create document with auto-populated metadata
          const document = await prisma.document.create({
            data: {
              title: sharePointItem.name,
              type: defaultType,
              storageLocation: 'SHAREPOINT',
              version: defaultVersion,
              status: defaultStatus,
              ownerUserId,
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

          results.push({
            itemId,
            document,
            success: true,
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

// DELETE /api/documents/:id - soft delete (mark as superseded)
router.delete(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const document = await prisma.document.update({
        where: { id },
        data: { status: 'SUPERSEDED' },
      });

      res.json(document);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Document not found' });
      }
      console.error('Error deleting document:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  }
);

export { router as documentsRouter };

