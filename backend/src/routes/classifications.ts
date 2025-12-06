import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
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

// GET /api/classifications - list all classifications
router.get(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const classifications = await prisma.classification.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { Asset: true },
          },
        },
      });

      res.json(classifications);
    } catch (error) {
      console.error('Error fetching classifications:', error);
      res.status(500).json({ error: 'Failed to fetch classifications' });
    }
  }
);

// GET /api/classifications/:id - get classification details
router.get(
  '/:id',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const classification = await prisma.classification.findUnique({
        where: { id: req.params.id },
        include: {
          _count: {
            select: { Asset: true },
          },
        },
      });

      if (!classification) {
        return res.status(404).json({ error: 'Classification not found' });
      }

      res.json(classification);
    } catch (error) {
      console.error('Error fetching classification:', error);
      res.status(500).json({ error: 'Failed to fetch classification' });
    }
  }
);

// POST /api/classifications - create classification
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('name').notEmpty().trim(),
    body('description').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const classification = await prisma.classification.create({
        data: {
          id: randomUUID(),
          name: req.body.name,
          description: req.body.description,
          updatedAt: new Date(),
        },
      });

      res.status(201).json(classification);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Classification name already exists' });
      }
      console.error('Error creating classification:', error);
      res.status(500).json({ error: 'Failed to create classification' });
    }
  }
);

// PUT /api/classifications/:id - update classification
router.put(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('name').optional().notEmpty().trim(),
    body('description').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const classification = await prisma.classification.update({
        where: { id: req.params.id },
        data: {
          ...(req.body.name && { name: req.body.name }),
          ...(req.body.description !== undefined && { description: req.body.description }),
        },
      });

      res.json(classification);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Classification not found' });
      }
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Classification name already exists' });
      }
      console.error('Error updating classification:', error);
      res.status(500).json({ error: 'Failed to update classification' });
    }
  }
);

// DELETE /api/classifications/:id - delete classification
router.delete(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Check if classification is used by any assets
      const assetCount = await prisma.asset.count({
        where: { classificationId: req.params.id },
      });

      if (assetCount > 0) {
        return res.status(409).json({
          error: `Cannot delete classification: it is used by ${assetCount} asset(s)`,
        });
      }

      await prisma.classification.delete({
        where: { id: req.params.id },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Classification not found' });
      }
      console.error('Error deleting classification:', error);
      res.status(500).json({ error: 'Failed to delete classification' });
    }
  }
);

export default router;


