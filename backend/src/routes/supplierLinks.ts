/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { findRelevantRisksForSupplier } from '../services/supplierRiskSuggestionService';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/suppliers/:id/risks - List linked risks
router.get(
  '/:id/risks',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const links = await prisma.supplierRiskLink.findMany({
        where: { supplierId: req.params.id },
        include: {
          risk: {
            select: {
              id: true,
              title: true,
              calculatedScore: true,
              status: true,
              riskCategory: true,
            },
          },
        },
      });

      res.json(links.map((link) => link.risk));
    } catch (error) {
      console.error('Error fetching supplier risks:', error);
      res.status(500).json({ error: 'Failed to fetch supplier risks' });
    }
  }
);

// POST /api/suppliers/:id/risks - Link a risk to supplier
router.post(
  '/:id/risks',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('riskId').isUUID(),
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

      // Verify risk exists
      const risk = await prisma.risk.findUnique({
        where: { id: req.body.riskId },
      });

      if (!risk) {
        return res.status(404).json({ error: 'Risk not found' });
      }

      // Check if link already exists
      const existingLink = await prisma.supplierRiskLink.findUnique({
        where: {
          supplierId_riskId: {
            supplierId: req.params.id,
            riskId: req.body.riskId,
          },
        },
      });

      if (existingLink) {
        return res.status(400).json({ error: 'Risk is already linked to this supplier' });
      }

      // Create link
      await prisma.supplierRiskLink.create({
        data: {
          supplierId: req.params.id,
          riskId: req.body.riskId,
        },
      });

      // Optionally mark risk as supplier risk
      if (!risk.isSupplierRisk) {
        await prisma.risk.update({
          where: { id: req.body.riskId },
          data: { isSupplierRisk: true },
        });
      }

      // Return the linked risk
      const linkedRisk = await prisma.risk.findUnique({
        where: { id: req.body.riskId },
        select: {
          id: true,
          title: true,
          calculatedScore: true,
          status: true,
          riskCategory: true,
        },
      });

      res.status(201).json(linkedRisk);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Risk is already linked to this supplier' });
      }
      console.error('Error linking risk to supplier:', error);
      res.status(500).json({ error: 'Failed to link risk to supplier' });
    }
  }
);

// DELETE /api/suppliers/:id/risks/:riskId - Unlink risk
router.delete(
  '/:id/risks/:riskId',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID(), param('riskId').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.supplierRiskLink.delete({
        where: {
          supplierId_riskId: {
            supplierId: req.params.id,
            riskId: req.params.riskId,
          },
        },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Link not found' });
      }
      console.error('Error unlinking risk from supplier:', error);
      res.status(500).json({ error: 'Failed to unlink risk from supplier' });
    }
  }
);

// GET /api/suppliers/:id/controls - List linked controls
router.get(
  '/:id/controls',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const links = await prisma.supplierControlLink.findMany({
        where: { supplierId: req.params.id },
        include: {
          control: {
            select: {
              id: true,
              code: true,
              title: true,
              implemented: true,
              category: true,
            },
          },
        },
      });

      res.json(links.map((link) => link.control));
    } catch (error) {
      console.error('Error fetching supplier controls:', error);
      res.status(500).json({ error: 'Failed to fetch supplier controls' });
    }
  }
);

// POST /api/suppliers/:id/controls - Link a control to supplier
router.post(
  '/:id/controls',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('controlId').isUUID(),
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

      // Verify control exists
      const control = await prisma.control.findUnique({
        where: { id: req.body.controlId },
      });

      if (!control) {
        return res.status(404).json({ error: 'Control not found' });
      }

      // Check if link already exists
      const existingLink = await prisma.supplierControlLink.findUnique({
        where: {
          supplierId_controlId: {
            supplierId: req.params.id,
            controlId: req.body.controlId,
          },
        },
      });

      if (existingLink) {
        return res.status(400).json({ error: 'Control is already linked to this supplier' });
      }

      // Create link
      await prisma.supplierControlLink.create({
        data: {
          supplierId: req.params.id,
          controlId: req.body.controlId,
        },
      });

      // Return the linked control
      const linkedControl = await prisma.control.findUnique({
        where: { id: req.body.controlId },
        select: {
          id: true,
          code: true,
          title: true,
          implemented: true,
          category: true,
        },
      });

      res.status(201).json(linkedControl);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Control is already linked to this supplier' });
      }
      console.error('Error linking control to supplier:', error);
      res.status(500).json({ error: 'Failed to link control to supplier' });
    }
  }
);

// DELETE /api/suppliers/:id/controls/:controlId - Unlink control
router.delete(
  '/:id/controls/:controlId',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID(), param('controlId').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.supplierControlLink.delete({
        where: {
          supplierId_controlId: {
            supplierId: req.params.id,
            controlId: req.params.controlId,
          },
        },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Link not found' });
      }
      console.error('Error unlinking control from supplier:', error);
      res.status(500).json({ error: 'Failed to unlink control from supplier' });
    }
  }
);

// POST /api/suppliers/:id/suggest-risks - Get AI-powered risk suggestions for a supplier
router.post(
  '/:id/suggest-risks',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 20 }),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const supplierId = req.params.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;

      // Verify supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true },
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      // Get AI-powered risk suggestions
      const suggestions = await findRelevantRisksForSupplier(supplierId, limit);

      res.json({
        suggestions: suggestions.map((suggestion) => ({
          risk: suggestion.risk,
          similarityScore: suggestion.similarityScore,
          matchedFields: suggestion.matchedFields,
        })),
      });
    } catch (error: any) {
      console.error('Error getting risk suggestions:', error);
      res.status(500).json({ error: error.message || 'Failed to get risk suggestions' });
    }
  }
);

// POST /api/suppliers/:id/suggest-risks - Get AI-powered risk suggestions for a supplier
router.post(
  '/:id/suggest-risks',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 20 }),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const supplierId = req.params.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;

      // Verify supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true },
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      // Get AI-powered risk suggestions
      const suggestions = await findRelevantRisksForSupplier(supplierId, limit);

      res.json({
        suggestions: suggestions.map((suggestion) => ({
          risk: suggestion.risk,
          similarityScore: suggestion.similarityScore,
          matchedFields: suggestion.matchedFields,
        })),
      });
    } catch (error: any) {
      console.error('Error getting risk suggestions:', error);
      res.status(500).json({ error: error.message || 'Failed to get risk suggestions' });
    }
  }
);

export default router;

