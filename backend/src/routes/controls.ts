import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { updateControlApplicability } from '../services/riskService';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/controls - list controls
router.get(
  '/',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('isApplicable').optional().isBoolean(),
    query('category').optional().isIn(['ORGANIZATIONAL', 'PEOPLE', 'PHYSICAL', 'TECHNOLOGICAL']),
    query('selectionReason').optional().isIn(['RISK_ASSESSMENT', 'CONTRACTUAL_OBLIGATION', 'LEGAL_REQUIREMENT', 'BUSINESS_REQUIREMENT']),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        page = '1',
        limit = '50',
        isApplicable,
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      
      // Filter by specific selection reason if provided (takes precedence)
      if (req.query.selectionReason) {
        const reason = req.query.selectionReason as string;
        switch (reason) {
          case 'RISK_ASSESSMENT':
            where.selectedForRiskAssessment = true;
            break;
          case 'CONTRACTUAL_OBLIGATION':
            where.selectedForContractualObligation = true;
            break;
          case 'LEGAL_REQUIREMENT':
            where.selectedForLegalRequirement = true;
            break;
          case 'BUSINESS_REQUIREMENT':
            where.selectedForBusinessRequirement = true;
            break;
        }
      } else if (isApplicable !== undefined) {
        // Filter by any selection reason (if control is selected for any reason)
        const isApplicableBool = isApplicable === 'true';
        if (isApplicableBool) {
          // Control is applicable if any selection reason is true
          where.OR = [
            { selectedForRiskAssessment: true },
            { selectedForContractualObligation: true },
            { selectedForLegalRequirement: true },
            { selectedForBusinessRequirement: true },
          ];
        } else {
          // Control is not applicable if all selection reasons are false
          where.AND = [
            { selectedForRiskAssessment: false },
            { selectedForContractualObligation: false },
            { selectedForLegalRequirement: false },
            { selectedForBusinessRequirement: false },
          ];
        }
      }
      
      // Add category filter if provided (combines with above filters)
      if (req.query.category) {
        // If we already have OR or AND, we need to wrap everything
        if (where.OR || where.AND) {
          const existingCondition = where.OR ? { OR: where.OR } : { AND: where.AND };
          delete where.OR;
          delete where.AND;
          where.AND = [
            existingCondition,
            { category: req.query.category },
          ];
        } else {
          where.category = req.query.category;
        }
      }

      // Debug: log the where clause in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Controls query where clause:', JSON.stringify(where, null, 2));
      }

      const [controls, total] = await Promise.all([
        prisma.control.findMany({
          where,
          include: {
            riskControls: {
              include: {
                risk: {
                  select: {
                    id: true,
                    title: true,
                    externalId: true,
                  },
                },
              },
            },
            documentControls: {
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
          skip,
          take: limitNum,
          orderBy: {
            code: 'asc',
          },
        }),
        prisma.control.count({ where }),
      ]);

      res.json({
        data: controls,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error('Error fetching controls:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack,
      });
      res.status(500).json({ 
        error: 'Failed to fetch controls',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// GET /api/controls/:id - get control details
router.get(
  '/:id',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const control = await prisma.control.findUnique({
        where: { id },
        include: {
          riskControls: {
            include: {
              risk: {
                select: {
                  id: true,
                  title: true,
                  externalId: true,
                  calculatedScore: true,
                },
              },
            },
          },
          documentControls: {
            include: {
              document: {
                select: {
                  id: true,
                  title: true,
                  version: true,
                  type: true,
                },
              },
            },
          },
        },
      });

      if (!control) {
        return res.status(404).json({ error: 'Control not found' });
      }

      res.json(control);
    } catch (error) {
      console.error('Error fetching control:', error);
      res.status(500).json({ error: 'Failed to fetch control' });
    }
  }
);

// GET /api/controls/:id/links - get linked risks and documents
router.get(
  '/:id/links',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const control = await prisma.control.findUnique({
        where: { id },
        include: {
          riskControls: {
            include: {
              risk: true,
            },
          },
          documentControls: {
            include: {
              document: true,
            },
          },
        },
      });

      if (!control) {
        return res.status(404).json({ error: 'Control not found' });
      }

      res.json({
        risks: control.riskControls.map((rc) => rc.risk),
        documents: control.documentControls.map((dc) => dc.document),
      });
    } catch (error) {
      console.error('Error fetching control links:', error);
      res.status(500).json({ error: 'Failed to fetch control links' });
    }
  }
);

// POST /api/controls - create control
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    body('code').notEmpty().trim(),
    body('title').notEmpty().trim(),
    body('description').optional().isString(),
    body('selectedForContractualObligation').optional().isBoolean(),
    body('selectedForLegalRequirement').optional().isBoolean(),
    body('selectedForBusinessRequirement').optional().isBoolean(),
    body('justification').optional().isString(),
    body('controlText').optional().isString(),
    body('purpose').optional().isString(),
    body('guidance').optional().isString(),
    body('otherInformation').optional().isString(),
    body('category').optional().isIn(['ORGANIZATIONAL', 'PEOPLE', 'PHYSICAL', 'TECHNOLOGICAL']),
    body('isStandardControl').optional().isBoolean(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Prevent creating controls with ISO 27002 codes if they already exist as standard controls
      const code = req.body.code as string;
      const existingStandard = await prisma.control.findUnique({
        where: { code },
        select: { isStandardControl: true },
      });
      
      if (existingStandard?.isStandardControl) {
        return res.status(409).json({ 
          error: 'A standard ISO 27002 control with this code already exists. Standard controls cannot be recreated.' 
        });
      }

      const control = await prisma.control.create({
        data: req.body,
      });

      res.status(201).json(control);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Control code already exists' });
      }
      console.error('Error creating control:', error);
      res.status(500).json({ error: 'Failed to create control' });
    }
  }
);

// PUT /api/controls/:id - update control
router.put(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('code').optional().notEmpty().trim(),
    body('title').optional().notEmpty().trim(),
    body('description').optional().isString(),
    body('selectedForContractualObligation').optional().isBoolean(),
    body('selectedForLegalRequirement').optional().isBoolean(),
    body('selectedForBusinessRequirement').optional().isBoolean(),
    body('justification').optional().isString(),
    body('controlText').optional().isString(),
    body('purpose').optional().isString(),
    body('guidance').optional().isString(),
    body('otherInformation').optional().isString(),
    body('category').optional().isIn(['ORGANIZATIONAL', 'PEOPLE', 'PHYSICAL', 'TECHNOLOGICAL']),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if this is a standard control
      const existing = await prisma.control.findUnique({
        where: { id },
        select: { isStandardControl: true },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Control not found' });
      }

      // For standard controls, only allow updating specific fields
      if (existing.isStandardControl) {
        const allowedFields = [
          'selectedForContractualObligation',
          'selectedForLegalRequirement',
          'selectedForBusinessRequirement',
          'justification'
        ];
        const updateData: any = {};
        
        // Only include allowed fields
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updateData[field] = req.body[field];
          }
        }

        // Block attempts to modify standard control fields
        const blockedFields = [
          'code',
          'title',
          'controlText',
          'purpose',
          'guidance',
          'otherInformation',
          'category',
          'isStandardControl',
          'selectedForRiskAssessment' // This is auto-computed from risk relationships
        ];
        for (const field of blockedFields) {
          if (req.body[field] !== undefined) {
            return res.status(403).json({ 
              error: `Cannot modify ${field} for standard ISO 27002 controls. Only selection reasons (Contractual Obligation, Legal Requirement, Business Requirement) and justification can be modified. Risk Assessment is automatically set based on risk relationships.` 
            });
          }
        }

        const control = await prisma.control.update({
          where: { id },
          data: updateData,
        });

        return res.json(control);
      } else {
        // Non-standard controls can be fully updated, except Risk Assessment (auto-computed)
        const updateData: any = { ...req.body };
        // Remove Risk Assessment from update data - it's auto-computed
        delete updateData.selectedForRiskAssessment;

        const control = await prisma.control.update({
          where: { id },
          data: updateData,
        });

        return res.json(control);
      }
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Control not found' });
      }
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Control code already exists' });
      }
      console.error('Error updating control:', error);
      res.status(500).json({ error: 'Failed to update control' });
    }
  }
);

export { router as controlsRouter };

