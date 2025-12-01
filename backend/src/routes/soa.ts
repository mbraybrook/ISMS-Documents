import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { generateSoAData, generateSoAExcel } from '../services/soaService';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// POST /api/soa/export - generate and return SoA file
router.post(
  '/export',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('format').optional().isIn(['EXCEL', 'PDF']),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { email: req.user.email || '' },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const format = (req.body.format || 'EXCEL') as 'EXCEL' | 'PDF';

      // Generate SoA data
      const soaData = await generateSoAData();

      if (format === 'EXCEL') {
        // Generate Excel file
        const excelBuffer = await generateSoAExcel(soaData);

        // Create SoAExport record for audit trail
        await prisma.soAExport.create({
          data: {
            generatedByUserId: user.id,
            exportFormat: 'EXCEL',
            filePath: null, // File is returned directly, not stored
          },
        });

        // Set response headers for Excel download
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="SoA_${new Date().toISOString().split('T')[0]}.xlsx"`
        );

        return res.send(excelBuffer);
      } else {
        // PDF export - for now, return error as it's optional
        // In the future, this could use a library like pdfkit or puppeteer
        return res.status(501).json({
          error: 'PDF export not yet implemented. Please use EXCEL format.',
        });
      }
    } catch (error) {
      console.error('Error generating SoA export:', error);
      res.status(500).json({ error: 'Failed to generate SoA export' });
    }
  }
);

// GET /api/soa/exports - list previous exports (optional)
router.get(
  '/exports',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const exports = await prisma.soAExport.findMany({
        include: {
          generatedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: {
          generatedAt: 'desc',
        },
        take: 50,
      });

      res.json(exports);
    } catch (error) {
      console.error('Error fetching SoA exports:', error);
      res.status(500).json({ error: 'Failed to fetch SoA exports' });
    }
  }
);

export { router as soaRouter };



