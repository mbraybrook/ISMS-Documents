import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { invalidateCache } from '../services/pdfCacheService';

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

    // Overdue reviews (review tasks that are overdue)
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
            nextReviewDate: true,
            owner: {
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            },
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
        ReviewTask: {
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
        ReviewTask: {
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
        ReviewTask: {
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

    // Create unified overdue items list
    // Combine overdue reviews (with assigned tasks) and overdue documents (without tasks)
    const overdueItems = [
      // Overdue reviews with assigned tasks
      ...overdueReviews.map((review) => ({
        type: 'REVIEW_TASK' as const,
        id: review.id,
        documentId: review.documentId,
        document: review.document,
        dueDate: review.dueDate,
        reviewDate: review.dueDate, // Use dueDate as the review date
        reviewer: review.reviewer,
        status: review.status,
        hasAssignedTask: true,
        daysOverdue: Math.ceil((now.getTime() - new Date(review.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
      })),
      // Overdue documents without assigned tasks
      ...overdueDocuments.map((doc) => ({
        type: 'DOCUMENT' as const,
        id: doc.id,
        documentId: doc.id,
        document: {
          id: doc.id,
          title: doc.title,
          version: doc.version,
          type: doc.type,
          nextReviewDate: doc.nextReviewDate,
          owner: doc.owner,
        },
        dueDate: doc.nextReviewDate,
        reviewDate: doc.nextReviewDate,
        reviewer: null,
        status: null,
        hasAssignedTask: false,
        daysOverdue: doc.nextReviewDate ? Math.ceil((now.getTime() - new Date(doc.nextReviewDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      })),
    ].sort((a, b) => {
      // Sort by days overdue (most overdue first), then by review date
      if (a.daysOverdue !== b.daysOverdue) {
        return b.daysOverdue - a.daysOverdue;
      }
      return new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime();
    });

    res.json({
      upcomingReviews,
      overdueReviews,
      recentlyCompletedReviews,
      documentsNeedingReview: upcomingDocuments, // Keep for backward compatibility
      upcomingDocuments,
      overdueDocuments,
      needsReviewDate,
      overdueItems, // New unified overdue items
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

      // Validate that documentId is provided
      if (!documentId) {
        return res.status(400).json({ error: 'documentId must be provided' });
      }

      // Determine status based on due date
      const dueDateObj = new Date(dueDate);
      const now = new Date();
      const status = dueDateObj < now ? 'OVERDUE' : 'PENDING';

      let includeData: any = {
        reviewer: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      };

      if (documentId) {
        // Check if document exists
        const document = await prisma.document.findUnique({
          where: { id: documentId },
        });

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        // If document doesn't have a nextReviewDate, update it to match the review due date
        if (!document.nextReviewDate) {
          await prisma.document.update({
            where: { id: documentId },
            data: { nextReviewDate: dueDateObj },
          });
        }

        includeData.document = {
          select: {
            id: true,
            title: true,
            version: true,
          },
        };
      }

      const reviewTask = await prisma.reviewTask.create({
        data: {
          documentId: documentId,
          reviewerUserId,
          dueDate: dueDateObj,
          changeNotes,
          status,
        },
        include: includeData,
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

      const completedDateObj = completedDate ? new Date(completedDate) : new Date();

      // Get the review task with document info
      const reviewTask = await prisma.reviewTask.findUnique({
        where: { id },
        include: {
          document: true,
        },
      });

      if (!reviewTask) {
        return res.status(404).json({ error: 'Review task not found' });
      }

      // Update review task
      const includeData: any = {
        reviewer: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      };

      if (reviewTask.documentId) {
        includeData.document = {
          select: {
            id: true,
            title: true,
            version: true,
          },
        };
      }

      const updatedReviewTask = await prisma.reviewTask.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedDate: completedDateObj,
          changeNotes,
        },
        include: includeData,
      });

      // Handle document review completion
      if (reviewTask.documentId) {
        // Automatically update document review dates
        // Set lastReviewDate to completion date and nextReviewDate to completion date + 1 year
        const nextReviewDate = new Date(completedDateObj);
        nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);

        await prisma.document.update({
          where: { id: reviewTask.documentId },
          data: {
            lastReviewDate: completedDateObj,
            nextReviewDate: nextReviewDate,
          },
        });

        // Invalidate PDF cache (optional - review dates don't affect content, but good practice)
        invalidateCache(reviewTask.documentId).catch((err) => {
          console.error('[Review Complete] Error invalidating PDF cache:', err);
        });
      }

      res.json(updatedReviewTask);
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

// POST /api/reviews/bulk-set-review-date - bulk set review dates for documents
router.post(
  '/bulk-set-review-date',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('documentIds').isArray().notEmpty(),
    body('documentIds.*').isUUID(),
    body('reviewDate').optional().isISO8601(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { documentIds, reviewDate } = req.body;

      // If reviewDate is provided, use it; otherwise default to today + 1 year
      const reviewDateObj = reviewDate ? new Date(reviewDate) : (() => {
        const date = new Date();
        date.setFullYear(date.getFullYear() + 1);
        return date;
      })();

      // Update all documents
      const result = await prisma.document.updateMany({
        where: {
          id: { in: documentIds },
        },
        data: {
          nextReviewDate: reviewDateObj,
        },
      });

      res.json({
        success: true,
        updated: result.count,
        reviewDate: reviewDateObj.toISOString(),
      });
    } catch (error) {
      console.error('Error bulk setting review dates:', error);
      res.status(500).json({ error: 'Failed to bulk set review dates' });
    }
  }
);

export { router as reviewsRouter };

