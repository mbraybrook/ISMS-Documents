import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
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

// GET /api/reviews/dashboard - structured data for dashboard
router.get('/dashboard', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // Upcoming reviews (next 30 days)
    const upcomingReviews = await prisma.reviewTask.findMany({
      where: {
        dueDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
        status: 'PENDING',
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            version: true,
            type: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    // Overdue reviews
    const overdueReviews = await prisma.reviewTask.findMany({
      where: {
        dueDate: {
          lt: now,
        },
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            version: true,
            type: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    // Recently completed reviews (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const recentlyCompletedReviews = await prisma.reviewTask.findMany({
      where: {
        status: 'COMPLETED',
        completedDate: {
          gte: thirtyDaysAgo,
        },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            version: true,
            type: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: {
        completedDate: 'desc',
      },
      take: 20,
    });

    // Documents with nextReviewDate in next 30 days (upcoming)
    const upcomingDocuments = await prisma.document.findMany({
      where: {
        nextReviewDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
        status: { in: ['APPROVED', 'IN_REVIEW'] },
        // Exclude documents that already have active ReviewTasks
        reviewTasks: {
          none: {
            status: { in: ['PENDING', 'OVERDUE'] },
          },
        },
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
      orderBy: {
        nextReviewDate: 'asc',
      },
    });

    // Documents overdue for review (nextReviewDate < today)
    const overdueDocuments = await prisma.document.findMany({
      where: {
        nextReviewDate: {
          lt: now,
        },
        status: { in: ['APPROVED', 'IN_REVIEW'] },
        // Exclude documents that already have active ReviewTasks
        reviewTasks: {
          none: {
            status: { in: ['PENDING', 'OVERDUE'] },
          },
        },
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
      orderBy: {
        nextReviewDate: 'asc', // Most overdue first (earliest dates)
      },
    });

    // Documents missing nextReviewDate
    // Exclude documents that already have active ReviewTasks (they have a review scheduled)
    const needsReviewDate = await prisma.document.findMany({
      where: {
        nextReviewDate: null,
        status: { in: ['APPROVED', 'IN_REVIEW'] },
        // Exclude documents that already have active ReviewTasks
        reviewTasks: {
          none: {
            status: { in: ['PENDING', 'OVERDUE'] },
          },
        },
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
      orderBy: {
        updatedAt: 'desc',
      },
    });

    res.json({
      upcomingReviews,
      overdueReviews,
      recentlyCompletedReviews,
      documentsNeedingReview: upcomingDocuments, // Keep for backward compatibility
      upcomingDocuments,
      overdueDocuments,
      needsReviewDate,
    });
  } catch (error) {
    console.error('Error fetching review dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch review dashboard' });
  }
});

// POST /api/reviews - create review task
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('documentId').isUUID(),
    body('reviewerUserId').isUUID(),
    body('dueDate').isISO8601(),
    body('changeNotes').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { documentId, reviewerUserId, dueDate, changeNotes } = req.body;

      // Check if document exists
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Determine status based on due date
      const dueDateObj = new Date(dueDate);
      const now = new Date();
      const status = dueDateObj < now ? 'OVERDUE' : 'PENDING';

      // If document doesn't have a nextReviewDate, update it to match the review due date
      // This ensures documents with scheduled reviews don't appear in "Missing Review Date"
      if (!document.nextReviewDate) {
        await prisma.document.update({
          where: { id: documentId },
          data: { nextReviewDate: dueDateObj },
        });
      }

      const reviewTask = await prisma.reviewTask.create({
        data: {
          documentId,
          reviewerUserId,
          dueDate: dueDateObj,
          changeNotes,
          status,
        },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              version: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json(reviewTask);
    } catch (error) {
      console.error('Error creating review task:', error);
      res.status(500).json({ error: 'Failed to create review task' });
    }
  }
);

// PUT /api/reviews/:id/complete - mark review as completed
router.put(
  '/:id/complete',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('completedDate').optional().isISO8601(),
    body('changeNotes').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { completedDate, changeNotes } = req.body;

      const reviewTask = await prisma.reviewTask.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedDate: completedDate ? new Date(completedDate) : new Date(),
          changeNotes,
        },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              version: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      res.json(reviewTask);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Review task not found' });
      }
      console.error('Error completing review task:', error);
      res.status(500).json({ error: 'Failed to complete review task' });
    }
  }
);

// GET /api/reviews/document/:documentId - review history for document
router.get(
  '/document/:documentId',
  authenticateToken,
  [param('documentId').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { documentId } = req.params;

      const reviewTasks = await prisma.reviewTask.findMany({
        where: { documentId },
        include: {
          reviewer: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json(reviewTasks);
    } catch (error) {
      console.error('Error fetching review history:', error);
      res.status(500).json({ error: 'Failed to fetch review history' });
    }
  }
);

export { router as reviewsRouter };

