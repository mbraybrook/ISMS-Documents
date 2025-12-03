import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { ReviewType, ReviewOutcome, PerformanceRating } from '../types/enums';
import { calculateNextReviewDate } from '../services/supplierReviewScheduler';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('Validation errors:', JSON.stringify(errors.array(), null, 2));
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    return res.status(400).json({ 
      error: 'Validation failed',
      errors: errors.array(),
      details: errors.array().map((e: any) => `${e.param}: ${e.msg}`).join(', ')
    });
  }
  next();
};

// GET /api/suppliers/:id/compliance-reviews - List all compliance reviews
router.get(
  '/:id/compliance-reviews',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const reviews = await prisma.supplierComplianceReview.findMany({
        where: { supplierId: req.params.id },
        include: {
          reviewedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: { plannedAt: 'desc' },
      });

      res.json(reviews);
    } catch (error) {
      console.error('Error fetching compliance reviews:', error);
      res.status(500).json({ error: 'Failed to fetch compliance reviews' });
    }
  }
);

// GET /api/suppliers/:id/compliance-reviews/:reviewId - Get review details
router.get(
  '/:id/compliance-reviews/:reviewId',
  authenticateToken,
  [param('id').isUUID(), param('reviewId').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const review = await prisma.supplierComplianceReview.findUnique({
        where: { id: req.params.reviewId },
        include: {
          reviewedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      if (!review || review.supplierId !== req.params.id) {
        return res.status(404).json({ error: 'Compliance review not found' });
      }

      res.json(review);
    } catch (error) {
      console.error('Error fetching compliance review:', error);
      res.status(500).json({ error: 'Failed to fetch compliance review' });
    }
  }
);

// POST /api/suppliers/:id/compliance-reviews - Create compliance review
router.post(
  '/:id/compliance-reviews',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('reviewType').isIn(['SCHEDULED', 'TRIGGERED_BY_INCIDENT', 'TRIGGERED_BY_CHANGE']),
    body('plannedAt').custom((value) => {
      if (!value) return false;
      const date = new Date(value);
      return !isNaN(date.getTime());
    }).withMessage('plannedAt must be a valid date'),
    body('checksPerformed').optional().isString(),
    body('notes').optional().isString(),
    body('evidenceLinks').optional().custom((value) => {
      if (value === undefined || value === null) return true;
      return Array.isArray(value);
    }).withMessage('evidenceLinks must be an array'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.id },
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      const review = await prisma.supplierComplianceReview.create({
        data: {
          id: randomUUID(),
          supplierId: req.params.id,
          reviewType: req.body.reviewType,
          plannedAt: new Date(req.body.plannedAt),
          checksPerformed: req.body.checksPerformed || null,
          notes: req.body.notes || null,
          evidenceLinks: req.body.evidenceLinks && Array.isArray(req.body.evidenceLinks) && req.body.evidenceLinks.length > 0
            ? JSON.parse(JSON.stringify(req.body.evidenceLinks))
            : null,
        },
        include: {
          reviewedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json(review);
    } catch (error: any) {
      console.error('Error creating compliance review:', error);
      res.status(500).json({ error: 'Failed to create compliance review' });
    }
  }
);

// PUT /api/suppliers/:id/compliance-reviews/:reviewId - Update review
router.put(
  '/:id/compliance-reviews/:reviewId',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    param('reviewId').isUUID(),
    body('reviewType').optional().isIn(['SCHEDULED', 'TRIGGERED_BY_INCIDENT', 'TRIGGERED_BY_CHANGE']),
    body('plannedAt').optional().isISO8601().toDate(),
    body('checksPerformed').optional().isString(),
    body('notes').optional().isString(),
    body('evidenceLinks').optional().isArray(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const review = await prisma.supplierComplianceReview.findUnique({
        where: { id: req.params.reviewId },
      });

      if (!review || review.supplierId !== req.params.id) {
        return res.status(404).json({ error: 'Compliance review not found' });
      }

      if (review.completedAt) {
        return res.status(400).json({ error: 'Cannot update completed review' });
      }

      const updateData: any = {};
      if (req.body.reviewType !== undefined) updateData.reviewType = req.body.reviewType;
      if (req.body.plannedAt !== undefined) updateData.plannedAt = new Date(req.body.plannedAt);
      if (req.body.checksPerformed !== undefined) updateData.checksPerformed = req.body.checksPerformed || null;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes || null;
      if (req.body.evidenceLinks !== undefined) {
        updateData.evidenceLinks = req.body.evidenceLinks
          ? JSON.parse(JSON.stringify(req.body.evidenceLinks))
          : null;
      }

      const updated = await prisma.supplierComplianceReview.update({
        where: { id: req.params.reviewId },
        data: updateData,
        include: {
          reviewedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      res.json(updated);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Compliance review not found' });
      }
      console.error('Error updating compliance review:', error);
      res.status(500).json({ error: 'Failed to update compliance review' });
    }
  }
);

// POST /api/suppliers/:id/compliance-reviews/:reviewId/complete - Complete review
router.post(
  '/:id/compliance-reviews/:reviewId/complete',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    param('reviewId').isUUID(),
    body('outcome').isIn(['PASS', 'ISSUES_FOUND', 'FAIL']),
    body('completedAt').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      const date = new Date(value);
      return !isNaN(date.getTime());
    }).withMessage('completedAt must be a valid date'),
    body('updatedPerformanceRating').optional().isIn(['GOOD', 'CAUTION', 'BAD']),
    body('notes').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return typeof value === 'string';
    }).withMessage('notes must be a string'),
    // Risk & Criticality fields
    body('ciaImpact').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('overallRiskRating').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('criticality').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('riskRationale').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return typeof value === 'string';
    }).withMessage('riskRationale must be a string'),
    body('criticalityRationale').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return typeof value === 'string';
    }).withMessage('criticalityRationale must be a string'),
    body('lastRiskAssessmentAt').optional().custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(value) || !isNaN(Date.parse(value));
    }),
    body('lastCriticalityAssessmentAt').optional().custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(value) || !isNaN(Date.parse(value));
    }),
    // Compliance fields
    body('pciStatus').optional().isIn(['UNKNOWN', 'PASS', 'FAIL', 'NOT_APPLICABLE']),
    body('iso27001Status').optional().isIn(['UNKNOWN', 'CERTIFIED', 'NOT_CERTIFIED', 'IN_PROGRESS', 'NOT_APPLICABLE']),
    body('iso22301Status').optional().isIn(['UNKNOWN', 'CERTIFIED', 'NOT_CERTIFIED', 'IN_PROGRESS', 'NOT_APPLICABLE']),
    body('iso9001Status').optional().isIn(['UNKNOWN', 'CERTIFIED', 'NOT_CERTIFIED', 'IN_PROGRESS', 'NOT_APPLICABLE']),
    body('gdprStatus').optional().isIn(['UNKNOWN', 'ADEQUATE', 'HIGH_RISK', 'NOT_APPLICABLE']),
    body('complianceEvidenceLinks').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return Array.isArray(value);
    }).withMessage('complianceEvidenceLinks must be an array'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      const review = await prisma.supplierComplianceReview.findUnique({
        where: { id: req.params.reviewId },
        include: {
          supplier: true,
        },
      });

      if (!review || review.supplierId !== req.params.id) {
        return res.status(404).json({ error: 'Compliance review not found' });
      }

      if (review.completedAt) {
        return res.status(400).json({ error: 'Review is already completed' });
      }

      const completedAt = req.body.completedAt ? new Date(req.body.completedAt) : new Date();

      // Update review
      const updated = await prisma.supplierComplianceReview.update({
        where: { id: req.params.reviewId },
        data: {
          outcome: req.body.outcome,
          completedAt,
          reviewedByUserId: user.id,
          updatedPerformanceRating: req.body.updatedPerformanceRating || null,
          notes: req.body.notes || review.notes || null,
        },
        include: {
          reviewedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Update supplier with all review fields
      const updateData: any = {
        lastReviewAt: completedAt,
        lastComplianceReviewAt: completedAt,
      };

      // Performance rating
      if (req.body.updatedPerformanceRating) {
        updateData.performanceRating = req.body.updatedPerformanceRating;
      }

      // Risk & Criticality fields
      if (req.body.ciaImpact !== undefined) {
        updateData.ciaImpact = req.body.ciaImpact || null;
      }
      if (req.body.overallRiskRating !== undefined) {
        updateData.overallRiskRating = req.body.overallRiskRating || null;
      }
      if (req.body.criticality !== undefined) {
        updateData.criticality = req.body.criticality || null;
      }
      if (req.body.riskRationale !== undefined) {
        updateData.riskRationale = req.body.riskRationale || null;
      }
      if (req.body.criticalityRationale !== undefined) {
        updateData.criticalityRationale = req.body.criticalityRationale || null;
      }
      if (req.body.lastRiskAssessmentAt !== undefined) {
        updateData.lastRiskAssessmentAt = req.body.lastRiskAssessmentAt && req.body.lastRiskAssessmentAt.trim() !== ''
          ? new Date(req.body.lastRiskAssessmentAt)
          : null;
      }
      if (req.body.lastCriticalityAssessmentAt !== undefined) {
        updateData.lastCriticalityAssessmentAt = req.body.lastCriticalityAssessmentAt && req.body.lastCriticalityAssessmentAt.trim() !== ''
          ? new Date(req.body.lastCriticalityAssessmentAt)
          : null;
      }

      // Compliance status fields
      if (req.body.pciStatus !== undefined) {
        updateData.pciStatus = req.body.pciStatus || null;
      }
      if (req.body.iso27001Status !== undefined) {
        updateData.iso27001Status = req.body.iso27001Status || null;
      }
      if (req.body.iso22301Status !== undefined) {
        updateData.iso22301Status = req.body.iso22301Status || null;
      }
      if (req.body.iso9001Status !== undefined) {
        updateData.iso9001Status = req.body.iso9001Status || null;
      }
      if (req.body.gdprStatus !== undefined) {
        updateData.gdprStatus = req.body.gdprStatus || null;
      }

      // Compliance evidence links - merge with existing
      if (req.body.complianceEvidenceLinks !== undefined) {
        const existingLinks = review.supplier.complianceEvidenceLinks
          ? (Array.isArray(review.supplier.complianceEvidenceLinks)
              ? review.supplier.complianceEvidenceLinks
              : [])
          : [];
        const newLinks = Array.isArray(req.body.complianceEvidenceLinks)
          ? req.body.complianceEvidenceLinks.filter((link: string) => link && link.trim())
          : [];
        // Merge and deduplicate
        const mergedLinks = [...new Set([...existingLinks, ...newLinks])];
        updateData.complianceEvidenceLinks = mergedLinks.length > 0
          ? JSON.parse(JSON.stringify(mergedLinks))
          : null;
      }

      // Recalculate nextReviewAt based on updated criticality
      const supplierForCalculation = {
        ...review.supplier,
        ...updateData,
        lastReviewAt: completedAt,
      };
      const nextReviewAt = calculateNextReviewDate(supplierForCalculation);
      updateData.nextReviewAt = nextReviewAt;

      await prisma.supplier.update({
        where: { id: req.params.id },
        data: updateData,
      });

      res.json(updated);
    } catch (error: any) {
      console.error('Error completing compliance review:', error);
      res.status(500).json({ error: 'Failed to complete compliance review' });
    }
  }
);

export default router;

