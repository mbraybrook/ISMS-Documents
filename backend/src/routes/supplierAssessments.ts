import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import {
  CiaImpact,
  SupplierType,
  RiskRating,
  Criticality,
  AssessmentStatus,
} from '../types/enums';
import {
  validateLifecycleTransition,
  determineNextState,
  requiresCisoApproval,
  canApproveSupplier,
} from '../services/supplierLifecycleService';
import {
  validatePciApprovalRule,
  getApprovalRequirements,
} from '../services/supplierApprovalService';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Helper to update supplier snapshot fields when assessment is approved
async function updateSupplierSnapshotOnApproval(
  supplierId: string,
  assessmentType: 'RISK' | 'CRITICALITY',
  assessment: any
) {
  const updateData: any = {};

  if (assessmentType === 'RISK') {
    updateData.ciaImpact = assessment.ciaImpact;
    updateData.overallRiskRating = assessment.riskRating;
    updateData.riskRationale = assessment.rationale;
    updateData.lastRiskAssessmentAt = assessment.approvedAt;
    updateData.currentRiskAssessmentId = assessment.id;
  } else {
    updateData.criticality = assessment.criticality;
    updateData.criticalityRationale = assessment.rationale;
    updateData.lastCriticalityAssessmentAt = assessment.approvedAt;
    updateData.currentCriticalityAssessmentId = assessment.id;
  }

  await prisma.supplier.update({
    where: { id: supplierId },
    data: updateData,
  });
}

// ==================== Risk Assessment Routes ====================

// POST /api/suppliers/:supplierId/risk-assessments - Create risk assessment
router.post(
  '/:supplierId/risk-assessments',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('supplierId').isUUID(),
    body('ciaImpact').isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('supplierType').isIn(['SERVICE_PROVIDER', 'CONNECTED_ENTITY', 'PCI_SERVICE_PROVIDER']),
    body('riskRating').isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('rationale').optional().isString(),
    body('status').optional().isIn(['DRAFT', 'SUBMITTED']),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      // Verify supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.supplierId },
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      const assessment = await prisma.supplierRiskAssessment.create({
        data: {
          id: randomUUID(),
          supplierId: req.params.supplierId,
          ciaImpact: req.body.ciaImpact,
          supplierType: req.body.supplierType,
          riskRating: req.body.riskRating,
          rationale: req.body.rationale || null,
          assessedByUserId: user.id,
          status: req.body.status || 'DRAFT',
        },
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Auto-update lifecycle state if needed
      const nextState = await determineNextState({
        ...supplier,
        riskAssessments: [{ id: assessment.id, status: assessment.status }],
        criticalityAssessments: [],
      });

      if (nextState && nextState !== supplier.lifecycleState) {
        await prisma.supplier.update({
          where: { id: supplier.id },
          data: { lifecycleState: nextState },
        });
      }

      res.status(201).json(assessment);
    } catch (error: any) {
      console.error('Error creating risk assessment:', error);
      res.status(500).json({ error: 'Failed to create risk assessment' });
    }
  }
);

// GET /api/suppliers/:supplierId/risk-assessments - List all risk assessments
router.get(
  '/:supplierId/risk-assessments',
  authenticateToken,
  [param('supplierId').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const assessments = await prisma.supplierRiskAssessment.findMany({
        where: { supplierId: req.params.supplierId },
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(assessments);
    } catch (error) {
      console.error('Error fetching risk assessments:', error);
      res.status(500).json({ error: 'Failed to fetch risk assessments' });
    }
  }
);

// GET /api/suppliers/:supplierId/risk-assessments/:id - Get risk assessment details
router.get(
  '/:supplierId/risk-assessments/:id',
  authenticateToken,
  [param('supplierId').isUUID(), param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const assessment = await prisma.supplierRiskAssessment.findUnique({
        where: { id: req.params.id },
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      if (!assessment || assessment.supplierId !== req.params.supplierId) {
        return res.status(404).json({ error: 'Risk assessment not found' });
      }

      res.json(assessment);
    } catch (error) {
      console.error('Error fetching risk assessment:', error);
      res.status(500).json({ error: 'Failed to fetch risk assessment' });
    }
  }
);

// PUT /api/suppliers/:supplierId/risk-assessments/:id - Update risk assessment
router.put(
  '/:supplierId/risk-assessments/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('supplierId').isUUID(),
    param('id').isUUID(),
    body('ciaImpact').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('supplierType').optional().isIn(['SERVICE_PROVIDER', 'CONNECTED_ENTITY', 'PCI_SERVICE_PROVIDER']),
    body('riskRating').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('rationale').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const assessment = await prisma.supplierRiskAssessment.findUnique({
        where: { id: req.params.id },
      });

      if (!assessment || assessment.supplierId !== req.params.supplierId) {
        return res.status(404).json({ error: 'Risk assessment not found' });
      }

      if (assessment.status !== 'DRAFT') {
        return res.status(400).json({ error: 'Can only update assessments in DRAFT status' });
      }

      const updateData: any = {};
      if (req.body.ciaImpact !== undefined) updateData.ciaImpact = req.body.ciaImpact;
      if (req.body.supplierType !== undefined) updateData.supplierType = req.body.supplierType;
      if (req.body.riskRating !== undefined) updateData.riskRating = req.body.riskRating;
      if (req.body.rationale !== undefined) updateData.rationale = req.body.rationale || null;

      const updated = await prisma.supplierRiskAssessment.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      res.json(updated);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Risk assessment not found' });
      }
      console.error('Error updating risk assessment:', error);
      res.status(500).json({ error: 'Failed to update risk assessment' });
    }
  }
);

// POST /api/suppliers/:supplierId/risk-assessments/:id/submit - Submit for approval
router.post(
  '/:supplierId/risk-assessments/:id/submit',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('supplierId').isUUID(), param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const assessment = await prisma.supplierRiskAssessment.findUnique({
        where: { id: req.params.id },
        include: {
          supplier: true,
        },
      });

      if (!assessment || assessment.supplierId !== req.params.supplierId) {
        return res.status(404).json({ error: 'Risk assessment not found' });
      }

      if (assessment.status !== 'DRAFT') {
        return res.status(400).json({ error: 'Can only submit assessments in DRAFT status' });
      }

      const updated = await prisma.supplierRiskAssessment.update({
        where: { id: req.params.id },
        data: {
          status: 'SUBMITTED',
        },
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Auto-update lifecycle state
      const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.supplierId },
        include: {
          riskAssessments: {
            select: { id: true, status: true },
            orderBy: { createdAt: 'desc' },
          },
          criticalityAssessments: {
            select: { id: true, status: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (supplier) {
        const nextState = await determineNextState(supplier);
        if (nextState && nextState !== supplier.lifecycleState) {
          await prisma.supplier.update({
            where: { id: supplier.id },
            data: { lifecycleState: nextState },
          });
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error submitting risk assessment:', error);
      res.status(500).json({ error: 'Failed to submit risk assessment' });
    }
  }
);

// POST /api/suppliers/:supplierId/risk-assessments/:id/approve - Approve assessment
router.post(
  '/:supplierId/risk-assessments/:id/approve',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('supplierId').isUUID(), param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      const assessment = await prisma.supplierRiskAssessment.findUnique({
        where: { id: req.params.id },
        include: {
          supplier: true,
        },
      });

      if (!assessment || assessment.supplierId !== req.params.supplierId) {
        return res.status(404).json({ error: 'Risk assessment not found' });
      }

      if (assessment.status !== 'SUBMITTED') {
        return res.status(400).json({ error: 'Can only approve assessments in SUBMITTED status' });
      }

      // Check if CISO approval is required
      const needsCiso = requiresCisoApproval(
        assessment.supplier,
        'RISK',
        null
      );

      if (needsCiso && user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'CISO approval required. Only ADMIN users can approve this assessment.',
        });
      }

      const updated = await prisma.supplierRiskAssessment.update({
        where: { id: req.params.id },
        data: {
          status: 'APPROVED',
          approvedByUserId: user.id,
          approvedAt: new Date(),
        },
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Update supplier snapshot fields
      await updateSupplierSnapshotOnApproval(req.params.supplierId, 'RISK', updated);

      // Auto-update lifecycle state
      const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.supplierId },
        include: {
          riskAssessments: {
            select: { id: true, status: true },
            orderBy: { createdAt: 'desc' },
          },
          criticalityAssessments: {
            select: { id: true, status: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (supplier) {
        const nextState = await determineNextState(supplier);
        if (nextState && nextState !== supplier.lifecycleState) {
          await prisma.supplier.update({
            where: { id: supplier.id },
            data: { lifecycleState: nextState },
          });
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error approving risk assessment:', error);
      res.status(500).json({ error: 'Failed to approve risk assessment' });
    }
  }
);

// POST /api/suppliers/:supplierId/risk-assessments/:id/reject - Reject assessment
router.post(
  '/:supplierId/risk-assessments/:id/reject',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('supplierId').isUUID(),
    param('id').isUUID(),
    body('rejectionReason').notEmpty().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const assessment = await prisma.supplierRiskAssessment.findUnique({
        where: { id: req.params.id },
        include: {
          supplier: true,
        },
      });

      if (!assessment || assessment.supplierId !== req.params.supplierId) {
        return res.status(404).json({ error: 'Risk assessment not found' });
      }

      if (assessment.status !== 'SUBMITTED') {
        return res.status(400).json({ error: 'Can only reject assessments in SUBMITTED status' });
      }

      const updated = await prisma.supplierRiskAssessment.update({
        where: { id: req.params.id },
        data: {
          status: 'REJECTED',
          rejectionReason: req.body.rejectionReason,
        },
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Auto-update lifecycle state to REJECTED
      await prisma.supplier.update({
        where: { id: req.params.supplierId },
        data: { lifecycleState: 'REJECTED' },
      });

      res.json(updated);
    } catch (error: any) {
      console.error('Error rejecting risk assessment:', error);
      res.status(500).json({ error: 'Failed to reject risk assessment' });
    }
  }
);

// ==================== Criticality Assessment Routes ====================

// POST /api/suppliers/:supplierId/criticality-assessments - Create criticality assessment
router.post(
  '/:supplierId/criticality-assessments',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('supplierId').isUUID(),
    body('criticality').isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('rationale').optional().isString(),
    body('status').optional().isIn(['DRAFT', 'SUBMITTED']),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.supplierId },
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      const assessment = await prisma.supplierCriticalityAssessment.create({
        data: {
          id: randomUUID(),
          supplierId: req.params.supplierId,
          criticality: req.body.criticality,
          rationale: req.body.rationale || null,
          assessedByUserId: user.id,
          status: req.body.status || 'DRAFT',
        },
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Auto-update lifecycle state
      const nextState = await determineNextState({
        ...supplier,
        riskAssessments: [],
        criticalityAssessments: [{ id: assessment.id, status: assessment.status }],
      });

      if (nextState && nextState !== supplier.lifecycleState) {
        await prisma.supplier.update({
          where: { id: supplier.id },
          data: { lifecycleState: nextState },
        });
      }

      res.status(201).json(assessment);
    } catch (error: any) {
      console.error('Error creating criticality assessment:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
        body: req.body,
      });
      res.status(500).json({ 
        error: 'Failed to create criticality assessment',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

// GET /api/suppliers/:supplierId/criticality-assessments - List all criticality assessments
router.get(
  '/:supplierId/criticality-assessments',
  authenticateToken,
  [param('supplierId').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const assessments = await prisma.supplierCriticalityAssessment.findMany({
        where: { supplierId: req.params.supplierId },
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(assessments);
    } catch (error) {
      console.error('Error fetching criticality assessments:', error);
      res.status(500).json({ error: 'Failed to fetch criticality assessments' });
    }
  }
);

// GET /api/suppliers/:supplierId/criticality-assessments/:id - Get criticality assessment details
router.get(
  '/:supplierId/criticality-assessments/:id',
  authenticateToken,
  [param('supplierId').isUUID(), param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const assessment = await prisma.supplierCriticalityAssessment.findUnique({
        where: { id: req.params.id },
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      if (!assessment || assessment.supplierId !== req.params.supplierId) {
        return res.status(404).json({ error: 'Criticality assessment not found' });
      }

      res.json(assessment);
    } catch (error) {
      console.error('Error fetching criticality assessment:', error);
      res.status(500).json({ error: 'Failed to fetch criticality assessment' });
    }
  }
);

// PUT /api/suppliers/:supplierId/criticality-assessments/:id - Update criticality assessment
router.put(
  '/:supplierId/criticality-assessments/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('supplierId').isUUID(),
    param('id').isUUID(),
    body('criticality').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('rationale').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const assessment = await prisma.supplierCriticalityAssessment.findUnique({
        where: { id: req.params.id },
      });

      if (!assessment || assessment.supplierId !== req.params.supplierId) {
        return res.status(404).json({ error: 'Criticality assessment not found' });
      }

      if (assessment.status !== 'DRAFT') {
        return res.status(400).json({ error: 'Can only update assessments in DRAFT status' });
      }

      const updateData: any = {};
      if (req.body.criticality !== undefined) updateData.criticality = req.body.criticality;
      if (req.body.rationale !== undefined) updateData.rationale = req.body.rationale || null;

      const updated = await prisma.supplierCriticalityAssessment.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      res.json(updated);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Criticality assessment not found' });
      }
      console.error('Error updating criticality assessment:', error);
      res.status(500).json({ error: 'Failed to update criticality assessment' });
    }
  }
);

// POST /api/suppliers/:supplierId/criticality-assessments/:id/submit - Submit for approval
router.post(
  '/:supplierId/criticality-assessments/:id/submit',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('supplierId').isUUID(), param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const assessment = await prisma.supplierCriticalityAssessment.findUnique({
        where: { id: req.params.id },
        include: {
          supplier: true,
        },
      });

      if (!assessment || assessment.supplierId !== req.params.supplierId) {
        return res.status(404).json({ error: 'Criticality assessment not found' });
      }

      if (assessment.status !== 'DRAFT') {
        return res.status(400).json({ error: 'Can only submit assessments in DRAFT status' });
      }

      const updated = await prisma.supplierCriticalityAssessment.update({
        where: { id: req.params.id },
        data: {
          status: 'SUBMITTED',
        },
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Auto-update lifecycle state
      const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.supplierId },
        include: {
          riskAssessments: {
            select: { id: true, status: true },
            orderBy: { createdAt: 'desc' },
          },
          criticalityAssessments: {
            select: { id: true, status: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (supplier) {
        const nextState = await determineNextState(supplier);
        if (nextState && nextState !== supplier.lifecycleState) {
          await prisma.supplier.update({
            where: { id: supplier.id },
            data: { lifecycleState: nextState },
          });
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error submitting criticality assessment:', error);
      res.status(500).json({ error: 'Failed to submit criticality assessment' });
    }
  }
);

// POST /api/suppliers/:supplierId/criticality-assessments/:id/approve - Approve assessment
router.post(
  '/:supplierId/criticality-assessments/:id/approve',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('supplierId').isUUID(), param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      const assessment = await prisma.supplierCriticalityAssessment.findUnique({
        where: { id: req.params.id },
        include: {
          supplier: true,
        },
      });

      if (!assessment || assessment.supplierId !== req.params.supplierId) {
        return res.status(404).json({ error: 'Criticality assessment not found' });
      }

      if (assessment.status !== 'SUBMITTED') {
        return res.status(400).json({ error: 'Can only approve assessments in SUBMITTED status' });
      }

      // Check if CISO approval is required
      const needsCiso = requiresCisoApproval(
        assessment.supplier,
        'CRITICALITY',
        assessment.criticality
      );

      if (needsCiso && user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'CISO approval required. Only ADMIN users can approve this assessment.',
        });
      }

      const updated = await prisma.supplierCriticalityAssessment.update({
        where: { id: req.params.id },
        data: {
          status: 'APPROVED',
          approvedByUserId: user.id,
          approvedAt: new Date(),
        },
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Update supplier snapshot fields
      await updateSupplierSnapshotOnApproval(req.params.supplierId, 'CRITICALITY', updated);

      // Auto-update lifecycle state
      const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.supplierId },
        include: {
          riskAssessments: {
            select: { id: true, status: true },
            orderBy: { createdAt: 'desc' },
          },
          criticalityAssessments: {
            select: { id: true, status: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (supplier) {
        const nextState = await determineNextState(supplier);
        if (nextState && nextState !== supplier.lifecycleState) {
          await prisma.supplier.update({
            where: { id: supplier.id },
            data: { lifecycleState: nextState },
          });
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error approving criticality assessment:', error);
      res.status(500).json({ error: 'Failed to approve criticality assessment' });
    }
  }
);

// POST /api/suppliers/:supplierId/criticality-assessments/:id/reject - Reject assessment
router.post(
  '/:supplierId/criticality-assessments/:id/reject',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('supplierId').isUUID(),
    param('id').isUUID(),
    body('rejectionReason').notEmpty().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const assessment = await prisma.supplierCriticalityAssessment.findUnique({
        where: { id: req.params.id },
        include: {
          supplier: true,
        },
      });

      if (!assessment || assessment.supplierId !== req.params.supplierId) {
        return res.status(404).json({ error: 'Criticality assessment not found' });
      }

      if (assessment.status !== 'SUBMITTED') {
        return res.status(400).json({ error: 'Can only reject assessments in SUBMITTED status' });
      }

      const updated = await prisma.supplierCriticalityAssessment.update({
        where: { id: req.params.id },
        data: {
          status: 'REJECTED',
          rejectionReason: req.body.rejectionReason,
        },
        include: {
          assessedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Auto-update lifecycle state to REJECTED
      await prisma.supplier.update({
        where: { id: req.params.supplierId },
        data: { lifecycleState: 'REJECTED' },
      });

      res.json(updated);
    } catch (error: any) {
      console.error('Error rejecting criticality assessment:', error);
      res.status(500).json({ error: 'Failed to reject criticality assessment' });
    }
  }
);

export default router;

