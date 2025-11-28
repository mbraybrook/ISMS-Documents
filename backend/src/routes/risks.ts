import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import {
  calculateRiskScore,
  calculateMitigatedScore,
  getRiskLevel,
  parseControlCodes,
  updateRiskControls,
} from '../services/riskService';

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
    query('riskLevel').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    query('search').optional().isString(),
    query('dateAddedFrom').optional().isISO8601(),
    query('dateAddedTo').optional().isISO8601(),
    query('assetId').optional().isUUID(),
    query('assetCategoryId').optional().isUUID(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
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
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause for filtering
      const where: any = {};
      if (riskCategory) where.riskCategory = riskCategory;
      if (riskNature) where.riskNature = riskNature;
      // Default to showing non-archived risks unless explicitly requested
      if (archived !== undefined) {
        where.archived = archived === 'true';
      } else {
        where.archived = false;
      }
      if (ownerId) where.ownerUserId = ownerId;
      if (mitigationImplemented !== undefined) {
        where.mitigationImplemented = mitigationImplemented === 'true';
      }
      
      // Handle search query - search in title and description
      // Note: SQLite doesn't support case-insensitive mode, so we'll do case-insensitive filtering in the application
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
          documentRisks: {
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
  requireRole('ADMIN', 'EDITOR'),
  [
    body('title').notEmpty().trim(),
    body('description').optional().isString(),
    body('externalId').optional().isString(),
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
    body('confidentialityScore').isInt({ min: 1, max: 5 }),
    body('integrityScore').isInt({ min: 1, max: 5 }),
    body('availabilityScore').isInt({ min: 1, max: 5 }),
    body('riskScore').optional().isInt({ min: 1 }),
    body('likelihood').isInt({ min: 1, max: 5 }),
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
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        title,
        description,
        externalId,
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
        residualRiskTreatmentCategory,
        annexAControlsRaw,
      } = req.body;

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
        confidentialityScore,
        integrityScore,
        availabilityScore,
        likelihood
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

      const risk = await prisma.risk.create({
        data: {
          id: randomUUID(),
          title,
          description,
          externalId,
          dateAdded: dateAdded ? new Date(dateAdded) : undefined,
          riskCategory: riskCategory as any, // Type will be correct after TS server restart
          riskNature: riskNature as any, // Type will be correct after TS server restart
          archived: archived ?? false,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          lastReviewDate: lastReviewDate ? new Date(lastReviewDate) : null,
          nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null,
          ownerUserId,
          assetCategory, // Keep for backward compatibility
          assetId: assetId || null,
          assetCategoryId: assetCategoryId || null,
          interestedPartyId,
          threatDescription,
          confidentialityScore,
          integrityScore,
          availabilityScore,
          riskScore: riskScore ?? calculatedScore,
          likelihood,
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
          residualRiskTreatmentCategory,
          annexAControlsRaw,
          updatedAt: new Date(),
        } as any, // Temporary: TypeScript types need server restart to pick up new Prisma schema
      });

      // Parse and update control associations
      if (annexAControlsRaw) {
        const controlCodes = parseControlCodes(annexAControlsRaw);
        await updateRiskControls(risk.id, controlCodes);
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
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('title').optional().notEmpty().trim(),
    body('description').optional().isString(),
    body('externalId').optional().isString(),
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
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updateData: any = { ...req.body };

      // Get existing risk to check riskNature for validation
      const existing = await prisma.risk.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Risk not found' });
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

      const risk = await prisma.risk.update({
        where: { id },
        data: updateData,
      });

      // Update control associations if annexAControlsRaw changed
      if (updateData.annexAControlsRaw !== undefined) {
        const controlCodes = parseControlCodes(updateData.annexAControlsRaw);
        await updateRiskControls(risk.id, controlCodes);
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

      // Delete the risk (cascade will handle related records)
      await prisma.risk.delete({
        where: { id },
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

      // Update control applicability
      try {
        const { updateControlApplicability } = await import('../services/riskService');
        await updateControlApplicability();
      } catch (updateError: any) {
        console.error('Error updating control applicability (non-fatal):', updateError);
        // Don't fail the request if this fails - it's a background update
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

// POST /api/risks/suggest-controls - AI-based control suggestions
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
      const combinedText = [
        title || '',
        description || '',
        threatDescription || '',
      ]
        .filter((text) => text.trim().length > 0)
        .join(' ')
        .toLowerCase();

      if (combinedText.length === 0) {
        return res.status(400).json({ error: 'No text provided for analysis' });
      }

      // Get all controls with their descriptions
      const allControls = await prisma.control.findMany({
        where: {
          isStandardControl: true, // Focus on ISO 27002 controls
        },
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          purpose: true,
          guidance: true,
        },
      });

      // Simple keyword-based matching (can be enhanced with AI/ML later)
      // Look for control codes and keywords in the text
      const suggestedControlIds: string[] = [];

      for (const control of allControls) {
        let score = 0;
        const controlText = [
          control.code,
          control.title || '',
          control.description || '',
          control.purpose || '',
          control.guidance || '',
        ]
          .join(' ')
          .toLowerCase();

        // Check if control code appears in text
        if (combinedText.includes(control.code.toLowerCase())) {
          score += 10;
        }

        // Check for keyword matches
        const keywords = controlText.split(/\s+/).filter((word) => word.length > 4);
        for (const keyword of keywords) {
          if (combinedText.includes(keyword)) {
            score += 1;
          }
        }

        // Check for common security terms
        const securityTerms = [
          'access',
          'authentication',
          'authorization',
          'encryption',
          'backup',
          'disaster',
          'incident',
          'vulnerability',
          'patch',
          'monitoring',
          'audit',
          'compliance',
          'policy',
          'procedure',
          'training',
          'awareness',
        ];

        for (const term of securityTerms) {
          if (combinedText.includes(term) && controlText.includes(term)) {
            score += 2;
          }
        }

        // If score is high enough, suggest this control
        if (score >= 3) {
          suggestedControlIds.push(control.id);
        }
      }

      // Limit to top 10 suggestions
      const limitedSuggestions = suggestedControlIds.slice(0, 10);

      res.json({
        suggestedControlIds: limitedSuggestions,
        totalMatches: suggestedControlIds.length,
      });
    } catch (error) {
      console.error('Error suggesting controls:', error);
      res.status(500).json({ error: 'Failed to generate control suggestions' });
    }
  }
);

export { router as risksRouter };

