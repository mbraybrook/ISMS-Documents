import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import multer from 'multer';
import * as fs from 'fs';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { importInterestedPartiesFromCSV } from '../services/interestedPartyImportService';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/interested-parties - list all interested parties with risk counts
router.get(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const interestedParties = await prisma.interestedParty.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { risks: true },
          },
        },
      });

      res.json(interestedParties);
    } catch (error) {
      console.error('Error fetching interested parties:', error);
      res.status(500).json({ error: 'Failed to fetch interested parties' });
    }
  }
);

// GET /api/interested-parties/:id - get interested party details with linked risks
router.get(
  '/:id',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const interestedParty = await prisma.interestedParty.findUnique({
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

      if (!interestedParty) {
        return res.status(404).json({ error: 'Interested party not found' });
      }

      res.json(interestedParty);
    } catch (error) {
      console.error('Error fetching interested party:', error);
      res.status(500).json({ error: 'Failed to fetch interested party' });
    }
  }
);

// POST /api/interested-parties - create interested party
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('name').notEmpty().trim(),
    body('group').optional().isString(),
    body('description').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const interestedParty = await prisma.interestedParty.create({
        data: {
          name: req.body.name,
          group: req.body.group,
          description: req.body.description,
        },
      });

      res.status(201).json(interestedParty);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Interested party name already exists' });
      }
      console.error('Error creating interested party:', error);
      res.status(500).json({ error: 'Failed to create interested party' });
    }
  }
);

// PUT /api/interested-parties/:id - update interested party
router.put(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('name').optional().notEmpty().trim(),
    body('group').optional().isString(),
    body('description').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const interestedParty = await prisma.interestedParty.update({
        where: { id: req.params.id },
        data: {
          ...(req.body.name && { name: req.body.name }),
          ...(req.body.group !== undefined && { group: req.body.group }),
          ...(req.body.description !== undefined && { description: req.body.description }),
        },
      });

      res.json(interestedParty);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Interested party not found' });
      }
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Interested party name already exists' });
      }
      console.error('Error updating interested party:', error);
      res.status(500).json({ error: 'Failed to update interested party' });
    }
  }
);

// DELETE /api/interested-parties/:id - delete interested party
router.delete(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Check if interested party is used by any risks
      const riskCount = await prisma.risk.count({
        where: { interestedPartyId: req.params.id },
      });

      if (riskCount > 0) {
        return res.status(409).json({
          error: `Cannot delete interested party: it is used by ${riskCount} risk(s)`,
        });
      }

      await prisma.interestedParty.delete({
        where: { id: req.params.id },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Interested party not found' });
      }
      console.error('Error deleting interested party:', error);
      res.status(500).json({ error: 'Failed to delete interested party' });
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

// POST /api/interested-parties/import - bulk import from CSV
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
        result = await importInterestedPartiesFromCSV(req.file.buffer);
      } else if (req.body.filePath) {
        // Legacy support: file path provided in body
        const csvPath = req.body.filePath;
        if (!fs.existsSync(csvPath)) {
          return res.status(400).json({ error: `CSV file not found: ${csvPath}` });
        }
        result = await importInterestedPartiesFromCSV(csvPath);
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
      console.error('Error importing interested parties:', error);
      res.status(500).json({ error: error.message || 'Failed to import interested parties' });
    }
  }
);

export default router;

