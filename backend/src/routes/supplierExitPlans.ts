import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
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
          impactAssessment: Prisma.JsonNull,
          dataAndIpr: Prisma.JsonNull,
          replacementServiceAnalysis: Prisma.JsonNull,
          contractClosure: Prisma.JsonNull,
          lessonsLearned: Prisma.JsonNull,
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

      if (req.body.impactAssessment !== undefined) updateData.impactAssessment = req.body.impactAssessment;
      if (req.body.dataAndIpr !== undefined) updateData.dataAndIpr = req.body.dataAndIpr;
      if (req.body.replacementServiceAnalysis !== undefined) updateData.replacementServiceAnalysis = req.body.replacementServiceAnalysis;
      if (req.body.contractClosure !== undefined) updateData.contractClosure = req.body.contractClosure;
      if (req.body.lessonsLearned !== undefined) updateData.lessonsLearned = req.body.lessonsLearned;

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

