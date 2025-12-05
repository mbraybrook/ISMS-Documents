import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import multer from 'multer';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { csvUpload, handleMulterError } from '../lib/multerConfig';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import {
  calculateRiskScore,
  calculateMitigatedScore,
  getRiskLevel,
  parseControlCodes,
  updateRiskControls,
  calculateCIAFromWizard,
  validateStatusTransition,
  hasPolicyNonConformance,
} from '../services/riskService';
import { importRisksFromCSV } from '../services/riskImportService';
import { findSimilarRisksForRisk, checkSimilarityForNewRisk } from '../services/similarityService';
import { computeAndStoreEmbedding } from '../services/embeddingService';
import { generateEmbedding, normalizeRiskText, cosineSimilarity, mapToScore } from '../services/llmService';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/risks - list risks
router.get(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR', 'CONTRIBUTOR'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isIn(['calculatedScore', 'mitigatedScore', 'title', 'createdAt', 'dateAdded']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('riskCategory').optional().isString(),
    query('riskNature').optional().isIn(['STATIC', 'INSTANCE']),
    query('archived').optional().isBoolean(),
    query('ownerId').optional().isUUID(),
    query('treatmentCategory').optional().isIn(['RETAIN', 'MODIFY', 'SHARE', 'AVOID']),
    query('mitigationImplemented').optional().isBoolean(),
    query('policyNonConformance').optional().isBoolean(),
    query('controlsApplied').optional().isBoolean(),
    query('riskLevel').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    query('search').optional().isString(),
    query('dateAddedFrom').optional().isISO8601(),
    query('dateAddedTo').optional().isISO8601(),
    query('assetId').optional().isUUID(),
    query('assetCategoryId').optional().isUUID(),
    query('view').optional().isIn(['department', 'inbox']),
    query('status').optional().isIn(['DRAFT', 'PROPOSED', 'ACTIVE', 'REJECTED', 'ARCHIVED']),
    query('department').optional().isIn(['BUSINESS_STRATEGY', 'FINANCE', 'HR', 'OPERATIONS', 'PRODUCT', 'MARKETING']),
    query('testDepartment').optional().isIn(['BUSINESS_STRATEGY', 'FINANCE', 'HR', 'OPERATIONS', 'PRODUCT', 'MARKETING']),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Get user from database to check role and department
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      const userRole = user.role as string;
      const userDepartment = user.department;

      const {
        page = '1',
        limit = '20',
        sortBy = 'calculatedScore',
        sortOrder = 'desc',
        riskCategory,
        riskNature,
        archived,
        ownerId,
        treatmentCategory,
        mitigationImplemented,
        riskLevel,
        search,
        dateAddedFrom,
        dateAddedTo,
        assetId,
        assetCategoryId,
        view,
        status,
        department,
        testDepartment,
        policyNonConformance,
        controlsApplied,
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause for filtering
      const where: any = {};

      // Check if this is a test scenario: ADMIN user testing as CONTRIBUTOR with testDepartment
      // This happens when view=department and testDepartment is provided
      const isTestingAsContributor = testDepartment && userRole === 'ADMIN' && view === 'department';
      
      // Permission-based filtering
      if (userRole === 'CONTRIBUTOR' || isTestingAsContributor) {
        // Determine effective department
        let effectiveDepartment: string | null = null;
        
        if (isTestingAsContributor && testDepartment) {
          // ADMIN testing as CONTRIBUTOR - use test department
          effectiveDepartment = testDepartment as string;
        } else if (userRole === 'CONTRIBUTOR') {
          // Real CONTRIBUTOR - use database department
          effectiveDepartment = userDepartment;
        }
        
        // Contributors can only see their department's risks
        if (effectiveDepartment) {
          where.department = effectiveDepartment;
        } else {
          return res.status(403).json({ error: 'Contributors must have a department assigned' });
        }
        // Contributors cannot see archived risks
        where.archived = false;
      } else {
        // Editors/Admins: Global visibility - no department filter by default
        // Only apply department filter if explicitly requested
        if (department) {
          where.department = department;
        }
        // Default to showing non-archived risks unless explicitly requested
        if (archived !== undefined) {
          where.archived = archived === 'true';
        } else {
          where.archived = false;
        }
      }

      // Handle view parameter
      if (view === 'inbox') {
        // Review inbox: show only PROPOSED risks (for Editors/Admins)
        if (userRole !== 'EDITOR' && userRole !== 'ADMIN') {
          return res.status(403).json({ error: 'Only Editors and Admins can access the review inbox' });
        }
        where.status = 'PROPOSED';
      } else if (view === 'department') {
        // Department view: already handled above for Contributors
        // For Editors/Admins, this is just a filter option
      }

      // Status filter
      if (status) {
        where.status = status;
      } else if (userRole === 'CONTRIBUTOR') {
        // Contributors see all non-archived statuses by default
        // No status filter needed
      } else {
        // Editors/Admins: show all statuses except ARCHIVED by default (already handled by archived filter)
        // If no status filter, show all (DRAFT, PROPOSED, ACTIVE, REJECTED)
      }

      if (riskCategory) where.riskCategory = riskCategory;
      if (riskNature) where.riskNature = riskNature;
      if (ownerId) where.ownerUserId = ownerId;
      if (mitigationImplemented !== undefined) {
        where.mitigationImplemented = mitigationImplemented === 'true';
      }
      
      // Handle search query - search in title and description
      if (search) {
        const searchLower = (search as string).toLowerCase();
        where.OR = [
          { title: { contains: search as string } },
          { description: { contains: search as string } },
        ];
      }

      // Handle date range filter
      if (dateAddedFrom || dateAddedTo) {
        where.dateAdded = {};
        if (dateAddedFrom) {
          where.dateAdded.gte = dateAddedFrom as string;
        }
        if (dateAddedTo) {
          where.dateAdded.lte = dateAddedTo as string;
        }
      }

      // Handle asset filters
      if (assetId) where.assetId = assetId as string;
      if (assetCategoryId) where.assetCategoryId = assetCategoryId as string;
      
      // Handle treatment category with OR condition
      if (treatmentCategory) {
        const baseConditions = { ...where };
        // If we already have OR from search, we need to wrap it
        if (where.OR) {
          where.AND = [
            { OR: where.OR },
            {
              OR: [
                { initialRiskTreatmentCategory: treatmentCategory },
                { residualRiskTreatmentCategory: treatmentCategory },
              ],
            },
          ];
          delete where.OR;
        } else {
          where.AND = [
            baseConditions,
            {
              OR: [
                { initialRiskTreatmentCategory: treatmentCategory },
                { residualRiskTreatmentCategory: treatmentCategory },
              ],
            },
          ];
        }
      }

      // Build count where clause (same as findMany)
      const countWhere = { ...where };

      // Apply risk level filter if specified
      if (riskLevel) {
        const risksForLevel = await prisma.risk.findMany({
          where: countWhere,
          select: { id: true, calculatedScore: true },
        });
        const filteredIds = risksForLevel
          .filter((r) => getRiskLevel(r.calculatedScore) === riskLevel)
          .map((r) => r.id);
        where.id = { in: filteredIds };
        countWhere.id = { in: filteredIds };
      }

      // Apply policy non-conformance filter if specified
      if (policyNonConformance !== undefined) {
        const allRisksForNonConformance = await prisma.risk.findMany({
          where: countWhere,
          select: {
            id: true,
            initialRiskTreatmentCategory: true,
            calculatedScore: true,
            mitigatedConfidentialityScore: true,
            mitigatedIntegrityScore: true,
            mitigatedAvailabilityScore: true,
            mitigatedLikelihood: true,
            mitigatedScore: true,
            mitigationDescription: true,
          },
        });
        const filteredIds = allRisksForNonConformance
          .filter((r) => {
            const hasNonConformance = hasPolicyNonConformance(r);
            return policyNonConformance === 'true' ? hasNonConformance : !hasNonConformance;
          })
          .map((r) => r.id);
        where.id = { in: filteredIds };
        countWhere.id = { in: filteredIds };
      }

      // Apply controls applied filter if specified
      if (controlsApplied !== undefined) {
        const allRisksForControls = await prisma.risk.findMany({
          where: countWhere,
          select: {
            id: true,
            riskControls: {
              select: {
                controlId: true,
              },
            },
          },
        });
        const filteredIds = allRisksForControls
          .filter((r) => {
            const hasControls = r.riskControls.length > 0;
            return controlsApplied === 'true' ? hasControls : !hasControls;
          })
          .map((r) => r.id);
        where.id = { in: filteredIds };
        countWhere.id = { in: filteredIds };
      }

      const [risks, total] = await Promise.all([
        prisma.risk.findMany({
          where,
          include: {
            owner: {
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            },
            interestedParty: {
              select: {
                id: true,
                name: true,
                group: true,
              },
            },
            riskControls: {
              include: {
                control: {
                  select: {
                    id: true,
                    code: true,
                    title: true,
                  },
                },
              },
            },
          },
          skip,
          take: limitNum,
          orderBy: {
            [sortBy as string]: sortOrder as 'asc' | 'desc',
          },
        }),
        prisma.risk.count({ where: countWhere }),
      ]);

      // Add risk level to each risk
      const risksWithLevel = risks.map((risk) => ({
        ...risk,
        riskLevel: getRiskLevel(risk.calculatedScore),
        mitigatedRiskLevel: risk.mitigatedScore ? getRiskLevel(risk.mitigatedScore) : null,
      }));

      res.json({
        data: risksWithLevel,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Error fetching risks:', error);
      res.status(500).json({ error: 'Failed to fetch risks' });
    }
  }
);

// GET /api/risks/:id - get risk details
router.get(
  '/:id',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const risk = await prisma.risk.findUnique({
        where: { id },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          interestedParty: {
            select: {
              id: true,
              name: true,
              group: true,
            },
          },
          riskControls: {
            include: {
              control: true,
            },
          },
          DocumentRisk: {
            include: {
              document: {
                select: {
                  id: true,
                  title: true,
                  version: true,
                },
              },
            },
          },
          supplierRisks: {
            include: {
              supplier: {
                select: {
                  id: true,
                  name: true,
                  supplierType: true,
                  criticality: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!risk) {
        return res.status(404).json({ error: 'Risk not found' });
      }

      // Add risk level to response
      const riskWithLevel = {
        ...risk,
        riskLevel: getRiskLevel(risk.calculatedScore),
        mitigatedRiskLevel: risk.mitigatedScore ? getRiskLevel(risk.mitigatedScore) : null,
      };

      res.json(riskWithLevel);
    } catch (error) {
      console.error('Error fetching risk:', error);
      res.status(500).json({ error: 'Failed to fetch risk' });
    }
  }
);

// POST /api/risks - create risk
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR', 'CONTRIBUTOR'),
  [
    body('title').notEmpty().trim(),
    body('description').optional().isString(),
    body('dateAdded').optional().isISO8601().toDate(),
    body('riskCategory').optional().isIn(['INFORMATION_SECURITY', 'OPERATIONAL', 'FINANCIAL', 'COMPLIANCE', 'REPUTATIONAL', 'STRATEGIC', 'OTHER']),
    body('riskNature').optional().isIn(['STATIC', 'INSTANCE']),
    body('archived').optional().isBoolean(),
    body('expiryDate').optional().isISO8601().toDate(),
    body('lastReviewDate').optional().isISO8601().toDate(),
    body('nextReviewDate').optional().isISO8601().toDate(),
    body('ownerUserId').optional().isUUID(),
    body('assetCategory').optional().isString(),
    body('assetId').optional().isUUID(),
    body('assetCategoryId').optional().isUUID(),
    body('interestedPartyId').optional().isUUID(),
    body('threatDescription').optional().isString(),
    body('confidentialityScore').optional().isInt({ min: 1, max: 5 }),
    body('integrityScore').optional().isInt({ min: 1, max: 5 }),
    body('availabilityScore').optional().isInt({ min: 1, max: 5 }),
    body('riskScore').optional().isInt({ min: 1 }),
    body('likelihood').optional().isInt({ min: 1, max: 5 }),
    body('initialRiskTreatmentCategory').optional().isIn(['RETAIN', 'MODIFY', 'SHARE', 'AVOID']),
    body('mitigatedConfidentialityScore').optional().isInt({ min: 1, max: 5 }),
    body('mitigatedIntegrityScore').optional().isInt({ min: 1, max: 5 }),
    body('mitigatedAvailabilityScore').optional().isInt({ min: 1, max: 5 }),
    body('mitigatedRiskScore').optional().isInt({ min: 1, max: 75 }),
    body('mitigatedLikelihood').optional().isInt({ min: 1, max: 5 }),
    body('mitigationImplemented').optional().isBoolean(),
    body('mitigationDescription').optional().isString(),
    body('residualRiskTreatmentCategory').optional().isIn(['RETAIN', 'MODIFY', 'SHARE', 'AVOID']),
    body('annexAControlsRaw').optional().isString(),
    body('wizardData').optional().isString(),
    body('status').optional().isIn(['DRAFT', 'PROPOSED', 'ACTIVE', 'REJECTED', 'ARCHIVED']),
    body('department').optional().isIn(['BUSINESS_STRATEGY', 'FINANCE', 'HR', 'OPERATIONS', 'PRODUCT', 'MARKETING', null]),
    body('isSupplierRisk').optional().isBoolean(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Get user from database
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      const userRole = user.role as string;
      const userDepartment = user.department;

      const {
        title,
        description,
        dateAdded,
        riskCategory,
        riskNature,
        archived,
        expiryDate,
        lastReviewDate,
        nextReviewDate,
        ownerUserId,
        assetCategory,
        assetId,
        assetCategoryId,
        interestedPartyId,
        threatDescription,
        confidentialityScore,
        integrityScore,
        availabilityScore,
        riskScore,
        likelihood,
        initialRiskTreatmentCategory,
        mitigatedConfidentialityScore,
        mitigatedIntegrityScore,
        mitigatedAvailabilityScore,
        mitigatedRiskScore,
        mitigatedLikelihood,
        mitigationImplemented,
        mitigationDescription,
        existingControlsDescription,
        residualRiskTreatmentCategory,
        annexAControlsRaw,
        wizardData,
        status,
        department,
        isSupplierRisk,
      } = req.body;

      // Handle wizard data for Contributors
      let finalConfidentialityScore = confidentialityScore ?? 1;
      let finalIntegrityScore = integrityScore ?? 1;
      let finalAvailabilityScore = availabilityScore ?? 1;
      let finalLikelihood = likelihood ?? 1;
      let finalStatus = status || 'DRAFT';
      let finalDepartment = department;
      let finalWizardData = wizardData;

      if (wizardData) {
        try {
          const wizard = JSON.parse(wizardData);
          const impactLevel = wizard.impact || wizard.impactLevel;
          const wizardLikelihood = wizard.likelihood;

          if (impactLevel) {
            const cia = calculateCIAFromWizard(impactLevel);
            finalConfidentialityScore = cia.c;
            finalIntegrityScore = cia.i;
            finalAvailabilityScore = cia.a;
          }

          if (wizardLikelihood) {
            finalLikelihood = wizardLikelihood;
          }
        } catch (error) {
          console.error('Error parsing wizardData:', error);
          // Continue with defaults if wizardData is invalid
        }
      }

      // For Contributors: force department and restrict status
      if (userRole === 'CONTRIBUTOR') {
        // For testing: Allow ADMIN users to use department from request body (test override)
        // Verify the actual user in database is ADMIN (not just testing as Contributor)
        const actualUser = await prisma.user.findUnique({
          where: { email: req.user!.email },
          select: { role: true },
        });
        
        if (actualUser?.role === 'ADMIN' && department) {
          // ADMIN testing as CONTRIBUTOR - use department from request (test override)
          finalDepartment = department;
        } else {
          // Real CONTRIBUTOR - use department from database
          if (!userDepartment) {
            return res.status(403).json({ error: 'Contributors must have a department assigned' });
          }
          finalDepartment = userDepartment;
        }
        
        // Contributors can only create DRAFT or PROPOSED risks
        if (finalStatus !== 'DRAFT' && finalStatus !== 'PROPOSED') {
          finalStatus = 'DRAFT';
        }
      }

      // Automatically set ownerUserId from authenticated user
      const finalOwnerUserId = ownerUserId || user.id;

      // Business logic validation: expiryDate only for INSTANCE, review dates only for STATIC
      if (riskNature === 'STATIC' && expiryDate) {
        return res.status(400).json({
          error: 'Expiry date cannot be set for STATIC risks. Use review dates instead.',
        });
      }
      if (riskNature === 'INSTANCE' && (lastReviewDate || nextReviewDate)) {
        return res.status(400).json({
          error: 'Review dates cannot be set for INSTANCE risks. Use expiry date instead.',
        });
      }

      const calculatedScore = calculateRiskScore(
        finalConfidentialityScore,
        finalIntegrityScore,
        finalAvailabilityScore,
        finalLikelihood
      );

      const mitigatedScore = calculateMitigatedScore(
        mitigatedConfidentialityScore,
        mitigatedIntegrityScore,
        mitigatedAvailabilityScore,
        mitigatedLikelihood
      );

      // Validate mutually exclusive asset/category linkage
      if (assetId && assetCategoryId) {
        return res.status(400).json({
          error: 'Risk can be linked to either an asset or an asset category, not both',
        });
      }

      // Handle missing interestedPartyId - get or create "Unspecified" party
      let finalInterestedPartyId = interestedPartyId;
      if (!finalInterestedPartyId) {
        let unspecifiedParty = await prisma.interestedParty.findUnique({
          where: { name: 'Unspecified' },
        });
        if (!unspecifiedParty) {
          unspecifiedParty = await prisma.interestedParty.create({
            data: {
              id: randomUUID(),
              name: 'Unspecified',
              updatedAt: new Date(),
            },
          });
        }
        finalInterestedPartyId = unspecifiedParty.id;
      }

      const risk = await prisma.risk.create({
        data: {
          id: randomUUID(),
          title,
          description,
          dateAdded: dateAdded ? new Date(dateAdded) : undefined,
          riskCategory: riskCategory as any, // Type will be correct after TS server restart
          riskNature: riskNature as any, // Type will be correct after TS server restart
          archived: archived ?? false,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          lastReviewDate: lastReviewDate ? new Date(lastReviewDate) : null,
          nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null,
          ownerUserId: finalOwnerUserId,
          department: finalDepartment,
          status: finalStatus,
          wizardData: finalWizardData,
          assetCategory, // Keep for backward compatibility
          assetId: assetId || null,
          assetCategoryId: assetCategoryId || null,
          interestedPartyId: finalInterestedPartyId,
          threatDescription,
          confidentialityScore: finalConfidentialityScore,
          integrityScore: finalIntegrityScore,
          availabilityScore: finalAvailabilityScore,
          riskScore: riskScore ?? calculatedScore,
          likelihood: finalLikelihood,
          calculatedScore,
          initialRiskTreatmentCategory,
          mitigatedConfidentialityScore,
          mitigatedIntegrityScore,
          mitigatedAvailabilityScore,
          mitigatedRiskScore,
          mitigatedLikelihood,
          mitigatedScore,
          mitigationImplemented: mitigationImplemented ?? false,
          mitigationDescription,
          existingControlsDescription,
          residualRiskTreatmentCategory,
          annexAControlsRaw,
          isSupplierRisk: isSupplierRisk ?? false,
          updatedAt: new Date(),
        } as any, // Temporary: TypeScript types need server restart to pick up new Prisma schema
      });

      // Parse and update control associations
      if (annexAControlsRaw) {
        const controlCodes = parseControlCodes(annexAControlsRaw);
        await updateRiskControls(risk.id, controlCodes);
      }

      // Compute and store embedding as best-effort side effect (after DB write, non-blocking)
      // Risk creation succeeds even if embedding fails
      computeAndStoreEmbedding(risk.id, title, threatDescription, description).catch((error) => {
        console.error(`[Risk Create] Failed to compute embedding for risk ${risk.id}:`, error.message);
      });

      // Fetch risk with controls and owner
      const riskWithControls = await prisma.risk.findUnique({
        where: { id: risk.id },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          riskControls: {
            include: {
              control: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      const riskWithLevel = {
        ...riskWithControls,
        riskLevel: getRiskLevel(risk.calculatedScore),
        mitigatedRiskLevel: risk.mitigatedScore ? getRiskLevel(risk.mitigatedScore) : null,
      };

      res.status(201).json(riskWithLevel);
    } catch (error) {
      console.error('Error creating risk:', error);
      res.status(500).json({ error: 'Failed to create risk' });
    }
  }
);

// PUT /api/risks/:id - update risk
router.put(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR', 'CONTRIBUTOR'),
  [
    param('id').isUUID(),
    body('title').optional().notEmpty().trim(),
    body('description').optional().isString(),
    body('dateAdded').optional().isISO8601().toDate(),
    body('riskCategory').optional().isIn(['INFORMATION_SECURITY', 'OPERATIONAL', 'FINANCIAL', 'COMPLIANCE', 'REPUTATIONAL', 'STRATEGIC', 'OTHER']),
    body('riskNature').optional().isIn(['STATIC', 'INSTANCE']),
    body('archived').optional().isBoolean(),
    body('expiryDate').optional().isISO8601().toDate(),
    body('lastReviewDate').optional().isISO8601().toDate(),
    body('nextReviewDate').optional().isISO8601().toDate(),
    body('ownerUserId').optional().isUUID(),
    body('assetCategory').optional().isString(),
    body('assetId').optional().isUUID(),
    body('assetCategoryId').optional().isUUID(),
    body('interestedPartyId').optional().isUUID(),
    body('threatDescription').optional().isString(),
    body('confidentialityScore').optional().isInt({ min: 1, max: 5 }),
    body('integrityScore').optional().isInt({ min: 1, max: 5 }),
    body('availabilityScore').optional().isInt({ min: 1, max: 5 }),
    body('riskScore').optional().isInt({ min: 1 }),
    body('likelihood').optional().isInt({ min: 1, max: 5 }),
    body('initialRiskTreatmentCategory').optional().isIn(['RETAIN', 'MODIFY', 'SHARE', 'AVOID']),
    body('mitigatedConfidentialityScore').optional().isInt({ min: 1, max: 5 }),
    body('mitigatedIntegrityScore').optional().isInt({ min: 1, max: 5 }),
    body('mitigatedAvailabilityScore').optional().isInt({ min: 1, max: 5 }),
    body('mitigatedRiskScore').optional().isInt({ min: 1, max: 75 }),
    body('mitigatedLikelihood').optional().isInt({ min: 1, max: 5 }),
    body('mitigationImplemented').optional().isBoolean(),
    body('mitigationDescription').optional().isString(),
    body('existingControlsDescription').optional().isString(),
    body('residualRiskTreatmentCategory').optional().isIn(['RETAIN', 'MODIFY', 'SHARE', 'AVOID']),
    body('annexAControlsRaw').optional().isString(),
    body('status').optional().isIn(['DRAFT', 'PROPOSED', 'ACTIVE', 'REJECTED', 'ARCHIVED']),
    body('department').optional().isIn(['BUSINESS_STRATEGY', 'FINANCE', 'HR', 'OPERATIONS', 'PRODUCT', 'MARKETING', null]),
    body('wizardData').optional().isString(),
    body('rejectionReason').optional().isString(),
    body('mergedIntoRiskId').optional().isUUID(),
    body('isSupplierRisk').optional().isBoolean(),
    query('testDepartment').optional().isIn(['BUSINESS_STRATEGY', 'FINANCE', 'HR', 'OPERATIONS', 'PRODUCT', 'MARKETING']),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Get user from database
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      const userRole = user.role as string;
      const userDepartment = user.department;

      const { id } = req.params;
      const updateData: any = { ...req.body };

      // Get existing risk to check permissions and riskNature for validation
      const existing = await prisma.risk.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Risk not found' });
      }

      // Check if this is a test scenario: ADMIN user testing as CONTRIBUTOR
      // Check if testDepartment query parameter is provided (sent from frontend when testing)
      const testDepartment = req.query.testDepartment as string | undefined;
      const riskDepartment = (existing as any).department || null;
      
      // Determine if we're in test mode: ADMIN with testDepartment provided
      const isTestingAsContributor = userRole === 'ADMIN' && testDepartment;
      
      // Permission checks for Contributors (real or testing)
      if (userRole === 'CONTRIBUTOR' || isTestingAsContributor) {
        let effectiveDepartment: string | null = null;
        
        if (isTestingAsContributor && testDepartment) {
          // ADMIN testing as CONTRIBUTOR - use test department from query
          effectiveDepartment = testDepartment;
        } else if (userRole === 'CONTRIBUTOR') {
          // Real CONTRIBUTOR - use database department
          // Check if Contributor has a department assigned
          if (!userDepartment) {
            return res.status(403).json({ error: 'Contributors must have a department assigned' });
          }
          effectiveDepartment = userDepartment;
        }
        
        // Contributors can only edit risks from their department
        // For testing: check if risk's department matches test department
        // For real Contributors: check if risk's department matches user's department
        // Allow editing if department matches OR if risk has no department (for backward compatibility)
        if (riskDepartment !== null && riskDepartment !== effectiveDepartment) {
          return res.status(403).json({ 
            error: 'You can only edit risks from your department',
            details: { riskDepartment, effectiveDepartment, isTesting: isTestingAsContributor }
          });
        }

        // Contributors cannot set status to ACTIVE
        if (updateData.status === 'ACTIVE') {
          return res.status(403).json({ error: 'Contributors cannot set risk status to ACTIVE' });
        }

        // Ensure department remains unchanged for Contributors (use effective department for testing)
        updateData.department = effectiveDepartment;
      }

      // Determine riskNature (use updated value if provided, otherwise existing)
      const riskNature = updateData.riskNature ?? (existing as any).riskNature; // Type will be correct after TS server restart

      // Business logic validation: expiryDate only for INSTANCE, review dates only for STATIC
      if (riskNature === 'STATIC' && updateData.expiryDate !== undefined) {
        return res.status(400).json({
          error: 'Expiry date cannot be set for STATIC risks. Use review dates instead.',
        });
      }
      if (riskNature === 'INSTANCE' && (updateData.lastReviewDate !== undefined || updateData.nextReviewDate !== undefined)) {
        return res.status(400).json({
          error: 'Review dates cannot be set for INSTANCE risks. Use expiry date instead.',
        });
      }

      // Validate mutually exclusive asset/category linkage
      if (updateData.assetId && updateData.assetCategoryId) {
        return res.status(400).json({
          error: 'Risk can be linked to either an asset or an asset category, not both',
        });
      }

      // Handle date conversions
      if (updateData.dateAdded) {
        updateData.dateAdded = new Date(updateData.dateAdded);
      }
      if (updateData.expiryDate !== undefined) {
        updateData.expiryDate = updateData.expiryDate ? new Date(updateData.expiryDate) : null;
      }
      if (updateData.lastReviewDate !== undefined) {
        updateData.lastReviewDate = updateData.lastReviewDate ? new Date(updateData.lastReviewDate) : null;
      }
      if (updateData.nextReviewDate !== undefined) {
        updateData.nextReviewDate = updateData.nextReviewDate ? new Date(updateData.nextReviewDate) : null;
      }

      // Handle assetId and assetCategoryId - set to null if explicitly cleared
      if (updateData.assetId === '') {
        updateData.assetId = null;
      }
      if (updateData.assetCategoryId === '') {
        updateData.assetCategoryId = null;
      }

      // Recalculate initial score if CIA or likelihood changed
      if (
        updateData.confidentialityScore !== undefined ||
        updateData.integrityScore !== undefined ||
        updateData.availabilityScore !== undefined ||
        updateData.likelihood !== undefined
      ) {
        if (existing) {
          const confidentiality =
            updateData.confidentialityScore ?? existing.confidentialityScore;
          const integrity = updateData.integrityScore ?? existing.integrityScore;
          const availability = updateData.availabilityScore ?? existing.availabilityScore;
          const likelihood = updateData.likelihood ?? existing.likelihood;

          updateData.calculatedScore = calculateRiskScore(
            confidentiality,
            integrity,
            availability,
            likelihood
          );

          // Update riskScore if not explicitly provided
          if (updateData.riskScore === undefined) {
            updateData.riskScore = updateData.calculatedScore;
          }
        }
      }

      // Recalculate mitigated score if mitigated CIA or likelihood changed
      if (
        updateData.mitigatedConfidentialityScore !== undefined ||
        updateData.mitigatedIntegrityScore !== undefined ||
        updateData.mitigatedAvailabilityScore !== undefined ||
        updateData.mitigatedLikelihood !== undefined
      ) {
        if (existing) {
          const mc = updateData.mitigatedConfidentialityScore ?? existing.mitigatedConfidentialityScore;
          const mi = updateData.mitigatedIntegrityScore ?? existing.mitigatedIntegrityScore;
          const ma = updateData.mitigatedAvailabilityScore ?? existing.mitigatedAvailabilityScore;
          const ml = updateData.mitigatedLikelihood ?? existing.mitigatedLikelihood;

          updateData.mitigatedScore = calculateMitigatedScore(mc, mi, ma, ml);
        }
      }

      // Transform ownerUserId to Prisma relation syntax
      if (updateData.ownerUserId !== undefined) {
        if (updateData.ownerUserId === null || updateData.ownerUserId === '') {
          updateData.owner = { disconnect: true };
        } else {
          updateData.owner = { connect: { id: updateData.ownerUserId } };
        }
        delete updateData.ownerUserId;
      }

      // Transform assetId to Prisma relation syntax if needed
      if (updateData.assetId !== undefined) {
        if (updateData.assetId === null || updateData.assetId === '') {
          updateData.asset = { disconnect: true };
        } else {
          updateData.asset = { connect: { id: updateData.assetId } };
        }
        // Remove assetId since we're using relation syntax
        delete updateData.assetId;
      }

      // Transform assetCategoryId to Prisma relation syntax if needed
      if (updateData.assetCategoryId !== undefined) {
        if (updateData.assetCategoryId === null || updateData.assetCategoryId === '') {
          updateData.linkedAssetCategory = { disconnect: true };
        } else {
          updateData.linkedAssetCategory = { connect: { id: updateData.assetCategoryId } };
        }
        // Remove assetCategoryId since we're using relation syntax
        delete updateData.assetCategoryId;
      }

      // Transform interestedPartyId to Prisma relation syntax if needed
      if (updateData.interestedPartyId !== undefined) {
        updateData.interestedParty = { connect: { id: updateData.interestedPartyId } };
        delete updateData.interestedPartyId;
      }

      const risk = await prisma.risk.update({
        where: { id },
        data: updateData,
      });

      // Update control associations if annexAControlsRaw changed
      if (updateData.annexAControlsRaw !== undefined) {
        const controlCodes = parseControlCodes(updateData.annexAControlsRaw);
        await updateRiskControls(risk.id, controlCodes);
      }

      // Recompute embedding if title, threatDescription, or description changed
      // This is a best-effort side effect (after DB write, non-blocking)
      // Risk update succeeds even if embedding fails
      const textFieldsChanged = 
        updateData.title !== undefined || 
        updateData.threatDescription !== undefined || 
        updateData.description !== undefined;
      
      if (textFieldsChanged) {
        const finalTitle = updateData.title ?? existing.title;
        const finalThreatDescription = updateData.threatDescription !== undefined ? updateData.threatDescription : existing.threatDescription;
        const finalDescription = updateData.description !== undefined ? updateData.description : existing.description;
        
        computeAndStoreEmbedding(risk.id, finalTitle, finalThreatDescription, finalDescription).catch((error) => {
          console.error(`[Risk Update] Failed to compute embedding for risk ${risk.id}:`, error.message);
        });
      }

      // Fetch risk with controls and owner
      const riskWithControls = await prisma.risk.findUnique({
        where: { id: risk.id },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          interestedParty: {
            select: {
              id: true,
              name: true,
              group: true,
            },
          },
          riskControls: {
            include: {
              control: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      const riskWithLevel = {
        ...riskWithControls,
        riskLevel: getRiskLevel(risk.calculatedScore),
        mitigatedRiskLevel: risk.mitigatedScore ? getRiskLevel(risk.mitigatedScore) : null,
      };

      res.json(riskWithLevel);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Risk not found' });
      }
      console.error('Error updating risk:', error);
      res.status(500).json({ error: 'Failed to update risk' });
    }
  }
);

// PATCH /api/risks/:id/status - update risk status
router.patch(
  '/:id/status',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR', 'CONTRIBUTOR'),
  [
    param('id').isUUID(),
    body('status').isIn(['DRAFT', 'PROPOSED', 'ACTIVE', 'REJECTED', 'ARCHIVED']),
    body('rejectionReason').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Get user from database
      const user = await prisma.user.findUnique({
        where: { email: req.user!.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      const userRole = user.role as string;
      const { id } = req.params;
      const { status, rejectionReason } = req.body;

      // Get existing risk
      const existing = await prisma.risk.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Risk not found' });
      }

      const currentStatus = (existing as any).status || 'DRAFT';

      // Validate status transition
      if (!validateStatusTransition(currentStatus, status, userRole)) {
        return res.status(403).json({
          error: `Invalid status transition from ${currentStatus} to ${status} for role ${userRole}`,
        });
      }

      // Prepare update data
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      // Store rejection reason if status is REJECTED
      if (status === 'REJECTED' && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }

      // Update risk
      const risk = await prisma.risk.update({
        where: { id },
        data: updateData,
      });

      // Fetch risk with relations
      const riskWithRelations = await prisma.risk.findUnique({
        where: { id: risk.id },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      res.json(riskWithRelations);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Risk not found' });
      }
      console.error('Error updating risk status:', error);
      res.status(500).json({ error: 'Failed to update risk status' });
    }
  }
);

// POST /api/risks/:id/merge - merge duplicate risk
router.post(
  '/:id/merge',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('targetRiskId').isUUID(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { targetRiskId } = req.body;

      // Get existing risk
      const existing = await prisma.risk.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Risk not found' });
      }

      // Get target risk
      const targetRisk = await prisma.risk.findUnique({ where: { id: targetRiskId } });
      if (!targetRisk) {
        return res.status(404).json({ error: 'Target risk not found' });
      }

      // Validate target risk is ACTIVE
      const targetStatus = (targetRisk as any).status || 'DRAFT';
      if (targetStatus !== 'ACTIVE') {
        return res.status(400).json({ error: 'Target risk must be ACTIVE to merge' });
      }

      // Update current risk: set status to REJECTED, add rejection reason and mergedIntoRiskId
      const updatedRisk = await prisma.risk.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: 'Merged as duplicate',
          mergedIntoRiskId: targetRiskId,
          updatedAt: new Date(),
        },
      });

      res.json({
        message: 'Risk merged successfully',
        mergedRisk: updatedRisk,
        targetRisk: targetRisk,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Risk not found' });
      }
      console.error('Error merging risk:', error);
      res.status(500).json({ error: 'Failed to merge risk' });
    }
  }
);

// DELETE /api/risks/:id - delete risk
router.delete(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if risk exists
      const risk = await prisma.risk.findUnique({
        where: { id },
      });

      if (!risk) {
        return res.status(404).json({ error: 'Risk not found' });
      }

      // Manually delete related records in a transaction to avoid timeout
      await prisma.$transaction(async (tx) => {
        // Delete related records first (cascade deletes can timeout with many records)
        await tx.documentRisk.deleteMany({
          where: { riskId: id },
        });
        await tx.riskControl.deleteMany({
          where: { riskId: id },
        });
        await tx.legislationRisk.deleteMany({
          where: { riskId: id },
        });

        // Now delete the risk itself
        await tx.risk.delete({
          where: { id },
        });
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Risk not found' });
      }
      console.error('Error deleting risk:', error);
      res.status(500).json({ error: 'Failed to delete risk' });
    }
  }
);

// POST /api/risks/:id/controls - set control associations for risk
router.post(
  '/:id/controls',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('controlIds')
      .isArray()
      .withMessage('controlIds must be an array')
      .custom((value) => {
        if (!Array.isArray(value)) {
          throw new Error('controlIds must be an array');
        }
        // Validate each element is a UUID (skip if array is empty)
        for (const id of value) {
          if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            throw new Error(`Invalid UUID format: ${id}`);
          }
        }
        return true;
      }),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { controlIds } = req.body;

      // Validation is handled by express-validator middleware above

      // Verify risk exists
      const riskExists = await prisma.risk.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!riskExists) {
        return res.status(404).json({ error: 'Risk not found' });
      }

      // Delete existing associations
      await prisma.riskControl.deleteMany({
        where: { riskId: id },
      });

      // Create new associations
      if (Array.isArray(controlIds) && controlIds.length > 0) {
        // Type assertion: express-validator ensures these are strings
        const controlIdsArray = controlIds as string[];
        // Remove duplicates
        const uniqueControlIds = [...new Set(controlIdsArray)];

        // Verify all controls exist before creating associations
        const existingControls = await prisma.control.findMany({
          where: {
            id: { in: uniqueControlIds },
          },
          select: { id: true },
        });

        const existingControlIds = new Set(existingControls.map(c => c.id));
        const missingControlIds = uniqueControlIds.filter((id: string) => !existingControlIds.has(id));

        if (missingControlIds.length > 0) {
          return res.status(400).json({ 
            error: `Some controls not found: ${missingControlIds.join(', ')}` 
          });
        }

        // Only create associations if we have valid controls
        if (uniqueControlIds.length > 0) {
          try {
            // Use individual creates in a transaction instead of createMany
            // This works around potential Prisma client issues with createMany on composite keys
            await prisma.$transaction(
              uniqueControlIds.map((controlId: string) =>
                prisma.riskControl.create({
                  data: {
                    riskId: id,
                    controlId: controlId,
                  },
                })
              ) as any
            );
          } catch (createError: any) {
            console.error('Error creating risk-control associations:', createError);
            console.error('Error details:', {
              code: createError.code,
              meta: createError.meta,
              message: createError.message,
            });
            // If it's a unique constraint error, it means duplicates somehow got through
            if (createError.code === 'P2002') {
              return res.status(400).json({ 
                error: 'Duplicate control associations detected',
                details: createError.meta,
              });
            }
            throw createError; // Re-throw to be caught by outer catch
          }
        }
      }

      // Update control applicability - ensure this happens before response
      try {
        const { updateControlApplicability } = await import('../services/riskService');
        await updateControlApplicability();
        console.log(`[RISK-CONTROL] Updated control applicability after linking controls to risk ${id}`);
      } catch (updateError: any) {
        console.error('[RISK-CONTROL] Error updating control applicability:', updateError);
        console.error('[RISK-CONTROL] Error details:', {
          message: updateError.message,
          code: updateError.code,
          meta: updateError.meta,
        });
        // Don't fail the request if this fails - it's a background update
        // But log it so we can debug
      }

      const risk = await prisma.risk.findUnique({
        where: { id },
        include: {
          riskControls: {
            include: {
              control: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      if (!risk) {
        return res.status(404).json({ error: 'Risk not found after update' });
      }

      res.json(risk);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Risk not found' });
      }
      console.error('Error updating risk controls:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        code: error.code,
        meta: error.meta,
        message: error.message,
        name: error.name,
      });
      res.status(500).json({ 
        error: 'Failed to update risk controls',
        message: error.message,
        code: error.code,
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          code: error.code,
          meta: error.meta,
          stack: error.stack,
        } : undefined,
      });
    }
  }
);

// POST /api/risks/suggest-controls - AI-based control suggestions using semantic similarity
router.post(
  '/suggest-controls',
  authenticateToken,
  [
    body('title').optional().isString(),
    body('description').optional().isString(),
    body('threatDescription').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, threatDescription } = req.body;

      // Combine all text fields for analysis
      const riskText = normalizeRiskText(
        title || '',
        threatDescription || null,
        description || null
      );

      if (!riskText || riskText.trim().length === 0) {
        return res.status(400).json({ error: 'No text provided for analysis' });
      }

      // Generate embedding for the risk text
      const riskEmbedding = await generateEmbedding(riskText);
      if (!riskEmbedding) {
        // Fallback to keyword-based matching if embeddings fail
        console.warn('[Control Suggestions] Embedding generation failed, falling back to keyword matching');
        return res.status(500).json({ error: 'Failed to generate embeddings. Please ensure the embedding model is configured.' });
      }

      // Get all controls with their stored embeddings and text fields for keyword matching
      const allControls = await prisma.control.findMany({
        where: {
          isStandardControl: true, // Focus on ISO 27002 controls
          embedding: { not: null }, // Only include controls with pre-computed embeddings
        },
        select: {
          id: true,
          code: true,
          title: true,
          embedding: true,
        },
      });

      // Extract keywords from risk text for boosting
      const riskTextLower = riskText.toLowerCase();
      const riskWords = riskTextLower
        .split(/\s+/)
        .filter((word) => word.length > 4) // Focus on meaningful words
        .map((word) => word.replace(/[^\w]/g, '')); // Remove punctuation

      // Detect supplier-related risks
      const supplierKeywords = ['supplier', 'vendor', 'third-party', 'third party', 'external party', 
                               'external provider', 'outsource', 'contractor', 'partner', 'service provider',
                               'cloud provider', 'subcontractor', 'sub-supplier', 'agreement', 'contract'];
      const hasSupplierIndicators = supplierKeywords.some(keyword => riskTextLower.includes(keyword));
      
      // Also check for patterns indicating external storage or management
      // This helps catch risks like "Documentation stored at JR Chesham..." or "managed by [company]"
      const externalLocationPatterns = [
        'stored at', 'located at', 'managed by', 'hosted by', 'provided by',
        'maintained by', 'handled by', 'processed by', 'accessed by'
      ];
      const hasExternalLocation = externalLocationPatterns.some(pattern => riskTextLower.includes(pattern));

      const isSupplierRelatedRisk = hasSupplierIndicators || hasExternalLocation;

      // Calculate similarity scores using stored embeddings with keyword boosting
      const controlScores: Array<{ id: string; score: number; code: string; title: string }> = [];

      for (const control of allControls) {
        // Skip controls without embeddings (shouldn't happen due to WHERE clause, but safety check)
        if (!control.embedding || !Array.isArray(control.embedding)) {
          continue;
        }

        // Calculate cosine similarity using stored embedding
        const controlEmbedding = control.embedding as number[];
        const cosineSim = cosineSimilarity(riskEmbedding, controlEmbedding);
        let similarityScore = mapToScore(cosineSim);

        // Keyword boosting: Check for exact term matches in control title/code
        const controlTextLower = `${control.code} ${control.title || ''}`.toLowerCase();
        let keywordBoost = 0;
        
        // Boost for exact keyword matches (especially important terms)
        for (const word of riskWords) {
          if (word.length > 4 && controlTextLower.includes(word)) {
            // More boost for longer, more specific words
            keywordBoost += word.length > 6 ? 8 : 5;
          }
        }
        
        // Special boost for common security/risk terms that appear in both
        const importantTerms = ['capacity', 'availability', 'monitoring', 'performance', 
                               'service', 'system', 'resource', 'failure', 'outage', 
                               'transaction', 'access', 'security', 'incident'];
        for (const term of importantTerms) {
          if (riskTextLower.includes(term) && controlTextLower.includes(term)) {
            keywordBoost += 10; // Significant boost for matching important terms
          }
        }

        // Special boost for supplier relationship controls when supplier-related risks are detected
        const supplierControlCodes = ['5.19', '5.20', '5.21', '5.22'];
        if (isSupplierRelatedRisk && supplierControlCodes.includes(control.code)) {
          keywordBoost += 25; // Strong boost for supplier controls when supplier risk is detected
        }

        // Apply keyword boost (cap at +30 points to allow for supplier control boosting)
        similarityScore = Math.min(100, similarityScore + Math.min(keywordBoost, 30));

        // Lower threshold to 55% to catch more relevant matches, but still maintain quality
        // Controls with keyword matches get boosted, so they're more likely to pass threshold
        if (similarityScore >= 55) {
          controlScores.push({
            id: control.id,
            score: similarityScore,
            code: control.code,
            title: control.title || '',
          });
        }
      }

      // Sort by similarity score (descending) and limit to top 8 suggestions
      // Fewer suggestions but higher quality
      const sortedSuggestions = controlScores
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((item) => item.id);

      res.json({
        suggestedControlIds: sortedSuggestions,
        totalMatches: controlScores.length,
      });
    } catch (error: any) {
      console.error('Error suggesting controls:', error);
      res.status(500).json({ error: 'Failed to generate control suggestions' });
    }
  }
);

// POST /api/risks/import - bulk import from CSV
router.post(
  '/import',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  csvUpload.single('file'),
  handleMulterError,
  async (req: AuthRequest, res: Response) => {
    try {
      let result;
      
      if (req.file) {
        // File was uploaded - use the file buffer
        result = await importRisksFromCSV(req.file.buffer);
      } else if (req.body.filePath) {
        // Legacy support: file path provided in body
        const csvPath = req.body.filePath;
        if (!fs.existsSync(csvPath)) {
          return res.status(400).json({ error: `CSV file not found: ${csvPath}` });
        }
        result = await importRisksFromCSV(csvPath);
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
      console.error('Error importing risks:', error);
      res.status(500).json({ error: error.message || 'Failed to import risks' });
    }
  }
);

// POST /api/risks/check-similarity - check similarity for a new risk being created/edited
// This route must come before /:id/similar to avoid route conflicts
router.post(
  '/check-similarity',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('title').isString().notEmpty(),
    body('threatDescription').optional().isString(),
    body('description').optional().isString(),
    body('excludeId').optional().isUUID(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, threatDescription, description, excludeId } = req.body;

      const similarRisks = await checkSimilarityForNewRisk(
        {
          title,
          threatDescription: threatDescription || null,
          description: description || null,
          excludeId: excludeId || undefined,
        },
        5
      );

      res.json({
        similarRisks: similarRisks.map((result) => ({
          risk: result.risk,
          similarityScore: result.score,
          matchedFields: result.fields,
        })),
      });
    } catch (error: any) {
      console.error('Error checking similarity:', error);
      res.status(500).json({ error: error.message || 'Failed to check similarity' });
    }
  }
);

// POST /api/risks/:id/similar - find similar risks for an existing risk
router.post(
  '/:id/similar',
  authenticateToken,
  [
    param('id').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const riskId = req.params.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const similarRisks = await findSimilarRisksForRisk(riskId, limit);

      res.json({
        similarRisks: similarRisks.map((result) => ({
          risk: result.risk,
          similarityScore: result.score,
          matchedFields: result.fields,
        })),
      });
    } catch (error: any) {
      console.error('Error finding similar risks:', error);
      res.status(500).json({ error: error.message || 'Failed to find similar risks' });
    }
  }
);

// GET /api/risks/:id/suppliers - List suppliers linked to this risk
router.get(
  '/:id/suppliers',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const links = await prisma.supplierRiskLink.findMany({
        where: { riskId: req.params.id },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              supplierType: true,
              criticality: true,
              status: true,
            },
          },
        },
      });

      res.json(links.map((link) => link.supplier));
    } catch (error) {
      console.error('Error fetching risk suppliers:', error);
      res.status(500).json({ error: 'Failed to fetch risk suppliers' });
    }
  }
);

// POST /api/risks/:id/suppliers - Link supplier to risk
router.post(
  '/:id/suppliers',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('supplierId').isUUID(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Verify risk exists
      const risk = await prisma.risk.findUnique({
        where: { id: req.params.id },
      });

      if (!risk) {
        return res.status(404).json({ error: 'Risk not found' });
      }

      // Verify supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: req.body.supplierId },
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      // Check if link already exists
      const existingLink = await prisma.supplierRiskLink.findUnique({
        where: {
          supplierId_riskId: {
            supplierId: req.body.supplierId,
            riskId: req.params.id,
          },
        },
      });

      if (existingLink) {
        return res.status(400).json({ error: 'Supplier is already linked to this risk' });
      }

      // Create link
      await prisma.supplierRiskLink.create({
        data: {
          supplierId: req.body.supplierId,
          riskId: req.params.id,
        },
      });

      // Optionally mark risk as supplier risk
      if (!risk.isSupplierRisk) {
        await prisma.risk.update({
          where: { id: req.params.id },
          data: { isSupplierRisk: true },
        });
      }

      // Return the linked supplier
      const linkedSupplier = await prisma.supplier.findUnique({
        where: { id: req.body.supplierId },
        select: {
          id: true,
          name: true,
          supplierType: true,
          criticality: true,
          status: true,
        },
      });

      res.status(201).json(linkedSupplier);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Supplier is already linked to this risk' });
      }
      console.error('Error linking supplier to risk:', error);
      res.status(500).json({ error: 'Failed to link supplier to risk' });
    }
  }
);

export { router as risksRouter };

