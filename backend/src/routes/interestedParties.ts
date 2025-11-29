import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import multer from 'multer';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
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

      // Add createdBy and updatedBy info if available (from User relation if added later)
      const partiesWithAudit = interestedParties.map(party => ({
        ...party,
        // createdAt and updatedAt are already included from the model
      }));

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
    body('dateAdded').optional().isISO8601().toDate(),
    body('requirements').optional().isString(),
    body('addressedThroughISMS').optional().isBoolean(),
    body('howAddressedThroughISMS').optional().isString(),
    body('sourceLink').optional().isString(),
    body('keyProductsServices').optional().isString(),
    body('ourObligations').optional().isString(),
    body('theirObligations').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Build data object, excluding undefined values
      const data: any = {
        id: randomUUID(),
        name: req.body.name,
        updatedAt: new Date(),
        // Auto-populate dateAdded with current date if not provided
        dateAdded: req.body.dateAdded ? new Date(req.body.dateAdded) : new Date(),
      };

      if (req.body.group !== undefined) data.group = req.body.group || null;
      if (req.body.description !== undefined) data.description = req.body.description || null;
      if (req.body.requirements !== undefined) data.requirements = req.body.requirements || null;
      // Always set boolean explicitly, even if false
      data.addressedThroughISMS = req.body.addressedThroughISMS === true || req.body.addressedThroughISMS === 'true';
      if (req.body.howAddressedThroughISMS !== undefined) data.howAddressedThroughISMS = req.body.howAddressedThroughISMS || null;
      if (req.body.sourceLink !== undefined) data.sourceLink = req.body.sourceLink || null;
      if (req.body.keyProductsServices !== undefined) data.keyProductsServices = req.body.keyProductsServices || null;
      if (req.body.ourObligations !== undefined) data.ourObligations = req.body.ourObligations || null;
      if (req.body.theirObligations !== undefined) data.theirObligations = req.body.theirObligations || null;

      const interestedParty = await prisma.interestedParty.create({
        data,
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
    body('dateAdded').optional().isISO8601().toDate(),
    body('requirements').optional().isString(),
    body('addressedThroughISMS').optional().isBoolean(),
    body('howAddressedThroughISMS').optional().isString(),
    body('sourceLink').optional().isString(),
    body('keyProductsServices').optional().isString(),
    body('ourObligations').optional().isString(),
    body('theirObligations').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const updateData: any = {
        updatedAt: new Date(),
      };
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.group !== undefined) updateData.group = req.body.group || null;
      if (req.body.description !== undefined) updateData.description = req.body.description || null;
      if (req.body.dateAdded !== undefined) updateData.dateAdded = req.body.dateAdded ? new Date(req.body.dateAdded) : null;
      if (req.body.requirements !== undefined) updateData.requirements = req.body.requirements || null;
      // Always set boolean explicitly, even if false
      if (req.body.addressedThroughISMS !== undefined) {
        updateData.addressedThroughISMS = req.body.addressedThroughISMS === true || req.body.addressedThroughISMS === 'true';
      }
      if (req.body.howAddressedThroughISMS !== undefined) updateData.howAddressedThroughISMS = req.body.howAddressedThroughISMS || null;
      if (req.body.sourceLink !== undefined) updateData.sourceLink = req.body.sourceLink || null;
      if (req.body.keyProductsServices !== undefined) updateData.keyProductsServices = req.body.keyProductsServices || null;
      if (req.body.ourObligations !== undefined) updateData.ourObligations = req.body.ourObligations || null;
      if (req.body.theirObligations !== undefined) updateData.theirObligations = req.body.theirObligations || null;

      const interestedParty = await prisma.interestedParty.update({
        where: { id: req.params.id },
        data: updateData,
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

