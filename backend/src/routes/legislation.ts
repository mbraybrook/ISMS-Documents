import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import multer from 'multer';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { importLegislationFromCSV } from '../services/legislationImportService';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/legislation - list all legislation with risk counts
router.get(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const legislation = await prisma.legislation.findMany({
        orderBy: { actRegulationRequirement: 'asc' },
        include: {
          _count: {
            select: { risks: true },
          },
        },
      });

      res.json(legislation);
    } catch (error) {
      console.error('Error fetching legislation:', error);
      res.status(500).json({ error: 'Failed to fetch legislation' });
    }
  }
);

// GET /api/legislation/:id - get legislation details with linked risks
router.get(
  '/:id',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const legislation = await prisma.legislation.findUnique({
        where: { id: req.params.id },
        include: {
          risks: {
            take: 10,
            orderBy: { dateAdded: 'desc' },
            select: {
              id: true,
              title: true,
              dateAdded: true,
              calculatedScore: true,
            },
          },
          _count: {
            select: { risks: true },
          },
        },
      });

      if (!legislation) {
        return res.status(404).json({ error: 'Legislation not found' });
      }

      res.json(legislation);
    } catch (error) {
      console.error('Error fetching legislation:', error);
      res.status(500).json({ error: 'Failed to fetch legislation' });
    }
  }
);

// POST /api/legislation - create legislation
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('actRegulationRequirement').notEmpty().trim(),
    body('dateAdded').optional().isISO8601().toDate(),
    body('interestedParty').optional().isString(),
    body('description').optional().isString(),
    body('riskOfNonCompliance').optional().isString(),
    body('howComplianceAchieved').optional().isString(),
    body('riskIds').optional().isArray(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { riskIds, ...legislationData } = req.body;
      
      const legislation = await prisma.legislation.create({
        data: {
          id: randomUUID(),
          ...legislationData,
          updatedAt: new Date(),
          risks: riskIds && riskIds.length > 0 ? {
            create: riskIds.map((riskId: string) => ({ riskId })),
          } : undefined,
        },
        include: {
          _count: {
            select: { risks: true },
          },
        },
      });

      res.status(201).json(legislation);
    } catch (error: any) {
      console.error('Error creating legislation:', error);
      res.status(500).json({ error: 'Failed to create legislation' });
    }
  }
);

// PUT /api/legislation/:id - update legislation
router.put(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('actRegulationRequirement').optional().notEmpty().trim(),
    body('dateAdded').optional().isISO8601().toDate(),
    body('interestedParty').optional().isString(),
    body('description').optional().isString(),
    body('riskOfNonCompliance').optional().isString(),
    body('howComplianceAchieved').optional().isString(),
    body('riskIds').optional().isArray(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { riskIds, ...updateData } = req.body;
      
      // First update the legislation
      const legislation = await prisma.legislation.update({
        where: { id: req.params.id },
        data: updateData,
      });

      // Then update risk links if provided
      if (riskIds !== undefined) {
        // Delete existing links
        await prisma.legislationRisk.deleteMany({
          where: { legislationId: req.params.id },
        });

        // Create new links
        if (riskIds.length > 0) {
          await prisma.legislationRisk.createMany({
            data: riskIds.map((riskId: string) => ({
              legislationId: req.params.id,
              riskId,
            })),
          });
        }
      }

      // Fetch updated legislation with counts
      const updated = await prisma.legislation.findUnique({
        where: { id: req.params.id },
        include: {
          _count: {
            select: { risks: true },
          },
        },
      });

      res.json(updated);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Legislation not found' });
      }
      console.error('Error updating legislation:', error);
      res.status(500).json({ error: 'Failed to update legislation' });
    }
  }
);

// DELETE /api/legislation/:id - delete legislation
router.delete(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Check if legislation is used by any risks
      const riskCount = await prisma.legislationRisk.count({
        where: { legislationId: req.params.id },
      });

      if (riskCount > 0) {
        return res.status(409).json({
          error: `Cannot delete legislation: it is linked to ${riskCount} risk(s)`,
        });
      }

      await prisma.legislation.delete({
        where: { id: req.params.id },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Legislation not found' });
      }
      console.error('Error deleting legislation:', error);
      res.status(500).json({ error: 'Failed to delete legislation' });
    }
  }
);

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// POST /api/legislation/import - bulk import from CSV
router.post(
  '/import',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  upload.single('file'),
  (err: any, req: AuthRequest, res: Response, next: any) => {
    // Handle multer errors
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
  },
  async (req: AuthRequest, res: Response) => {
    try {
      let result;
      
      if (req.file) {
        // File was uploaded - use the file buffer
        result = await importLegislationFromCSV(req.file.buffer);
      } else if (req.body.filePath) {
        // Legacy support: file path provided in body
        const csvPath = req.body.filePath;
        if (!fs.existsSync(csvPath)) {
          return res.status(400).json({ error: `CSV file not found: ${csvPath}` });
        }
        result = await importLegislationFromCSV(csvPath);
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
      console.error('Error importing legislation:', error);
      res.status(500).json({ error: error.message || 'Failed to import legislation' });
    }
  }
);

export default router;

