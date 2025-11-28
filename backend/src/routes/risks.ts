import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
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
    query('riskType').optional().isString(),
    query('ownerId').optional().isUUID(),
    query('treatmentCategory').optional().isIn(['RETAIN', 'MODIFY', 'SHARE', 'AVOID']),
    query('mitigationImplemented').optional().isBoolean(),
    query('riskLevel').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    query('search').optional().isString(),
    query('dateAddedFrom').optional().isISO8601(),
    query('dateAddedTo').optional().isISO8601(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        page = '1',
        limit = '20',
        sortBy = 'calculatedScore',
        sortOrder = 'desc',
        riskType,
        ownerId,
        treatmentCategory,
        mitigationImplemented,
        riskLevel,
        search,
        dateAddedFrom,
        dateAddedTo,
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause for filtering
      const where: any = {};
      if (riskType) where.riskType = riskType;
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
    body('riskType').optional().isIn(['INFORMATION_SECURITY', 'OPERATIONAL', 'FINANCIAL', 'COMPLIANCE', 'REPUTATIONAL', 'STRATEGIC', 'OTHER']),
    body('ownerUserId').optional().isUUID(),
    body('assetCategory').optional().isString(),
    body('interestedParty').optional().isString(),
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
    body('mitigatedRiskScore').optional().isInt({ min: 1, max: 5 }),
    body('mitigatedLikelihood').optional().isInt({ min: 1, max: 5 }),
    body('mitigationImplemented').optional().isBoolean(),
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
        riskType,
        ownerUserId,
        assetCategory,
        interestedParty,
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
        residualRiskTreatmentCategory,
        annexAControlsRaw,
      } = req.body;

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

      const risk = await prisma.risk.create({
        data: {
          title,
          description,
          externalId,
          dateAdded: dateAdded ? new Date(dateAdded) : undefined,
          riskType,
          ownerUserId,
          assetCategory,
          interestedParty,
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
          residualRiskTreatmentCategory,
          annexAControlsRaw,
        },
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
    body('riskType').optional().isIn(['INFORMATION_SECURITY', 'OPERATIONAL', 'FINANCIAL', 'COMPLIANCE', 'REPUTATIONAL', 'STRATEGIC', 'OTHER']),
    body('ownerUserId').optional().isUUID(),
    body('assetCategory').optional().isString(),
    body('interestedParty').optional().isString(),
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
    body('mitigatedRiskScore').optional().isInt({ min: 1, max: 5 }),
    body('mitigatedLikelihood').optional().isInt({ min: 1, max: 5 }),
    body('mitigationImplemented').optional().isBoolean(),
    body('residualRiskTreatmentCategory').optional().isIn(['RETAIN', 'MODIFY', 'SHARE', 'AVOID']),
    body('annexAControlsRaw').optional().isString(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updateData: any = { ...req.body };

      // Handle dateAdded conversion
      if (updateData.dateAdded) {
        updateData.dateAdded = new Date(updateData.dateAdded);
      }

      // Recalculate initial score if CIA or likelihood changed
      if (
        updateData.confidentialityScore !== undefined ||
        updateData.integrityScore !== undefined ||
        updateData.availabilityScore !== undefined ||
        updateData.likelihood !== undefined
      ) {
        const existing = await prisma.risk.findUnique({ where: { id } });
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
        const existing = await prisma.risk.findUnique({ where: { id } });
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
    body('controlIds').isArray(),
    body('controlIds.*').isUUID(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { controlIds } = req.body;

      // Delete existing associations
      await prisma.riskControl.deleteMany({
        where: { riskId: id },
      });

      // Create new associations
      if (controlIds.length > 0) {
        await prisma.riskControl.createMany({
          data: controlIds.map((controlId: string) => ({
            riskId: id,
            controlId,
          })),
        });
      }

      // Update control applicability
      const { updateControlApplicability } = await import('../services/riskService');
      await updateControlApplicability();

      const risk = await prisma.risk.findUnique({
        where: { id },
        include: {
          riskControls: {
            include: {
              control: true,
            },
          },
        },
      });

      res.json(risk);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Risk not found' });
      }
      console.error('Error updating risk controls:', error);
      res.status(500).json({ error: 'Failed to update risk controls' });
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

