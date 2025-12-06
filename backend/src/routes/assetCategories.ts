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

// GET /api/asset-categories - list all asset categories with asset counts
router.get(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const categories = await prisma.assetCategory.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { Asset: true, Risk: true },
          },
        },
      });

      // Map response to match frontend expectations (camelCase relation names)
      const mappedCategories = categories.map((category: any) => {
        const { _count, ...rest } = category;
        return {
          ...rest,
          _count: _count ? {
            assets: _count.Asset || 0,
            risks: _count.Risk || 0,
          } : undefined,
        };
      });

      res.json(mappedCategories);
    } catch (error) {
      console.error('Error fetching asset categories:', error);
      res.status(500).json({ error: 'Failed to fetch asset categories' });
    }
  }
);

// GET /api/asset-categories/:id - get category details with assets
router.get(
  '/:id',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const category = await prisma.assetCategory.findUnique({
        where: { id: req.params.id },
        include: {
          assets: {
            take: 10,
            orderBy: { date: 'desc' },
            include: {
              classification: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: { Asset: true, Risk: true },
          },
        },
      });

      if (!category) {
        return res.status(404).json({ error: 'Asset category not found' });
      }

      // Map response to match frontend expectations (camelCase relation names)
      const { _count, ...rest } = category as any;
      const mappedCategory = {
        ...rest,
        _count: _count ? {
          assets: _count.Asset || 0,
          risks: _count.Risk || 0,
        } : undefined,
      };

      res.json(mappedCategory);
    } catch (error) {
      console.error('Error fetching asset category:', error);
      res.status(500).json({ error: 'Failed to fetch asset category' });
    }
  }
);

// POST /api/asset-categories - create asset category
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
      const category = await prisma.assetCategory.create({
        data: {
          name: req.body.name,
          description: req.body.description,
        },
      });

      res.status(201).json(category);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Asset category name already exists' });
      }
      console.error('Error creating asset category:', error);
      res.status(500).json({ error: 'Failed to create asset category' });
    }
  }
);

// PUT /api/asset-categories/:id - update asset category
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
      const category = await prisma.assetCategory.update({
        where: { id: req.params.id },
        data: {
          ...(req.body.name && { name: req.body.name }),
          ...(req.body.description !== undefined && { description: req.body.description }),
        },
      });

      res.json(category);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Asset category not found' });
      }
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Asset category name already exists' });
      }
      console.error('Error updating asset category:', error);
      res.status(500).json({ error: 'Failed to update asset category' });
    }
  }
);

// DELETE /api/asset-categories/:id - delete asset category
router.delete(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Check if category is used by any assets
      const assetCount = await prisma.asset.count({
        where: { assetCategoryId: req.params.id },
      });

      if (assetCount > 0) {
        return res.status(409).json({
          error: `Cannot delete asset category: it is used by ${assetCount} asset(s)`,
        });
      }

      // Check if category is used by any risks
      const riskCount = await prisma.risk.count({
        where: { assetCategoryId: req.params.id },
      });

      if (riskCount > 0) {
        return res.status(409).json({
          error: `Cannot delete asset category: it is used by ${riskCount} risk(s)`,
        });
      }

      await prisma.assetCategory.delete({
        where: { id: req.params.id },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Asset category not found' });
      }
      console.error('Error deleting asset category:', error);
      res.status(500).json({ error: 'Failed to delete asset category' });
    }
  }
);

export default router;


