/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { generateSoAData, generateSoAExcel } from '../services/soaService';
import { updateControlApplicability } from '../services/riskService';

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
      console.log('[SOA] Generating SoA data...');
      const soaData = await generateSoAData();
      console.log(`[SOA] Generated ${soaData.length} SoA rows`);

      if (format === 'EXCEL') {
        // Generate Excel file
        console.log('[SOA] Generating Excel file...');
        const excelBuffer = await generateSoAExcel(soaData);
        // Ensure buffer is a proper Buffer instance
        const buffer = Buffer.isBuffer(excelBuffer) ? excelBuffer : Buffer.from(excelBuffer as any);
        const bufferSize = buffer.length;
        console.log(`[SOA] Excel buffer generated, size: ${bufferSize} bytes`);

        // Create SoAExport record for audit trail (don't await - do in background)
        prisma.soAExport.create({
          data: {
            id: randomUUID(),
            generatedByUserId: user.id,
            exportFormat: 'EXCEL',
            filePath: null, // File is returned directly, not stored
          },
        }).catch((err: unknown) => {
          console.error('[SOA] Error creating export record:', err);
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
        res.setHeader('Content-Length', buffer.length.toString());

        return res.send(buffer);
      } else {
        // PDF export - for now, return error as it's optional
        // In the future, this could use a library like pdfkit or puppeteer
        return res.status(501).json({
          error: 'PDF export not yet implemented. Please use EXCEL format.',
        });
      }
    } catch (error: any) {
      console.error('[SOA] Error generating SoA export:', error);
      console.error('[SOA] Error stack:', error.stack);
      console.error('[SOA] Error details:', {
        message: error.message,
        name: error.name,
        code: error.code,
      });
      res.status(500).json({ 
        error: 'Failed to generate SoA export',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
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
          User: {
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

      // Transform response to use generatedBy instead of User
      const transformedExports = exports.map((exportItem) => ({
        id: exportItem.id,
        generatedAt: exportItem.generatedAt,
        exportFormat: exportItem.exportFormat,
        filePath: exportItem.filePath,
        generatedBy: exportItem.User ? {
          id: exportItem.User.id,
          displayName: exportItem.User.displayName,
          email: exportItem.User.email,
        } : null,
      }));

      res.json(transformedExports);
    } catch (error) {
      console.error('Error fetching SoA exports:', error);
      res.status(500).json({ error: 'Failed to fetch SoA exports' });
    }
  }
);

// POST /api/soa/update-control-applicability - update control applicability flags based on Risk-Control linkages
router.post(
  '/update-control-applicability',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      // Get statistics before update
      const beforeStats = {
        total: await prisma.control.count(),
        selected: await prisma.control.count({
          where: { selectedForRiskAssessment: true },
        }),
        notSelected: await prisma.control.count({
          where: { selectedForRiskAssessment: false },
        }),
      };

      // Update control applicability
      await updateControlApplicability();

      // Get statistics after update
      const afterStats = {
        total: await prisma.control.count(),
        selected: await prisma.control.count({
          where: { selectedForRiskAssessment: true },
        }),
        notSelected: await prisma.control.count({
          where: { selectedForRiskAssessment: false },
        }),
      };

      const changed = Math.abs(afterStats.selected - beforeStats.selected);

      res.json({
        success: true,
        message: changed > 0
          ? `Updated ${changed} control${changed === 1 ? '' : 's'}`
          : 'All controls already have correct status',
        before: beforeStats,
        after: afterStats,
        changed,
      });
    } catch (error: any) {
      console.error('[SOA] Error updating control applicability:', error);
      res.status(500).json({
        error: 'Failed to update control applicability',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

export { router as soaRouter };





