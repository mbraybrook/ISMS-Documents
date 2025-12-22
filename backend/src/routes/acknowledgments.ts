/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { Acknowledgment, Document, User, EntraIdUserCache } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import {
  getGroupById,
  syncAllStaffMembersToCache,
} from '../services/entraIdService';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/acknowledgments/pending - get documents needing acknowledgment for current user
router.get('/pending', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { email: req.user.email || '' },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all approved documents that require acknowledgment
    const approvedDocuments = await prisma.document.findMany({
      where: {
        status: 'APPROVED',
        requiresAcknowledgement: true,
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

    // Get user's latest acknowledgments for each document
    const userAcknowledgments = await prisma.acknowledgment.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        acknowledgedAt: 'desc',
      },
    });

    // Create a map of documentId -> latest acknowledgment version
    const acknowledgmentMap = new Map<string, string>();
    userAcknowledgments.forEach((ack: Acknowledgment) => {
      const existing = acknowledgmentMap.get(ack.documentId);
      if (!existing || ack.documentVersion > existing) {
        acknowledgmentMap.set(ack.documentId, ack.documentVersion);
      }
    });

    // Filter documents that need acknowledgment
    const pendingDocuments = approvedDocuments.filter((doc: Document & { owner?: { id: string; displayName: string; email: string } }) => {
      const lastAcknowledgedVersion = acknowledgmentMap.get(doc.id);
      // Need acknowledgment if never acknowledged or version changed
      return !lastAcknowledgedVersion || doc.version !== lastAcknowledgedVersion;
    });

    res.json(pendingDocuments);
  } catch (error) {
    console.error('Error fetching pending acknowledgments:', error);
    res.status(500).json({ error: 'Failed to fetch pending acknowledgments' });
  }
});

// POST /api/acknowledgments/bulk - bulk acknowledge (Acknowledge All)
router.post(
  '/bulk',
  authenticateToken,
  [
    body('documentIds').optional().isArray(),
    body('documentIds.*').optional().isUUID(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { email: req.user.email || '' },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { documentIds } = req.body;

      // If no documentIds provided, acknowledge all pending
      let documentsToAcknowledge;
      if (!documentIds || documentIds.length === 0) {
        // Get all pending documents (same logic as GET /pending)
        const approvedDocuments = await prisma.document.findMany({
          where: { 
            status: 'APPROVED',
            requiresAcknowledgement: true,
          },
        });

        const userAcknowledgments = await prisma.acknowledgment.findMany({
          where: { userId: user.id },
          orderBy: { acknowledgedAt: 'desc' },
        });

        const acknowledgmentMap = new Map<string, string>();
        userAcknowledgments.forEach((ack: Acknowledgment) => {
          const existing = acknowledgmentMap.get(ack.documentId);
          if (!existing || ack.documentVersion > existing) {
            acknowledgmentMap.set(ack.documentId, ack.documentVersion);
          }
        });

        documentsToAcknowledge = approvedDocuments.filter((doc: Document) => {
          const lastAcknowledgedVersion = acknowledgmentMap.get(doc.id);
          return !lastAcknowledgedVersion || doc.version !== lastAcknowledgedVersion;
        });
      } else {
        documentsToAcknowledge = await prisma.document.findMany({
          where: {
            id: { in: documentIds },
            status: 'APPROVED',
            requiresAcknowledgement: true,
          },
        });
      }

      // Create acknowledgments
      const acknowledgments = await Promise.all(
        documentsToAcknowledge.map(async (doc: Document) => {
          // Check if already acknowledged for this version
          const existing = await prisma.acknowledgment.findUnique({
            where: {
              userId_documentId_documentVersion: {
                userId: user.id,
                documentId: doc.id,
                documentVersion: doc.version,
              },
            },
          });

          if (existing) {
            return existing;
          }

          return prisma.acknowledgment.create({
            data: {
              id: randomUUID(),
              userId: user.id,
              documentId: doc.id,
              documentVersion: doc.version,
            },
          });
        })
      );

      res.json({
        acknowledged: acknowledgments.length,
        acknowledgments,
      });
    } catch (error) {
      console.error('Error creating bulk acknowledgments:', error);
      res.status(500).json({ error: 'Failed to create acknowledgments' });
    }
  }
);

// POST /api/acknowledgments - single document acknowledgment
router.post(
  '/',
  authenticateToken,
  [
    body('documentId').isUUID(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { email: req.user.email || '' },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { documentId } = req.body;

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (document.status !== 'APPROVED') {
        return res.status(400).json({ error: 'Document is not approved' });
      }

      if (!document.requiresAcknowledgement) {
        return res.status(400).json({ error: 'Document does not require acknowledgment' });
      }

      // Check if already acknowledged for this version
      const existing = await prisma.acknowledgment.findUnique({
        where: {
          userId_documentId_documentVersion: {
            userId: user.id,
            documentId: document.id,
            documentVersion: document.version,
          },
        },
      });

      if (existing) {
        return res.json(existing);
      }

      const acknowledgment = await prisma.acknowledgment.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          documentId: document.id,
          documentVersion: document.version,
        },
      });

      res.status(201).json(acknowledgment);
    } catch (error) {
      console.error('Error creating acknowledgment:', error);
      res.status(500).json({ error: 'Failed to create acknowledgment' });
    }
  }
);

// GET /api/acknowledgments/stats - admin view of acknowledgment statistics
router.get(
  '/stats',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const documentId = req.query.documentId as string | undefined;
      const includeUsers = req.query.includeUsers !== 'false'; // Default true
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      // Get Entra ID config to check last sync time
      const entraConfig = await prisma.entraIdConfig.findFirst();
      const dataAsOf = entraConfig?.lastSyncedAt?.toISOString() || null;

      // Get all cached Entra ID users (primary source for staff population)
      const allStaffUsers = await prisma.entraIdUserCache.findMany();
      const totalStaffCount = allStaffUsers.length;

      // Create map of entraObjectId -> cached user for quick lookup
      const staffMapByEntraId = new Map(
        allStaffUsers.map((u: EntraIdUserCache) => [u.entraObjectId, u])
      );
      const staffMapByEmail = new Map(
        allStaffUsers.map((u: EntraIdUserCache) => [u.email.toLowerCase(), u])
      );

      // Get all local users (for matching acknowledgments)
      const localUsers = await prisma.user.findMany({
        where: {
          role: { in: ['STAFF', 'EDITOR', 'ADMIN'] },
        },
      });

      // Create map of entraObjectId -> local user
      const localUserMapByEntraId = new Map(
        localUsers.map((u: User) => [u.entraObjectId, u])
      );
      const localUserMapByEmail = new Map(
        localUsers.map((u: User) => [u.email.toLowerCase(), u])
      );

      // Get documents (filter by documentId if provided)
      const whereClause: any = { status: 'APPROVED' };
      if (documentId) {
        whereClause.id = documentId;
      }

      let approvedDocuments = await prisma.document.findMany({
        where: whereClause,
      });

      if (limit) {
        approvedDocuments = approvedDocuments.slice(0, limit);
      }

      // Get all acknowledgments for these documents
      const allAcknowledgments = await prisma.acknowledgment.findMany({
        where: documentId ? { documentId } : undefined,
        include: {
          User: {
            select: {
              id: true,
              displayName: true,
              email: true,
              entraObjectId: true,
            },
          },
        },
      });

      // Build stats per document
      const now = new Date();
      const documents = approvedDocuments.map((doc: Document) => {
        // Get acknowledgments for current document version
        const docAcks = allAcknowledgments.filter(
          (ack: Acknowledgment & { User: { id: string; displayName: string; email: string; entraObjectId: string | null } }) => ack.documentId === doc.id && ack.documentVersion === doc.version
        );

        // Calculate required date (when acknowledgment was required)
        const requiredDate =
          doc.lastChangedDate || doc.updatedAt || doc.createdAt;
        const daysSinceRequired = Math.floor(
          (now.getTime() - requiredDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Match acknowledgments to staff users
        const acknowledgedUsersMap = new Map<string, any>();
        const acknowledgedEntraIds = new Set<string>();

        for (const ack of docAcks) {
          const user = ack.User;
          let entraId: string | undefined;
          let cachedUser: any;

          // Try to find cached user by entraObjectId or email
          if (user.entraObjectId) {
            entraId = user.entraObjectId;
            cachedUser = staffMapByEntraId.get(entraId);
          }
          if (!cachedUser && user.email) {
            cachedUser = staffMapByEmail.get(user.email.toLowerCase());
            if (cachedUser) {
              entraId = cachedUser.entraObjectId;
            }
          }

          if (entraId && cachedUser) {
            acknowledgedEntraIds.add(entraId);
            if (includeUsers) {
              acknowledgedUsersMap.set(entraId, {
                userId: user.id,
                entraObjectId: entraId,
                email: cachedUser.email,
                displayName: cachedUser.displayName,
                acknowledgedAt: ack.acknowledgedAt.toISOString(),
                daysSinceRequired: Math.floor(
                  (ack.acknowledgedAt.getTime() - requiredDate.getTime()) /
                    (1000 * 60 * 60 * 24)
                ),
              });
            }
          }
        }

        // Find staff users who haven't acknowledged
        const notAcknowledgedUsers: any[] = [];
        if (includeUsers) {
          for (const staffUser of allStaffUsers) {
            if (!acknowledgedEntraIds.has(staffUser.entraObjectId)) {
              const localUser = localUserMapByEntraId.get(staffUser.entraObjectId) ||
                localUserMapByEmail.get(staffUser.email.toLowerCase());

              notAcknowledgedUsers.push({
                userId: (localUser?.id) ?? null,
                entraObjectId: staffUser.entraObjectId,
                email: staffUser.email,
                displayName: staffUser.displayName,
                daysSinceRequired,
              });
            }
          }
        }

        const acknowledgedCount = acknowledgedEntraIds.size;
        const notAcknowledgedCount = totalStaffCount - acknowledgedCount;
        const percentage =
          totalStaffCount > 0
            ? Math.round((acknowledgedCount / totalStaffCount) * 10000) / 100
            : 0;

        return {
          documentId: doc.id,
          documentTitle: doc.title,
          documentVersion: doc.version,
          requiresAcknowledgement: doc.requiresAcknowledgement,
          lastChangedDate: doc.lastChangedDate?.toISOString() || null,
          totalUsers: totalStaffCount,
          acknowledgedCount,
          notAcknowledgedCount,
          percentage,
          acknowledgedUsers: includeUsers ? Array.from(acknowledgedUsersMap.values()) : [],
          notAcknowledgedUsers: includeUsers ? notAcknowledgedUsers : [],
        };
      });

      // Calculate summary
      const totalDocuments = documents.length;
      const averageAcknowledgmentRate =
        documents.length > 0
          ? documents.reduce((sum: number, doc: { percentage: number }) => sum + doc.percentage, 0) / documents.length
          : 0;

      res.json({
        dataAsOf,
        documents,
        summary: {
          totalDocuments,
          totalUsers: totalStaffCount,
          averageAcknowledgmentRate: Math.round(averageAcknowledgmentRate * 100) / 100,
        },
      });
    } catch (error) {
      console.error('Error fetching acknowledgment stats:', error);
      res.status(500).json({ error: 'Failed to fetch acknowledgment statistics' });
    }
  }
);

// GET /api/acknowledgments/document/:documentId - detailed acknowledgment status for a specific document
router.get(
  '/document/:documentId',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { documentId } = req.params;
      const page = parseInt(req.query.page as string, 10) || 1;
      const pageSize = Math.min(
        parseInt(req.query.pageSize as string, 10) || 50,
        200
      );

      // Get document
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Get Entra ID config
      const entraConfig = await prisma.entraIdConfig.findFirst();
      const dataAsOf = entraConfig?.lastSyncedAt?.toISOString() || null;

      // Get all cached staff users
      const allStaffUsers = await prisma.entraIdUserCache.findMany();
      const totalStaffCount = allStaffUsers.length;

      // Create maps for lookup
      const staffMapByEntraId = new Map(
        allStaffUsers.map((u: EntraIdUserCache) => [u.entraObjectId, u])
      );
      const staffMapByEmail = new Map(
        allStaffUsers.map((u: EntraIdUserCache) => [u.email.toLowerCase(), u])
      );

      const localUsers = await prisma.user.findMany();
      const localUserMapByEntraId = new Map(
        localUsers.map((u: User) => [u.entraObjectId, u])
      );
      const localUserMapByEmail = new Map(
        localUsers.map((u: User) => [u.email.toLowerCase(), u])
      );

      // Get acknowledgments for this document version
      const acknowledgments = await prisma.acknowledgment.findMany({
        where: {
          documentId: document.id,
          documentVersion: document.version,
        },
        include: {
          User: {
            select: {
              id: true,
              displayName: true,
              email: true,
              entraObjectId: true,
            },
          },
        },
      });

      const now = new Date();
      const requiredDate =
        document.lastChangedDate || document.updatedAt || document.createdAt;
      const daysSinceRequired = Math.floor(
        (now.getTime() - requiredDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Match acknowledgments to staff
      const acknowledgedUsersMap = new Map<string, any>();
      const acknowledgedEntraIds = new Set<string>();

      for (const ack of acknowledgments) {
        const user = ack.User;
        let entraId: string | undefined;
        let cachedUser: any;

        if (user.entraObjectId) {
          entraId = user.entraObjectId;
          cachedUser = staffMapByEntraId.get(entraId);
        }
        if (!cachedUser && user.email) {
          cachedUser = staffMapByEmail.get(user.email.toLowerCase());
          if (cachedUser) {
            entraId = cachedUser.entraObjectId;
          }
        }

        if (entraId && cachedUser) {
          acknowledgedEntraIds.add(entraId);
          acknowledgedUsersMap.set(entraId, {
            userId: user.id,
            entraObjectId: entraId,
            email: cachedUser.email,
            displayName: cachedUser.displayName,
            acknowledgedAt: ack.acknowledgedAt.toISOString(),
            daysSinceRequired: Math.floor(
              (ack.acknowledgedAt.getTime() - requiredDate.getTime()) /
                (1000 * 60 * 60 * 24)
            ),
          });
        }
      }

      // Find not acknowledged users
      const notAcknowledgedUsers: any[] = [];
      for (const staffUser of allStaffUsers) {
        if (!acknowledgedEntraIds.has(staffUser.entraObjectId)) {
          const localUser =
            localUserMapByEntraId.get(staffUser.entraObjectId) ||
            localUserMapByEmail.get(staffUser.email.toLowerCase());

          notAcknowledgedUsers.push({
            userId: (localUser?.id) ?? null,
            entraObjectId: staffUser.entraObjectId,
            email: staffUser.email,
            displayName: staffUser.displayName,
            daysSinceRequired,
          });
        }
      }

      // Paginate user lists
      const acknowledgedUsersList = Array.from(acknowledgedUsersMap.values());
      const acknowledgedStart = (page - 1) * pageSize;
      const acknowledgedEnd = acknowledgedStart + pageSize;
      const paginatedAcknowledged = acknowledgedUsersList.slice(
        acknowledgedStart,
        acknowledgedEnd
      );

      const notAcknowledgedStart = (page - 1) * pageSize;
      const notAcknowledgedEnd = notAcknowledgedStart + pageSize;
      const paginatedNotAcknowledged = notAcknowledgedUsers.slice(
        notAcknowledgedStart,
        notAcknowledgedEnd
      );

      const acknowledgedCount = acknowledgedEntraIds.size;
      const notAcknowledgedCount = totalStaffCount - acknowledgedCount;
      const percentage =
        totalStaffCount > 0
          ? Math.round((acknowledgedCount / totalStaffCount) * 10000) / 100
          : 0;

      res.json({
        dataAsOf,
        document: {
          documentId: document.id,
          documentTitle: document.title,
          documentVersion: document.version,
          requiresAcknowledgement: document.requiresAcknowledgement,
          lastChangedDate: document.lastChangedDate?.toISOString() || null,
          totalUsers: totalStaffCount,
          acknowledgedCount,
          notAcknowledgedCount,
          percentage,
        },
        acknowledgedUsers: paginatedAcknowledged,
        notAcknowledgedUsers: paginatedNotAcknowledged,
        pagination: {
          page,
          pageSize,
          total: Math.max(acknowledgedUsersList.length, notAcknowledgedUsers.length),
        },
      });
    } catch (error) {
      console.error('Error fetching document acknowledgment details:', error);
      res.status(500).json({ error: 'Failed to fetch document acknowledgment details' });
    }
  }
);

// GET /api/acknowledgments/entra-config - Get configured all-staff group
router.get(
  '/entra-config',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const config = await prisma.entraIdConfig.findFirst();

      if (!config) {
        return res.json({
          groupId: null,
          groupName: null,
          lastSyncedAt: null,
        });
      }

      res.json({
        groupId: config.groupId,
        groupName: config.groupName,
        lastSyncedAt: config.lastSyncedAt?.toISOString() || null,
      });
    } catch (error) {
      console.error('Error fetching Entra ID config:', error);
      res.status(500).json({ error: 'Failed to fetch Entra ID configuration' });
    }
  }
);

// POST /api/acknowledgments/entra-config - Set/update all-staff group
router.post(
  '/entra-config',
  authenticateToken,
  requireRole('ADMIN'),
  [body('groupId').isString().notEmpty()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { groupId } = req.body;
      const graphToken = req.headers['x-graph-token'] as string;

      if (!graphToken) {
        return res.status(400).json({
          error: 'x-graph-token header required for group validation',
        });
      }

      // Validate group exists and get name
      const groupInfo = await getGroupById(groupId, graphToken);
      if (!groupInfo) {
        return res.status(404).json({ error: 'Group not found in Entra ID' });
      }

      // Create or update singleton config (only one config record should exist)
      const existingConfig = await prisma.entraIdConfig.findFirst();
      
      const config = existingConfig
        ? await prisma.entraIdConfig.update({
            where: { id: existingConfig.id },
            data: {
              groupId: groupInfo.id,
              groupName: groupInfo.displayName,
              updatedAt: new Date(),
            },
          })
        : await prisma.entraIdConfig.create({
            data: {
              id: randomUUID(),
              groupId: groupInfo.id,
              groupName: groupInfo.displayName,
            },
          });

      res.json({
        groupId: config.groupId,
        groupName: config.groupName,
        lastSyncedAt: config.lastSyncedAt?.toISOString() || null,
      });
    } catch (error: any) {
      console.error('Error setting Entra ID config:', error);
      res.status(500).json({
        error: 'Failed to set Entra ID configuration',
        details: error.message,
      });
    }
  }
);

// POST /api/acknowledgments/entra-sync - Sync all-staff group members to cache
router.post(
  '/entra-sync',
  authenticateToken,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      // Get configured group
      const config = await prisma.entraIdConfig.findFirst();
      if (!config) {
        return res.status(400).json({
          error: 'No Entra ID group configured. Please configure a group first.',
        });
      }

      // Use app-only token by default (application permissions)
      // x-graph-token header is optional and only used as fallback if app-only token fails
      const graphToken = req.headers['x-graph-token'] as string | undefined;

      const syncedCount = await syncAllStaffMembersToCache(
        config.groupId,
        graphToken // Optional - will use app-only token if not provided
      );

      // Refresh config to get updated lastSyncedAt
      const updatedConfig = await prisma.entraIdConfig.findFirst();

      res.json({
        synced: syncedCount,
        lastSyncedAt: updatedConfig?.lastSyncedAt?.toISOString() || null,
      });
    } catch (error: any) {
      console.error('Error syncing Entra ID users:', error);
      res.status(500).json({
        error: 'Failed to sync Entra ID users',
        details: error.message,
      });
    }
  }
);

export { router as acknowledgmentsRouter };

