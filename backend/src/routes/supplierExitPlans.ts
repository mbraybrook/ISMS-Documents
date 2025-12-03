import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { ExitPlanStatus } from '../types/enums';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/suppliers/:id/exit-plan - Get exit plan for supplier
router.get(
  '/:id/exit-plan',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const exitPlan = await prisma.supplierExitPlan.findUnique({
        where: { supplierId: req.params.id },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              lifecycleState: true,
            },
          },
        },
      });

      // Return null if no exit plan exists (this is a valid state, not an error)
      if (!exitPlan) {
        return res.json(null);
      }

      res.json(exitPlan);
    } catch (error) {
      console.error('Error fetching exit plan:', error);
      res.status(500).json({ error: 'Failed to fetch exit plan' });
    }
  }
);

// POST /api/suppliers/:id/exit-plan - Create exit plan for supplier
router.post(
  '/:id/exit-plan',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('reason').optional().isString(),
    body('startDate').optional().isISO8601(),
    body('targetEndDate').optional().isISO8601(),
    body('status').optional().isIn(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Verify supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.id },
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      // Check if exit plan already exists
      const existingPlan = await prisma.supplierExitPlan.findUnique({
        where: { supplierId: req.params.id },
      });

      if (existingPlan) {
        return res.status(400).json({ error: 'Exit plan already exists for this supplier' });
      }

      // Create exit plan
      const exitPlan = await prisma.supplierExitPlan.create({
        data: {
          id: randomUUID(),
          supplierId: req.params.id,
          reason: req.body.reason || null,
          startDate: req.body.startDate ? new Date(req.body.startDate) : null,
          targetEndDate: req.body.targetEndDate ? new Date(req.body.targetEndDate) : null,
          status: (req.body.status as ExitPlanStatus) || 'PLANNED',
          impactAssessment: null,
          dataAndIpr: null,
          replacementServiceAnalysis: null,
          contractClosure: null,
          lessonsLearned: null,
        },
      });

      // Note: Exit plans can be created without changing supplier lifecycle state
      // This allows business continuity planning without actively exiting suppliers
      // The lifecycle state can be manually changed to EXIT_IN_PROGRESS when needed

      res.status(201).json(exitPlan);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Exit plan already exists for this supplier' });
      }
      console.error('Error creating exit plan:', error);
      res.status(500).json({ error: 'Failed to create exit plan' });
    }
  }
);

// PUT /api/suppliers/:id/exit-plan - Update exit plan
router.put(
  '/:id/exit-plan',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('reason').optional().isString(),
    body('startDate').optional().isISO8601(),
    body('targetEndDate').optional().isISO8601(),
    body('completedAt').optional().isISO8601(),
    body('status').optional().isIn(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    body('impactAssessment').optional().isObject(),
    body('dataAndIpr').optional().isObject(),
    body('replacementServiceAnalysis').optional().isObject(),
    body('contractClosure').optional().isObject(),
    body('lessonsLearned').optional().isObject(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const exitPlan = await prisma.supplierExitPlan.findUnique({
        where: { supplierId: req.params.id },
      });

      if (!exitPlan) {
        return res.status(404).json({ error: 'Exit plan not found' });
      }

      const updateData: any = {};

      if (req.body.reason !== undefined) updateData.reason = req.body.reason;
      if (req.body.startDate !== undefined) updateData.startDate = req.body.startDate ? new Date(req.body.startDate) : null;
      if (req.body.targetEndDate !== undefined) updateData.targetEndDate = req.body.targetEndDate ? new Date(req.body.targetEndDate) : null;
      if (req.body.completedAt !== undefined) updateData.completedAt = req.body.completedAt ? new Date(req.body.completedAt) : null;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.impactAssessment !== undefined) updateData.impactAssessment = req.body.impactAssessment;
      if (req.body.dataAndIpr !== undefined) updateData.dataAndIpr = req.body.dataAndIpr;
      if (req.body.replacementServiceAnalysis !== undefined) updateData.replacementServiceAnalysis = req.body.replacementServiceAnalysis;
      if (req.body.contractClosure !== undefined) updateData.contractClosure = req.body.contractClosure;
      if (req.body.lessonsLearned !== undefined) updateData.lessonsLearned = req.body.lessonsLearned;

      // If status is COMPLETED and completedAt is not set, set it automatically
      if (req.body.status === 'COMPLETED' && !exitPlan.completedAt && !updateData.completedAt) {
        updateData.completedAt = new Date();
      }

      const updatedPlan = await prisma.supplierExitPlan.update({
        where: { supplierId: req.params.id },
        data: updateData,
      });

      res.json(updatedPlan);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Exit plan not found' });
      }
      console.error('Error updating exit plan:', error);
      res.status(500).json({ error: 'Failed to update exit plan' });
    }
  }
);

// DELETE /api/suppliers/:id/exit-plan - Delete exit plan
router.delete(
  '/:id/exit-plan',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const exitPlan = await prisma.supplierExitPlan.findUnique({
        where: { supplierId: req.params.id },
      });

      if (!exitPlan) {
        return res.status(404).json({ error: 'Exit plan not found' });
      }

      await prisma.supplierExitPlan.delete({
        where: { supplierId: req.params.id },
      });

      // Note: We don't automatically change supplier lifecycle state when deleting exit plan
      // The lifecycle state should be managed separately based on business needs

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Exit plan not found' });
      }
      console.error('Error deleting exit plan:', error);
      res.status(500).json({ error: 'Failed to delete exit plan' });
    }
  }
);

export default router;

