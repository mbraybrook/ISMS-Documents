/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { importAssetsFromCSV } from '../services/assetImportService';
import * as fs from 'fs';
import { csvUpload, handleMulterError } from '../lib/multerConfig';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/assets - list assets with filtering
router.get(
  '/',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('categoryId').optional().isUUID(),
    query('classificationId').optional().isUUID(),
    query('owner').optional().isString(),
    query('search').optional().isString(),
    query('sortBy').optional().isIn(['date', 'category', 'owner']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        page = '1',
        limit = '20',
        categoryId,
        classificationId,
        owner,
        search,
        sortBy = 'date',
        sortOrder = 'desc',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      
      if (categoryId) where.assetCategoryId = categoryId;
      if (classificationId) where.classificationId = classificationId;
      if (owner) where.owner = { contains: owner as string };
      
      if (search) {
        where.OR = [
          { nameSerialNo: { contains: search as string } },
          { model: { contains: search as string } },
          { manufacturer: { contains: search as string } },
          { primaryUser: { contains: search as string } },
          { location: { contains: search as string } },
        ];
      }

      // Build orderBy clause
      let orderBy: any = {};
      if (sortBy === 'date') {
        orderBy = { date: sortOrder };
      } else if (sortBy === 'category') {
        orderBy = { AssetCategory: { name: sortOrder } };
      } else if (sortBy === 'owner') {
        orderBy = { owner: sortOrder };
      } else {
        orderBy = { date: 'desc' };
      }

      const [assets, total] = await Promise.all([
        prisma.asset.findMany({
          where,
          skip,
          take: limitNum,
          orderBy,
          include: {
            AssetCategory: {
              select: {
                id: true,
                name: true,
              },
            },
            Classification: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: { Risk: true },
            },
          },
        }),
        prisma.asset.count({ where }),
      ]);

      // Map response to match frontend expectations (camelCase relation names)
      const mappedAssets = assets.map((asset: any) => {
        const { AssetCategory, Classification, _count, ...rest } = asset;
        return {
          ...rest,
          category: AssetCategory,
          classification: Classification,
          _count: _count ? {
            risks: _count.Risk || 0,
          } : undefined,
        };
      });

      res.json({
        data: mappedAssets,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Error fetching assets:', error);
      res.status(500).json({ error: 'Failed to fetch assets' });
    }
  }
);

// GET /api/assets/:id - get asset details with linked risks
router.get(
  '/:id',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const asset = await prisma.asset.findUnique({
        where: { id: req.params.id },
        include: {
          AssetCategory: true,
          Classification: true,
          Risk: {
            select: {
              id: true,
              title: true,
              calculatedScore: true,
              mitigatedScore: true,
            },
          },
        },
      });

      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      // Map response to match frontend expectations
      const { AssetCategory, Classification, Risk, ...rest } = asset;
      const mappedAsset = {
        ...rest,
        category: AssetCategory,
        classification: Classification,
        risks: Risk,
      };

      res.json(mappedAsset);
    } catch (error) {
      console.error('Error fetching asset:', error);
      res.status(500).json({ error: 'Failed to fetch asset' });
    }
  }
);

// POST /api/assets - create asset
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('date').isISO8601(),
    body('assetCategoryId').isUUID(),
    body('owner').notEmpty().trim(),
    body('classificationId').isUUID(),
    body('assetSubCategory').optional().isString(),
    body('primaryUser').optional().isString(),
    body('location').optional().isString(),
    body('manufacturer').optional().isString(),
    body('model').optional().isString(),
    body('nameSerialNo').optional().isString(),
    body('purpose').optional().isString(),
    body('notes').optional().isString(),
    body('cost').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const asset = await prisma.asset.create({
        data: {
          id: randomUUID(),
          date: new Date(req.body.date),
          assetCategoryId: req.body.assetCategoryId,
          assetSubCategory: req.body.assetSubCategory,
          owner: req.body.owner,
          primaryUser: req.body.primaryUser,
          location: req.body.location,
          manufacturer: req.body.manufacturer,
          model: req.body.model,
          nameSerialNo: req.body.nameSerialNo,
          classificationId: req.body.classificationId,
          purpose: req.body.purpose,
          notes: req.body.notes,
          cost: req.body.cost,
          updatedAt: new Date(),
        },
        include: {
          AssetCategory: {
            select: {
              id: true,
              name: true,
            },
          },
          Classification: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Map response to match frontend expectations
      const { AssetCategory, Classification, ...rest } = asset as any;
      const mappedAsset = {
        ...rest,
        category: AssetCategory,
        classification: Classification,
      };

      res.status(201).json(mappedAsset);
    } catch (error: any) {
      if (error.code === 'P2003') {
        return res.status(400).json({ error: 'Invalid category or classification ID' });
      }
      console.error('Error creating asset:', error);
      res.status(500).json({ error: 'Failed to create asset' });
    }
  }
);

// PUT /api/assets/:id - update asset
router.put(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('date').optional().isISO8601(),
    body('assetCategoryId').optional().isUUID(),
    body('owner').optional().notEmpty().trim(),
    body('classificationId').optional().isUUID(),
    body('assetSubCategory').optional().isString(),
    body('primaryUser').optional().isString(),
    body('location').optional().isString(),
    body('manufacturer').optional().isString(),
    body('model').optional().isString(),
    body('nameSerialNo').optional().isString(),
    body('purpose').optional().isString(),
    body('notes').optional().isString(),
    body('cost').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const updateData: any = {};
      
      if (req.body.date) updateData.date = new Date(req.body.date);
      if (req.body.assetCategoryId) updateData.assetCategoryId = req.body.assetCategoryId;
      if (req.body.owner !== undefined) updateData.owner = req.body.owner;
      if (req.body.classificationId) updateData.classificationId = req.body.classificationId;
      if (req.body.assetSubCategory !== undefined) updateData.assetSubCategory = req.body.assetSubCategory;
      if (req.body.primaryUser !== undefined) updateData.primaryUser = req.body.primaryUser;
      if (req.body.location !== undefined) updateData.location = req.body.location;
      if (req.body.manufacturer !== undefined) updateData.manufacturer = req.body.manufacturer;
      if (req.body.model !== undefined) updateData.model = req.body.model;
      if (req.body.nameSerialNo !== undefined) updateData.nameSerialNo = req.body.nameSerialNo;
      if (req.body.purpose !== undefined) updateData.purpose = req.body.purpose;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.cost !== undefined) updateData.cost = req.body.cost;

      const asset = await prisma.asset.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          AssetCategory: {
            select: {
              id: true,
              name: true,
            },
          },
          Classification: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Map response to match frontend expectations
      const { AssetCategory, Classification, ...rest } = asset;
      const mappedAsset = {
        ...rest,
        category: AssetCategory,
        classification: Classification,
      };

      res.json(mappedAsset);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Asset not found' });
      }
      if (error.code === 'P2003') {
        return res.status(400).json({ error: 'Invalid category or classification ID' });
      }
      console.error('Error updating asset:', error);
      res.status(500).json({ error: 'Failed to update asset' });
    }
  }
);

// DELETE /api/assets/:id - delete asset
router.delete(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Check if asset is linked to any risks
      const riskCount = await prisma.risk.count({
        where: { assetId: req.params.id },
      });

      if (riskCount > 0) {
        return res.status(409).json({
          error: `Cannot delete asset: it is linked to ${riskCount} risk(s)`,
        });
      }

      await prisma.asset.delete({
        where: { id: req.params.id },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Asset not found' });
      }
      console.error('Error deleting asset:', error);
      res.status(500).json({ error: 'Failed to delete asset' });
    }
  }
);

// POST /api/assets/import - bulk import from CSV
router.post(
  '/import',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  csvUpload.single('file'),
  handleMulterError,
  async (req: AuthRequest, res: Response) => {
    try {
      let result;
      
      if (req.file) {
        // File was uploaded - use the file buffer
        result = await importAssetsFromCSV(req.file.buffer);
      } else if (req.body.filePath) {
        // Legacy support: file path provided in body
        const csvPath = req.body.filePath;
        if (!fs.existsSync(csvPath)) {
          return res.status(400).json({ error: `CSV file not found: ${csvPath}` });
        }
        result = await importAssetsFromCSV(csvPath);
      } else {
        // No file provided
        return res.status(400).json({ 
          error: 'No file provided. Please upload a CSV file.' 
        });
      }

      res.json({
        success: result.success,
        failed: result.failed,
        total: result.total,
        errors: result.errors,
      });
    } catch (error: any) {
      console.error('Error importing assets:', error);
      res.status(500).json({ error: error.message || 'Failed to import assets' });
    }
  }
);

export default router;

