import { Router, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import {
  shouldCreateReviewTask,
  createReviewTaskForSupplier,
} from '../services/supplierReviewScheduler';
import {
  findCertificatesExpiringSoon,
  createCertificateExpiryTask,
} from '../services/supplierCertificateService';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// POST /api/suppliers/scheduler/create-review-tasks - Creates review tasks for suppliers due for review
router.post(
  '/scheduler/create-review-tasks',
  authenticateToken,
  requireRole('ADMIN'),
  [
    query('thresholdDays').optional().isInt({ min: 1, max: 365 }),
    query('dryRun').optional().isBoolean(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const thresholdDays = parseInt(req.query.thresholdDays as string) || 30;
      const dryRun = req.query.dryRun === 'true';

      const now = new Date();
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + thresholdDays);

      // Find suppliers with nextReviewAt within threshold and no open review task
      const suppliers = await prisma.supplier.findMany({
        where: {
          nextReviewAt: {
            lte: thresholdDate,
            gte: now,
          },
          lifecycleState: {
            in: ['APPROVED', 'IN_REVIEW'],
          },
        },
        select: {
          id: true,
          name: true,
          criticality: true,
          lastReviewAt: true,
          nextReviewAt: true,
          relationshipOwnerUserId: true,
          lifecycleState: true,
        },
      });

      const results = {
        created: 0,
        skipped: 0,
        errors: [] as Array<{ supplierId: string; error: string }>,
      };

      for (const supplier of suppliers) {
        try {
          const shouldCreate = await shouldCreateReviewTask(supplier, thresholdDays);

          if (!shouldCreate) {
            results.skipped++;
            continue;
          }

          if (!dryRun) {
            const task = await createReviewTaskForSupplier(supplier);
            if (task) {
              results.created++;
            } else {
              results.skipped++;
            }
          } else {
            results.created++; // Count as would-create in dry run
          }
        } catch (error: any) {
          results.errors.push({
            supplierId: supplier.id,
            error: error.message || 'Unknown error',
          });
        }
      }

      res.json({
        ...results,
        dryRun,
        thresholdDays,
        suppliersChecked: suppliers.length,
      });
    } catch (error: any) {
      console.error('Error creating review tasks:', error);
      res.status(500).json({ error: 'Failed to create review tasks' });
    }
  }
);

// POST /api/suppliers/scheduler/create-certificate-tasks - Creates tasks for expiring certificates
router.post(
  '/scheduler/create-certificate-tasks',
  authenticateToken,
  requireRole('ADMIN'),
  [
    query('daysBeforeExpiry').optional().isInt({ min: 1, max: 365 }),
    query('dryRun').optional().isBoolean(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const daysBeforeExpiry = parseInt(req.query.daysBeforeExpiry as string) || 30;
      const dryRun = req.query.dryRun === 'true';

      const certificates = await findCertificatesExpiringSoon(daysBeforeExpiry);

      const results = {
        created: 0,
        skipped: 0,
        errors: [] as Array<{ certificateId: string; error: string }>,
      };

      for (const cert of certificates) {
        try {
          if (!dryRun) {
            const task = await createCertificateExpiryTask(cert.supplier, cert);
            if (task) {
              results.created++;
            } else {
              results.skipped++;
            }
          } else {
            results.created++; // Count as would-create in dry run
          }
        } catch (error: any) {
          results.errors.push({
            certificateId: cert.id,
            error: error.message || 'Unknown error',
          });
        }
      }

      res.json({
        ...results,
        dryRun,
        daysBeforeExpiry,
        certificatesChecked: certificates.length,
      });
    } catch (error: any) {
      console.error('Error creating certificate expiry tasks:', error);
      res.status(500).json({ error: 'Failed to create certificate expiry tasks' });
    }
  }
);

export default router;


