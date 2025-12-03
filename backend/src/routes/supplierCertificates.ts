import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { CertificateType } from '../types/enums';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/suppliers/:id/certificates - List all certificates
router.get(
  '/:id/certificates',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const certificates = await prisma.supplierCertificate.findMany({
        where: { supplierId: req.params.id },
        orderBy: { expiryDate: 'asc' },
      });

      res.json(certificates);
    } catch (error) {
      console.error('Error fetching certificates:', error);
      res.status(500).json({ error: 'Failed to fetch certificates' });
    }
  }
);

// POST /api/suppliers/:id/certificates - Add certificate
router.post(
  '/:id/certificates',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('certificateType').isIn(['PCI', 'ISO27001', 'ISO22301', 'ISO9001', 'GDPR', 'OTHER']),
    body('expiryDate').isISO8601().toDate(),
    body('certificateNumber').optional().isString(),
    body('issuer').optional().isString(),
    body('issueDate').optional().isISO8601().toDate(),
    body('evidenceLink').optional().isString(),
    body('notes').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.id },
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      const certificate = await prisma.supplierCertificate.create({
        data: {
          id: randomUUID(),
          supplierId: req.params.id,
          certificateType: req.body.certificateType,
          expiryDate: new Date(req.body.expiryDate),
          certificateNumber: req.body.certificateNumber || null,
          issuer: req.body.issuer || null,
          issueDate: req.body.issueDate ? new Date(req.body.issueDate) : null,
          evidenceLink: req.body.evidenceLink || null,
          notes: req.body.notes || null,
        },
      });

      res.status(201).json(certificate);
    } catch (error: any) {
      console.error('Error creating certificate:', error);
      res.status(500).json({ error: 'Failed to create certificate' });
    }
  }
);

// PUT /api/suppliers/:id/certificates/:certificateId - Update certificate
router.put(
  '/:id/certificates/:certificateId',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    param('certificateId').isUUID(),
    body('certificateType').optional().isIn(['PCI', 'ISO27001', 'ISO22301', 'ISO9001', 'GDPR', 'OTHER']),
    body('expiryDate').optional().isISO8601().toDate(),
    body('certificateNumber').optional().isString(),
    body('issuer').optional().isString(),
    body('issueDate').optional().isISO8601().toDate(),
    body('evidenceLink').optional().isString(),
    body('notes').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const certificate = await prisma.supplierCertificate.findUnique({
        where: { id: req.params.certificateId },
      });

      if (!certificate || certificate.supplierId !== req.params.id) {
        return res.status(404).json({ error: 'Certificate not found' });
      }

      const updateData: any = {};
      if (req.body.certificateType !== undefined) updateData.certificateType = req.body.certificateType;
      if (req.body.expiryDate !== undefined) updateData.expiryDate = new Date(req.body.expiryDate);
      if (req.body.certificateNumber !== undefined) updateData.certificateNumber = req.body.certificateNumber || null;
      if (req.body.issuer !== undefined) updateData.issuer = req.body.issuer || null;
      if (req.body.issueDate !== undefined) updateData.issueDate = req.body.issueDate ? new Date(req.body.issueDate) : null;
      if (req.body.evidenceLink !== undefined) updateData.evidenceLink = req.body.evidenceLink || null;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes || null;

      const updated = await prisma.supplierCertificate.update({
        where: { id: req.params.certificateId },
        data: updateData,
      });

      res.json(updated);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Certificate not found' });
      }
      console.error('Error updating certificate:', error);
      res.status(500).json({ error: 'Failed to update certificate' });
    }
  }
);

// DELETE /api/suppliers/:id/certificates/:certificateId - Delete certificate
router.delete(
  '/:id/certificates/:certificateId',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID(), param('certificateId').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const certificate = await prisma.supplierCertificate.findUnique({
        where: { id: req.params.certificateId },
      });

      if (!certificate || certificate.supplierId !== req.params.id) {
        return res.status(404).json({ error: 'Certificate not found' });
      }

      await prisma.supplierCertificate.delete({
        where: { id: req.params.certificateId },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Certificate not found' });
      }
      console.error('Error deleting certificate:', error);
      res.status(500).json({ error: 'Failed to delete certificate' });
    }
  }
);

// GET /api/suppliers/certificates/expiring - List certificates expiring soon
router.get(
  '/certificates/expiring',
  authenticateToken,
  [query('daysBeforeExpiry').optional().isInt({ min: 1, max: 365 })],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const daysBeforeExpiry = parseInt(req.query.daysBeforeExpiry as string) || 30;
      const now = new Date();
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + daysBeforeExpiry);

      const certificates = await prisma.supplierCertificate.findMany({
        where: {
          expiryDate: {
            gte: now,
            lte: thresholdDate,
          },
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          expiryDate: 'asc',
        },
      });

      res.json(certificates);
    } catch (error) {
      console.error('Error fetching expiring certificates:', error);
      res.status(500).json({ error: 'Failed to fetch expiring certificates' });
    }
  }
);

export default router;

