/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { computeAndStoreControlEmbedding } from '../services/embeddingService';
import { normalizeControlCode } from '../services/riskService';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('Validation errors:', JSON.stringify(errors.array(), null, 2));
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    return res.status(400).json({ 
      error: 'Validation failed',
      errors: errors.array(),
      details: errors.array().map((e: any) => `${e.param}: ${e.msg}`).join(', ')
    });
  }
  next();
};

// GET /api/controls - list controls
router.get(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('isApplicable').optional().isBoolean(),
    query('implemented').optional().isBoolean(),
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
        implemented,
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
      
      // Add implemented filter if provided
      if (implemented !== undefined) {
        const implementedBool = implemented === 'true' || (typeof implemented === 'boolean' && implemented === true);
        // If we already have OR or AND, we need to wrap everything
        if (where.OR || where.AND) {
          const existingCondition = where.OR ? { OR: where.OR } : { AND: where.AND };
          delete where.OR;
          delete where.AND;
          where.AND = [
            existingCondition,
            { implemented: implementedBool },
          ];
        } else {
          where.implemented = implementedBool;
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
          supplierControls: {
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
        risks: control.riskControls.map((rc: { risk: unknown }) => rc.risk),
        documents: control.documentControls.map((dc: { document: unknown }) => dc.document),
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
    body('justification').optional().custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      return typeof value === 'string';
    }),
    body('controlText').optional().isString(),
    body('purpose').optional().isString(),
    body('guidance').optional().isString(),
    body('otherInformation').optional().isString(),
    body('category').optional().isIn(['ORGANIZATIONAL', 'PEOPLE', 'PHYSICAL', 'TECHNOLOGICAL']),
    body('isStandardControl').optional().isBoolean(),
    body('implemented').optional().isBoolean(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Prevent creating controls with ISO 27002 codes if they already exist as standard controls
      // Check both exact code and normalized code (handles "8.25" vs "A.8.25" formats)
      const code = req.body.code as string;
      const normalizedCode = normalizeControlCode(code);
      
      const existingStandard = await prisma.control.findFirst({
        where: {
          isStandardControl: true,
          OR: [
            { code: code },
            { code: normalizedCode },
            { code: `A.${normalizedCode}` },
          ],
        },
        select: { isStandardControl: true },
      });
      
      if (existingStandard?.isStandardControl) {
        return res.status(409).json({ 
          error: 'A standard ISO 27002 control with this code already exists. Standard controls cannot be recreated.' 
        });
      }

      // Convert boolean fields explicitly
      const createData: any = { ...req.body };
      if (createData.selectedForContractualObligation !== undefined) {
        createData.selectedForContractualObligation = createData.selectedForContractualObligation === true || createData.selectedForContractualObligation === 'true';
      }
      if (createData.selectedForLegalRequirement !== undefined) {
        createData.selectedForLegalRequirement = createData.selectedForLegalRequirement === true || createData.selectedForLegalRequirement === 'true';
      }
      if (createData.selectedForBusinessRequirement !== undefined) {
        createData.selectedForBusinessRequirement = createData.selectedForBusinessRequirement === true || createData.selectedForBusinessRequirement === 'true';
      }
      if (createData.implemented !== undefined) {
        createData.implemented = createData.implemented === true || createData.implemented === 'true';
      }
      if (createData.isStandardControl !== undefined) {
        createData.isStandardControl = createData.isStandardControl === true || createData.isStandardControl === 'true';
      }

      const control = await prisma.control.create({
        data: createData,
      });

      // Compute and store embedding asynchronously (best-effort, doesn't block response)
      computeAndStoreControlEmbedding(
        control.id,
        control.code,
        control.title,
        control.description,
        control.purpose,
        control.guidance,
      ).catch((error) => {
        console.error(`[Control Embedding] Failed to compute embedding for control ${control.id}:`, error);
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
    // Boolean fields - validation removed, handled in route handler
    body('selectedForContractualObligation').optional(),
    body('selectedForLegalRequirement').optional(),
    body('selectedForBusinessRequirement').optional(),
    body('justification').optional().custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      return typeof value === 'string';
    }),
    body('controlText').optional().isString(),
    body('purpose').optional().isString(),
    body('guidance').optional().isString(),
    body('otherInformation').optional().isString(),
    body('category').optional().isIn(['ORGANIZATIONAL', 'PEOPLE', 'PHYSICAL', 'TECHNOLOGICAL']),
    body('implemented').optional(),
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
        const updateData: any = {};
        
        // Handle boolean fields with explicit conversion
        if (req.body.selectedForContractualObligation !== undefined) {
          updateData.selectedForContractualObligation = req.body.selectedForContractualObligation === true || req.body.selectedForContractualObligation === 'true';
        }
        if (req.body.selectedForLegalRequirement !== undefined) {
          updateData.selectedForLegalRequirement = req.body.selectedForLegalRequirement === true || req.body.selectedForLegalRequirement === 'true';
        }
        if (req.body.selectedForBusinessRequirement !== undefined) {
          updateData.selectedForBusinessRequirement = req.body.selectedForBusinessRequirement === true || req.body.selectedForBusinessRequirement === 'true';
        }
        if (req.body.implemented !== undefined) {
          updateData.implemented = req.body.implemented === true || req.body.implemented === 'true';
        }
        if (req.body.justification !== undefined) {
          updateData.justification = req.body.justification || null;
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

        // Note: For standard controls, we don't recompute embeddings since
        // the text fields (code, title, description, purpose, guidance) cannot be modified

        return res.json(control);
      } else {
        // Non-standard controls can be fully updated, except Risk Assessment (auto-computed)
        const updateData: any = { ...req.body };
        // Remove Risk Assessment from update data - it's auto-computed
        delete updateData.selectedForRiskAssessment;
        
        // Convert boolean fields explicitly
        if (updateData.selectedForContractualObligation !== undefined) {
          updateData.selectedForContractualObligation = updateData.selectedForContractualObligation === true || updateData.selectedForContractualObligation === 'true';
        }
        if (updateData.selectedForLegalRequirement !== undefined) {
          updateData.selectedForLegalRequirement = updateData.selectedForLegalRequirement === true || updateData.selectedForLegalRequirement === 'true';
        }
        if (updateData.selectedForBusinessRequirement !== undefined) {
          updateData.selectedForBusinessRequirement = updateData.selectedForBusinessRequirement === true || updateData.selectedForBusinessRequirement === 'true';
        }
        if (updateData.implemented !== undefined) {
          updateData.implemented = updateData.implemented === true || updateData.implemented === 'true';
        }
        if (updateData.isStandardControl !== undefined) {
          updateData.isStandardControl = updateData.isStandardControl === true || updateData.isStandardControl === 'true';
        }

        // Check if any text fields that affect embeddings are being updated
        const embeddingFields = ['code', 'title', 'description', 'purpose', 'guidance'];
        const needsEmbeddingUpdate = embeddingFields.some((field) => updateData[field] !== undefined);

        const control = await prisma.control.update({
          where: { id },
          data: updateData,
        });

        // Recompute embedding if text fields were updated
        if (needsEmbeddingUpdate) {
          computeAndStoreControlEmbedding(
            control.id,
            control.code,
            control.title,
            control.description,
            control.purpose,
            control.guidance,
          ).catch((error) => {
            console.error(`[Control Embedding] Failed to recompute embedding for control ${control.id}:`, error);
          });
        }

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

// DELETE /api/controls/:id - delete control (only custom controls)
router.delete(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check if control exists and is not a standard control
      const existing = await prisma.control.findUnique({
        where: { id },
        select: { isStandardControl: true },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Control not found' });
      }

      if (existing.isStandardControl) {
        return res.status(403).json({ 
          error: 'Cannot delete standard ISO 27002 controls. Only custom controls can be deleted.' 
        });
      }

      // Delete the control (cascade will handle related records)
      await prisma.control.delete({
        where: { id },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Control not found' });
      }
      console.error('Error deleting control:', error);
      res.status(500).json({ error: 'Failed to delete control' });
    }
  }
);

// GET /api/controls/:id/suppliers - List suppliers linked to this control
router.get(
  '/:id/suppliers',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const links = await prisma.supplierControlLink.findMany({
        where: { controlId: req.params.id },
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

      res.json(links.map((link: { supplier: unknown }) => link.supplier));
    } catch (error) {
      console.error('Error fetching control suppliers:', error);
      res.status(500).json({ error: 'Failed to fetch control suppliers' });
    }
  }
);

// POST /api/controls/:id/suppliers - Link supplier to control
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
      // Verify control exists
      const control = await prisma.control.findUnique({
        where: { id: req.params.id },
      });

      if (!control) {
        return res.status(404).json({ error: 'Control not found' });
      }

      // Verify supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: req.body.supplierId },
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      // Check if link already exists
      const existingLink = await prisma.supplierControlLink.findUnique({
        where: {
          supplierId_controlId: {
            supplierId: req.body.supplierId,
            controlId: req.params.id,
          },
        },
      });

      if (existingLink) {
        return res.status(400).json({ error: 'Supplier is already linked to this control' });
      }

      // Create link
      await prisma.supplierControlLink.create({
        data: {
          supplierId: req.body.supplierId,
          controlId: req.params.id,
        },
      });

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
        return res.status(400).json({ error: 'Supplier is already linked to this control' });
      }
      console.error('Error linking supplier to control:', error);
      res.status(500).json({ error: 'Failed to link supplier to control' });
    }
  }
);

// GET /api/controls/:id/documents - get all documents linked to a control
router.get(
  '/:id/documents',
  authenticateToken,
  [param('id').isUUID()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Verify control exists
      const control = await prisma.control.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!control) {
        return res.status(404).json({ error: 'Control not found' });
      }

      // Get all linked documents
      const documentControls = await prisma.documentControl.findMany({
        where: { controlId: id },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              version: true,
              type: true,
              status: true,
            },
          },
        },
      });

      res.json(documentControls.map((dc: { document: unknown }) => dc.document));
    } catch (error) {
      console.error('Error fetching control documents:', error);
      res.status(500).json({ error: 'Failed to fetch control documents' });
    }
  }
);

// POST /api/controls/:id/documents - link a document to a control
router.post(
  '/:id/documents',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    body('documentId').isUUID(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { documentId } = req.body;

      // Verify control exists
      const control = await prisma.control.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!control) {
        return res.status(404).json({ error: 'Control not found' });
      }

      // Verify document exists
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check if link already exists
      const existingLink = await prisma.documentControl.findUnique({
        where: {
          documentId_controlId: {
            documentId: documentId,
            controlId: id,
          },
        },
      });

      if (existingLink) {
        return res.status(400).json({ error: 'Document is already linked to this control' });
      }

      // Create link
      await prisma.documentControl.create({
        data: {
          documentId: documentId,
          controlId: id,
        },
      });

      // Return the linked document
      const linkedDocument = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          title: true,
          version: true,
          type: true,
          status: true,
        },
      });

      res.status(201).json(linkedDocument);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Document is already linked to this control' });
      }
      console.error('Error linking document to control:', error);
      res.status(500).json({ error: 'Failed to link document to control' });
    }
  }
);

// DELETE /api/controls/:id/documents/:documentId - unlink a document from a control
router.delete(
  '/:id/documents/:documentId',
  authenticateToken,
  requireRole('ADMIN', 'EDITOR'),
  [
    param('id').isUUID(),
    param('documentId').isUUID(),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id, documentId } = req.params;

      // Verify control exists
      const control = await prisma.control.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!control) {
        return res.status(404).json({ error: 'Control not found' });
      }

      // Verify document exists
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check if link exists
      const existingLink = await prisma.documentControl.findUnique({
        where: {
          documentId_controlId: {
            documentId: documentId,
            controlId: id,
          },
        },
      });

      if (!existingLink) {
        return res.status(404).json({ error: 'Document is not linked to this control' });
      }

      // Delete link
      await prisma.documentControl.delete({
        where: {
          documentId_controlId: {
            documentId: documentId,
            controlId: id,
          },
        },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Link not found' });
      }
      console.error('Error unlinking document from control:', error);
      res.status(500).json({ error: 'Failed to unlink document from control' });
    }
  }
);

export { router as controlsRouter };

