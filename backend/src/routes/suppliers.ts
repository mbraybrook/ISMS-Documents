/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('Validation errors:', errors.array());
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    return res.status(400).json({ 
      error: 'Validation failed',
      errors: errors.array(),
      details: errors.array().map((e: any) => `${e.param}: ${e.msg}`).join(', '),
    });
  }
  next();
};

// Helper function to validate enum values (currently unused but may be needed for future validation)
const _isValidEnum = (value: any, enumValues: string[]): boolean => {
  return value === null || value === undefined || enumValues.includes(value);
};

// GET /api/suppliers - list all suppliers with filters
router.get(
  '/',
  authenticateToken,
  [
    query('supplierType').optional().isIn(['SERVICE_PROVIDER', 'CONNECTED_ENTITY', 'PCI_SERVICE_PROVIDER']),
    query('criticality').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    query('pciStatus').optional().isIn(['UNKNOWN', 'PASS', 'FAIL', 'NOT_APPLICABLE']),
    query('iso27001Status').optional().isIn(['UNKNOWN', 'CERTIFIED', 'NOT_CERTIFIED', 'IN_PROGRESS']),
    query('status').optional().isIn(['ACTIVE', 'IN_ONBOARDING', 'IN_EXIT', 'INACTIVE']),
    query('performanceRating').optional().isIn(['GOOD', 'CAUTION', 'BAD']),
    query('lifecycleState').optional().isIn(['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_REVIEW', 'EXIT_IN_PROGRESS']),
    query('search').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        supplierType,
        criticality,
        pciStatus,
        iso27001Status,
        status,
        performanceRating,
        lifecycleState,
        search,
      } = req.query;

      const where: any = {};

      if (supplierType) {
        where.supplierType = supplierType;
      }
      if (criticality) {
        where.criticality = criticality;
      }
      if (pciStatus) {
        where.pciStatus = pciStatus;
      }
      if (iso27001Status) {
        where.iso27001Status = iso27001Status;
      }
      if (status) {
        where.status = status;
      }
      if (performanceRating) {
        where.performanceRating = performanceRating;
      }
      if (lifecycleState) {
        where.lifecycleState = lifecycleState;
      }
      if (search) {
        where.name = {
          contains: search as string,
          mode: 'insensitive',
        };
      }

      const suppliers = await prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          relationshipOwner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      res.json(suppliers);
    } catch (error: any) {
      console.error('Error fetching suppliers:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack,
      });
      res.status(500).json({ 
        error: 'Failed to fetch suppliers',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        errors: process.env.NODE_ENV === 'development' ? [error.message] : undefined,
      });
    }
  }
);

// GET /api/suppliers/:id - get supplier details
router.get(
  '/:id',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const supplier = await prisma.supplier.findUnique({
        where: { id: req.params.id },
        include: {
          relationshipOwner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          supplierRisks: {
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
          },
          supplierControls: {
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
          },
          exitPlan: true,
        },
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      res.json(supplier);
    } catch (error) {
      console.error('Error fetching supplier:', error);
      res.status(500).json({ error: 'Failed to fetch supplier' });
    }
  }
);

// POST /api/suppliers - create supplier
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('name').notEmpty().trim(),
    body('tradingName').optional().isString(),
    body('status').optional().isIn(['ACTIVE', 'IN_ONBOARDING', 'IN_EXIT', 'INACTIVE']),
    body('supplierType').isIn(['SERVICE_PROVIDER', 'CONNECTED_ENTITY', 'PCI_SERVICE_PROVIDER']),
    body('serviceSubType').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      return value === 'SAAS';
    }).withMessage('serviceSubType must be SAAS or null'),
    body('serviceDescription').optional().isString(),
    body('processesCardholderData').optional().isBoolean(),
    body('processesPersonalData').optional().isBoolean(),
    body('hostingRegions').optional().isArray(),
    body('customerFacingImpact').optional().isBoolean(),
    body('overallRiskRating').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('criticality').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('riskRationale').optional().isString(),
    body('criticalityRationale').optional().isString(),
    body('pciStatus').optional().isIn(['UNKNOWN', 'PASS', 'FAIL', 'NOT_APPLICABLE']),
    body('iso27001Status').optional().isIn(['UNKNOWN', 'CERTIFIED', 'NOT_CERTIFIED', 'IN_PROGRESS']),
    body('iso22301Status').optional().isIn(['UNKNOWN', 'CERTIFIED', 'NOT_CERTIFIED', 'IN_PROGRESS']),
    body('iso9001Status').optional().isIn(['UNKNOWN', 'CERTIFIED', 'NOT_CERTIFIED', 'IN_PROGRESS']),
    body('gdprStatus').optional().isIn(['UNKNOWN', 'ADEQUATE', 'HIGH_RISK', 'NOT_APPLICABLE']),
    body('reviewDate').optional().isISO8601().toDate(),
    body('complianceEvidenceLinks').optional().isArray(),
    body('relationshipOwnerUserId').optional().isUUID(),
    body('primaryContacts').optional().isArray(),
    body('contractReferences').optional().isArray(),
    body('dataProcessingAgreementRef').optional().isString(),
    body('contractStartDate').optional().isISO8601().toDate(),
    body('contractEndDate').optional().isISO8601().toDate(),
    body('autoRenewal').optional().isBoolean(),
    body('performanceRating').optional().isIn(['GOOD', 'CAUTION', 'BAD']),
    body('performanceNotes').optional().isString(),
    body('lifecycleState').optional().isIn(['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_REVIEW', 'EXIT_IN_PROGRESS']),
    body('cisoExemptionGranted').optional().isBoolean(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Get user ID from request
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      const supplierData: any = {
        id: randomUUID(),
        name: req.body.name,
        tradingName: req.body.tradingName || null,
        status: req.body.status || 'ACTIVE',
        supplierType: req.body.supplierType,
        serviceSubType: req.body.serviceSubType || null,
        serviceDescription: req.body.serviceDescription || null,
        processesCardholderData: req.body.processesCardholderData || false,
        processesPersonalData: req.body.processesPersonalData || false,
        hostingRegions: req.body.hostingRegions ? JSON.parse(JSON.stringify(req.body.hostingRegions)) : null,
        customerFacingImpact: req.body.customerFacingImpact || false,
        overallRiskRating: req.body.overallRiskRating || null,
        criticality: req.body.criticality || null,
        riskRationale: req.body.riskRationale || null,
        criticalityRationale: req.body.criticalityRationale || null,
        pciStatus: req.body.pciStatus || null,
        iso27001Status: req.body.iso27001Status || null,
        iso22301Status: req.body.iso22301Status || null,
        iso9001Status: req.body.iso9001Status || null,
        gdprStatus: req.body.gdprStatus || null,
        reviewDate: req.body.reviewDate ? new Date(req.body.reviewDate) : null,
        complianceEvidenceLinks: req.body.complianceEvidenceLinks ? JSON.parse(JSON.stringify(req.body.complianceEvidenceLinks)) : null,
        relationshipOwnerUserId: req.body.relationshipOwnerUserId || null,
        primaryContacts: req.body.primaryContacts ? JSON.parse(JSON.stringify(req.body.primaryContacts)) : null,
        contractReferences: req.body.contractReferences ? JSON.parse(JSON.stringify(req.body.contractReferences)) : null,
        dataProcessingAgreementRef: req.body.dataProcessingAgreementRef || null,
        contractStartDate: req.body.contractStartDate ? new Date(req.body.contractStartDate) : null,
        contractEndDate: req.body.contractEndDate ? new Date(req.body.contractEndDate) : null,
        autoRenewal: req.body.autoRenewal || false,
        performanceRating: req.body.performanceRating || null,
        performanceNotes: req.body.performanceNotes || null,
        lifecycleState: req.body.lifecycleState || 'DRAFT',
        cisoExemptionGranted: req.body.cisoExemptionGranted || false,
        showInTrustCenter: req.body.showInTrustCenter || false,
        trustCenterDisplayName: req.body.trustCenterDisplayName || null,
        trustCenterDescription: req.body.trustCenterDescription || null,
        trustCenterCategory: req.body.trustCenterCategory || null,
        trustCenterComplianceSummary: req.body.trustCenterComplianceSummary || null,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        updatedAt: new Date(),
      };

      const supplier = await prisma.supplier.create({
        data: supplierData,
        include: {
          relationshipOwner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json(supplier);
    } catch (error: any) {
      console.error('Error creating supplier:', error);
      res.status(500).json({ error: 'Failed to create supplier' });
    }
  }
);

// PUT /api/suppliers/:id - update supplier
router.put(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('name').optional().notEmpty().trim(),
    body('tradingName').optional().isString(),
    body('status').optional().isIn(['ACTIVE', 'IN_ONBOARDING', 'IN_EXIT', 'INACTIVE']),
    body('supplierType').optional().isIn(['SERVICE_PROVIDER', 'CONNECTED_ENTITY', 'PCI_SERVICE_PROVIDER']),
    body('serviceSubType').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      return value === 'SAAS';
    }).withMessage('serviceSubType must be SAAS or null'),
    body('serviceDescription').optional().isString(),
    body('processesCardholderData').optional().isBoolean(),
    body('processesPersonalData').optional().isBoolean(),
    body('hostingRegions').optional().isArray(),
    body('customerFacingImpact').optional().isBoolean(),
    body('overallRiskRating').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return ['LOW', 'MEDIUM', 'HIGH'].includes(value);
    }).withMessage('overallRiskRating must be LOW, MEDIUM, or HIGH'),
    body('criticality').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return ['LOW', 'MEDIUM', 'HIGH'].includes(value);
    }).withMessage('criticality must be LOW, MEDIUM, or HIGH'),
    body('riskRationale').optional().isString(),
    body('criticalityRationale').optional().isString(),
    body('pciStatus').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return ['UNKNOWN', 'PASS', 'FAIL', 'NOT_APPLICABLE'].includes(value);
    }).withMessage('pciStatus must be UNKNOWN, PASS, FAIL, or NOT_APPLICABLE'),
    body('iso27001Status').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return ['UNKNOWN', 'CERTIFIED', 'NOT_CERTIFIED', 'IN_PROGRESS', 'NOT_APPLICABLE'].includes(value);
    }).withMessage('iso27001Status must be UNKNOWN, CERTIFIED, NOT_CERTIFIED, IN_PROGRESS, or NOT_APPLICABLE'),
    body('iso22301Status').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return ['UNKNOWN', 'CERTIFIED', 'NOT_CERTIFIED', 'IN_PROGRESS', 'NOT_APPLICABLE'].includes(value);
    }).withMessage('iso22301Status must be UNKNOWN, CERTIFIED, NOT_CERTIFIED, IN_PROGRESS, or NOT_APPLICABLE'),
    body('iso9001Status').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return ['UNKNOWN', 'CERTIFIED', 'NOT_CERTIFIED', 'IN_PROGRESS', 'NOT_APPLICABLE'].includes(value);
    }).withMessage('iso9001Status must be UNKNOWN, CERTIFIED, NOT_CERTIFIED, IN_PROGRESS, or NOT_APPLICABLE'),
    body('gdprStatus').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return ['UNKNOWN', 'ADEQUATE', 'HIGH_RISK', 'NOT_APPLICABLE'].includes(value);
    }).withMessage('gdprStatus must be UNKNOWN, ADEQUATE, HIGH_RISK, or NOT_APPLICABLE'),
    body('reviewDate').optional().custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(value) || !isNaN(Date.parse(value));
    }).withMessage('reviewDate must be a valid date'),
    body('complianceEvidenceLinks').optional().isArray(),
    body('relationshipOwnerUserId').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }).withMessage('relationshipOwnerUserId must be a valid UUID'),
    body('primaryContacts').optional().isArray(),
    body('contractReferences').optional().isArray(),
    body('dataProcessingAgreementRef').optional().isString(),
    body('contractStartDate').optional().custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(value) || !isNaN(Date.parse(value));
    }).withMessage('contractStartDate must be a valid date'),
    body('contractEndDate').optional().custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(value) || !isNaN(Date.parse(value));
    }).withMessage('contractEndDate must be a valid date'),
    body('autoRenewal').optional().isBoolean(),
    body('performanceRating').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return ['GOOD', 'CAUTION', 'BAD'].includes(value);
    }).withMessage('performanceRating must be GOOD, CAUTION, or BAD'),
    body('performanceNotes').optional().isString(),
    body('lifecycleState').optional().isIn(['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_REVIEW', 'EXIT_IN_PROGRESS']),
    body('cisoExemptionGranted').optional().isBoolean(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Get user ID from request
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      // Get current supplier to validate lifecycle transition
      const currentSupplier = await prisma.supplier.findUnique({
        where: { id: req.params.id },
      });

      if (!currentSupplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      // Lifecycle state transitions are now unrestricted - any change is allowed
      // Validation removed per user request

      const updateData: any = {
        updatedAt: new Date(),
        updatedByUserId: user.id,
      };

      // Only update fields that are provided
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.tradingName !== undefined) updateData.tradingName = req.body.tradingName || null;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.supplierType !== undefined) updateData.supplierType = req.body.supplierType;
      if (req.body.serviceSubType !== undefined) updateData.serviceSubType = req.body.serviceSubType || null;
      if (req.body.serviceDescription !== undefined) updateData.serviceDescription = req.body.serviceDescription || null;
      if (req.body.processesCardholderData !== undefined) updateData.processesCardholderData = req.body.processesCardholderData;
      if (req.body.processesPersonalData !== undefined) updateData.processesPersonalData = req.body.processesPersonalData;
      if (req.body.hostingRegions !== undefined) updateData.hostingRegions = req.body.hostingRegions ? JSON.parse(JSON.stringify(req.body.hostingRegions)) : null;
      if (req.body.customerFacingImpact !== undefined) updateData.customerFacingImpact = req.body.customerFacingImpact;
      if (req.body.overallRiskRating !== undefined) updateData.overallRiskRating = req.body.overallRiskRating || null;
      if (req.body.criticality !== undefined) updateData.criticality = req.body.criticality || null;
      if (req.body.riskRationale !== undefined) updateData.riskRationale = req.body.riskRationale || null;
      if (req.body.criticalityRationale !== undefined) updateData.criticalityRationale = req.body.criticalityRationale || null;
      if (req.body.pciStatus !== undefined) updateData.pciStatus = req.body.pciStatus || null;
      if (req.body.iso27001Status !== undefined) updateData.iso27001Status = req.body.iso27001Status || null;
      if (req.body.iso22301Status !== undefined) updateData.iso22301Status = req.body.iso22301Status || null;
      if (req.body.iso9001Status !== undefined) updateData.iso9001Status = req.body.iso9001Status || null;
      if (req.body.gdprStatus !== undefined) updateData.gdprStatus = req.body.gdprStatus || null;
      if (req.body.reviewDate !== undefined) updateData.reviewDate = req.body.reviewDate && req.body.reviewDate.trim() !== '' ? new Date(req.body.reviewDate) : null;
      if (req.body.complianceEvidenceLinks !== undefined) updateData.complianceEvidenceLinks = req.body.complianceEvidenceLinks ? JSON.parse(JSON.stringify(req.body.complianceEvidenceLinks)) : null;
      if (req.body.relationshipOwnerUserId !== undefined) updateData.relationshipOwnerUserId = req.body.relationshipOwnerUserId || null;
      if (req.body.primaryContacts !== undefined) updateData.primaryContacts = req.body.primaryContacts ? JSON.parse(JSON.stringify(req.body.primaryContacts)) : null;
      if (req.body.contractReferences !== undefined) updateData.contractReferences = req.body.contractReferences ? JSON.parse(JSON.stringify(req.body.contractReferences)) : null;
      if (req.body.dataProcessingAgreementRef !== undefined) updateData.dataProcessingAgreementRef = req.body.dataProcessingAgreementRef || null;
      if (req.body.contractStartDate !== undefined) updateData.contractStartDate = req.body.contractStartDate && req.body.contractStartDate.trim() !== '' ? new Date(req.body.contractStartDate) : null;
      if (req.body.contractEndDate !== undefined) updateData.contractEndDate = req.body.contractEndDate && req.body.contractEndDate.trim() !== '' ? new Date(req.body.contractEndDate) : null;
      if (req.body.autoRenewal !== undefined) updateData.autoRenewal = req.body.autoRenewal;
      if (req.body.performanceRating !== undefined) updateData.performanceRating = req.body.performanceRating || null;
      if (req.body.performanceNotes !== undefined) updateData.performanceNotes = req.body.performanceNotes || null;
      if (req.body.lifecycleState !== undefined) updateData.lifecycleState = req.body.lifecycleState;
      if (req.body.cisoExemptionGranted !== undefined) updateData.cisoExemptionGranted = req.body.cisoExemptionGranted;
      if (req.body.showInTrustCenter !== undefined) updateData.showInTrustCenter = req.body.showInTrustCenter;
      if (req.body.trustCenterDisplayName !== undefined) updateData.trustCenterDisplayName = req.body.trustCenterDisplayName || null;
      if (req.body.trustCenterDescription !== undefined) updateData.trustCenterDescription = req.body.trustCenterDescription || null;
      if (req.body.trustCenterCategory !== undefined) updateData.trustCenterCategory = req.body.trustCenterCategory || null;
      if (req.body.trustCenterComplianceSummary !== undefined) updateData.trustCenterComplianceSummary = req.body.trustCenterComplianceSummary || null;

      const supplier = await prisma.supplier.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          relationshipOwner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      res.json(supplier);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      console.error('Error updating supplier:', error);
      res.status(500).json({ error: 'Failed to update supplier' });
    }
  }
);

// PATCH /api/suppliers/:id/archive - archive supplier (set status to INACTIVE)
router.patch(
  '/:id/archive',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Get user ID from request
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      const supplier = await prisma.supplier.update({
        where: { id: req.params.id },
        data: {
          status: 'INACTIVE',
          updatedAt: new Date(),
          updatedByUserId: user.id,
        },
        include: {
          relationshipOwner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      res.json(supplier);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      console.error('Error archiving supplier:', error);
      res.status(500).json({ error: 'Failed to archive supplier' });
    }
  }
);

export default router;

