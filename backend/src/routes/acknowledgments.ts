import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';

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
    userAcknowledgments.forEach((ack) => {
      const existing = acknowledgmentMap.get(ack.documentId);
      if (!existing || ack.documentVersion > existing) {
        acknowledgmentMap.set(ack.documentId, ack.documentVersion);
      }
    });

    // Filter documents that need acknowledgment
    const pendingDocuments = approvedDocuments.filter((doc) => {
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
        userAcknowledgments.forEach((ack) => {
          const existing = acknowledgmentMap.get(ack.documentId);
          if (!existing || ack.documentVersion > existing) {
            acknowledgmentMap.set(ack.documentId, ack.documentVersion);
          }
        });

        documentsToAcknowledge = approvedDocuments.filter((doc) => {
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
        documentsToAcknowledge.map(async (doc) => {
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
      // Get all approved documents
      const approvedDocuments = await prisma.document.findMany({
        where: { status: 'APPROVED' },
      });

      // Get all users (staff)
      const allUsers = await prisma.user.findMany({
        where: {
          role: { in: ['STAFF', 'EDITOR', 'ADMIN'] },
        },
      });

      // Get all acknowledgments
      const allAcknowledgments = await prisma.acknowledgment.findMany({
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          document: {
            select: {
              id: true,
              title: true,
              version: true,
            },
          },
        },
      });

      // Build stats per document
      const stats = approvedDocuments.map((doc) => {
        // Get latest acknowledgments for this document version
        const docAcks = allAcknowledgments.filter(
          (ack) => ack.documentId === doc.id && ack.documentVersion === doc.version
        );

        const acknowledgedUserIds = new Set(docAcks.map((ack) => ack.userId));
        const totalUsers = allUsers.length;
        const acknowledgedCount = acknowledgedUserIds.size;
        const percentage = totalUsers > 0 ? (acknowledgedCount / totalUsers) * 100 : 0;

        return {
          documentId: doc.id,
          documentTitle: doc.title,
          documentVersion: doc.version,
          totalUsers,
          acknowledgedCount,
          percentage: Math.round(percentage * 100) / 100,
          acknowledgedUsers: docAcks.map((ack) => ({
            userId: ack.user.id,
            displayName: ack.user.displayName,
            email: ack.user.email,
            acknowledgedAt: ack.acknowledgedAt,
          })),
        };
      });

      res.json(stats);
    } catch (error) {
      console.error('Error fetching acknowledgment stats:', error);
      res.status(500).json({ error: 'Failed to fetch acknowledgment statistics' });
    }
  }
);

export { router as acknowledgmentsRouter };

