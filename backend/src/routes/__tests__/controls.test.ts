/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import { controlsRouter } from '../controls';

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      sub: 'test-user',
      email: 'test@paythru.com',
      name: 'Test User',
      oid: 'test-oid',
    };
    next();
  },
}));

// Mock authorization middleware
jest.mock('../../middleware/authorize', () => ({
  requireRole: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    control: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    supplierControlLink: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    supplier: {
      findUnique: jest.fn(),
    },
    documentControl: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock embedding service
jest.mock('../../services/embeddingService', () => ({
  computeAndStoreControlEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

describe('Controls API', () => {
  let app: express.Application;
  let prisma: any;
  let computeAndStoreControlEmbedding: jest.Mock;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/controls', controlsRouter);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    prisma = require('../../lib/prisma').prisma;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    computeAndStoreControlEmbedding = require('../../services/embeddingService').computeAndStoreControlEmbedding;
    jest.clearAllMocks();
  });

  describe('GET /api/controls', () => {
    it('should return list of controls with pagination', async () => {
      const mockControls = [
        {
          id: 'control-1',
          code: 'A.1.1',
          title: 'Test Control',
          category: 'ORGANIZATIONAL',
          implemented: true,
          riskControls: [],
          documentControls: [],
        },
      ];

      prisma.control.findMany.mockResolvedValue(mockControls);
      prisma.control.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/controls')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].code).toBe('A.1.1');
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(50);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should support pagination parameters', async () => {
      prisma.control.findMany.mockResolvedValue([]);
      prisma.control.count.mockResolvedValue(100);

      const response = await request(app)
        .get('/api/controls?page=2&limit=25')
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        })
      );
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(25);
      expect(response.body.pagination.totalPages).toBe(4);
    });

    it('should filter by isApplicable=true', async () => {
      prisma.control.findMany.mockResolvedValue([]);
      prisma.control.count.mockResolvedValue(0);

      await request(app)
        .get('/api/controls?isApplicable=true')
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { selectedForRiskAssessment: true },
              { selectedForContractualObligation: true },
              { selectedForLegalRequirement: true },
              { selectedForBusinessRequirement: true },
            ],
          }),
        })
      );
    });

    it('should filter by isApplicable=false', async () => {
      prisma.control.findMany.mockResolvedValue([]);
      prisma.control.count.mockResolvedValue(0);

      await request(app)
        .get('/api/controls?isApplicable=false')
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              { selectedForRiskAssessment: false },
              { selectedForContractualObligation: false },
              { selectedForLegalRequirement: false },
              { selectedForBusinessRequirement: false },
            ],
          }),
        })
      );
    });

    it('should filter by selectionReason=RISK_ASSESSMENT', async () => {
      prisma.control.findMany.mockResolvedValue([]);
      prisma.control.count.mockResolvedValue(0);

      await request(app)
        .get('/api/controls?selectionReason=RISK_ASSESSMENT')
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            selectedForRiskAssessment: true,
          }),
        })
      );
    });

    it('should filter by selectionReason=CONTRACTUAL_OBLIGATION', async () => {
      prisma.control.findMany.mockResolvedValue([]);
      prisma.control.count.mockResolvedValue(0);

      await request(app)
        .get('/api/controls?selectionReason=CONTRACTUAL_OBLIGATION')
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            selectedForContractualObligation: true,
          }),
        })
      );
    });

    it('should filter by selectionReason=LEGAL_REQUIREMENT', async () => {
      prisma.control.findMany.mockResolvedValue([]);
      prisma.control.count.mockResolvedValue(0);

      await request(app)
        .get('/api/controls?selectionReason=LEGAL_REQUIREMENT')
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            selectedForLegalRequirement: true,
          }),
        })
      );
    });

    it('should filter by selectionReason=BUSINESS_REQUIREMENT', async () => {
      prisma.control.findMany.mockResolvedValue([]);
      prisma.control.count.mockResolvedValue(0);

      await request(app)
        .get('/api/controls?selectionReason=BUSINESS_REQUIREMENT')
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            selectedForBusinessRequirement: true,
          }),
        })
      );
    });

    it('should filter by implemented=true', async () => {
      prisma.control.findMany.mockResolvedValue([]);
      prisma.control.count.mockResolvedValue(0);

      await request(app)
        .get('/api/controls?implemented=true')
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            implemented: true,
          }),
        })
      );
    });

    it('should filter by implemented=false', async () => {
      prisma.control.findMany.mockResolvedValue([]);
      prisma.control.count.mockResolvedValue(0);

      await request(app)
        .get('/api/controls?implemented=false')
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            implemented: false,
          }),
        })
      );
    });

    it('should filter by category', async () => {
      prisma.control.findMany.mockResolvedValue([]);
      prisma.control.count.mockResolvedValue(0);

      await request(app)
        .get('/api/controls?category=TECHNOLOGICAL')
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'TECHNOLOGICAL',
          }),
        })
      );
    });

    it('should combine multiple filters', async () => {
      prisma.control.findMany.mockResolvedValue([]);
      prisma.control.count.mockResolvedValue(0);

      await request(app)
        .get('/api/controls?category=ORGANIZATIONAL&implemented=true&isApplicable=true')
        .expect(200);

      const callArgs = prisma.control.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('AND');
      // The structure is: AND: [{AND: [{OR: [...]}, {implemented: true}]}, {category: 'ORGANIZATIONAL'}]
      expect(callArgs.where.AND).toHaveLength(2);
      expect(callArgs.where.AND[0]).toHaveProperty('AND');
      expect(callArgs.where.AND[0].AND[0]).toHaveProperty('OR');
      expect(callArgs.where.AND[0].AND[1]).toEqual({ implemented: true });
      expect(callArgs.where.AND[1]).toEqual({ category: 'ORGANIZATIONAL' });
    });

    it('should validate page parameter', async () => {
      await request(app)
        .get('/api/controls?page=0')
        .expect(400);
    });

    it('should validate limit parameter', async () => {
      await request(app)
        .get('/api/controls?limit=2000')
        .expect(400);
    });

    it('should validate category parameter', async () => {
      await request(app)
        .get('/api/controls?category=INVALID')
        .expect(400);
    });

    it('should validate selectionReason parameter', async () => {
      await request(app)
        .get('/api/controls?selectionReason=INVALID')
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      prisma.control.findMany.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/controls')
        .expect(500);

      expect(prisma.control.findMany).toHaveBeenCalled();
      
      console.error = originalError;
    });

    it('should log where clause in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalLog = console.log;
      const logSpy = jest.fn();
      console.log = logSpy;

      process.env.NODE_ENV = 'development';
      prisma.control.findMany.mockResolvedValue([]);
      prisma.control.count.mockResolvedValue(0);

      await request(app)
        .get('/api/controls')
        .expect(200);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Controls query where clause:'),
        expect.any(String)
      );

      process.env.NODE_ENV = originalEnv;
      console.log = originalLog;
    });
  });

  describe('GET /api/controls/:id', () => {
    it('should return control details with relationships', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const mockControl = {
        id: controlId,
        code: 'A.1.1',
        title: 'Test Control',
        description: 'Test Description',
        riskControls: [
          {
            risk: {
              id: 'risk-1',
              title: 'Test Risk',
              calculatedScore: 5.5,
            },
          },
        ],
        documentControls: [
          {
            document: {
              id: 'doc-1',
              title: 'Test Document',
              version: '1.0',
              type: 'POLICY',
            },
          },
        ],
        supplierControls: [
          {
            supplier: {
              id: 'supplier-1',
              name: 'Test Supplier',
              supplierType: 'VENDOR',
              criticality: 'HIGH',
              status: 'ACTIVE',
            },
          },
        ],
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);

      const response = await request(app)
        .get(`/api/controls/${controlId}`)
        .expect(200);

      expect(response.body.id).toBe(controlId);
      expect(response.body.code).toBe('A.1.1');
      expect(response.body.riskControls).toHaveLength(1);
      expect(response.body.documentControls).toHaveLength(1);
      expect(response.body.supplierControls).toHaveLength(1);
    });

    it('should return 404 for non-existent control', async () => {
      prisma.control.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/api/controls/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app)
        .get('/api/controls/invalid-id')
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      prisma.control.findUnique.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/controls/550e8400-e29b-41d4-a716-446655440001')
        .expect(500);
      
      console.error = originalError;
    });
  });

  describe('GET /api/controls/:id/links', () => {
    it('should return linked risks and documents', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const mockControl = {
        id: controlId,
        riskControls: [
          {
            risk: {
              id: 'risk-1',
              title: 'Test Risk',
            },
          },
        ],
        documentControls: [
          {
            document: {
              id: 'doc-1',
              title: 'Test Document',
            },
          },
        ],
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);

      const response = await request(app)
        .get(`/api/controls/${controlId}/links`)
        .expect(200);

      expect(response.body.risks).toHaveLength(1);
      expect(response.body.risks[0].id).toBe('risk-1');
      expect(response.body.documents).toHaveLength(1);
      expect(response.body.documents[0].id).toBe('doc-1');
    });

    it('should return 404 for non-existent control', async () => {
      prisma.control.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/api/controls/550e8400-e29b-41d4-a716-446655440000/links')
        .expect(404);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      prisma.control.findUnique.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/controls/550e8400-e29b-41d4-a716-446655440001/links')
        .expect(500);
      
      console.error = originalError;
    });
  });

  describe('POST /api/controls', () => {
    it('should create a new control', async () => {
      const newControl = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        code: 'CUSTOM.1.1',
        title: 'Custom Control',
        description: 'Custom Description',
        category: 'ORGANIZATIONAL',
        implemented: false,
        isStandardControl: false,
      };

      prisma.control.findFirst.mockResolvedValue(null); // No existing standard control
      prisma.control.create.mockResolvedValue(newControl);

      const response = await request(app)
        .post('/api/controls')
        .send({
          code: 'CUSTOM.1.1',
          title: 'Custom Control',
          description: 'Custom Description',
          category: 'ORGANIZATIONAL',
        })
        .expect(201);

      expect(response.body.code).toBe('CUSTOM.1.1');
      expect(response.body.title).toBe('Custom Control');
      expect(prisma.control.create).toHaveBeenCalled();
      expect(computeAndStoreControlEmbedding).toHaveBeenCalled();
    });

    it('should convert string booleans to actual booleans', async () => {
      const newControl = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        code: 'CUSTOM.1.2',
        title: 'Custom Control',
        implemented: true,
        selectedForContractualObligation: true,
        selectedForLegalRequirement: false,
        selectedForBusinessRequirement: true,
        isStandardControl: false,
      };

      prisma.control.findFirst.mockResolvedValue(null);
      prisma.control.create.mockResolvedValue(newControl);

      await request(app)
        .post('/api/controls')
        .send({
          code: 'CUSTOM.1.2',
          title: 'Custom Control',
          implemented: 'true',
          selectedForContractualObligation: 'true',
          selectedForLegalRequirement: 'false',
          selectedForBusinessRequirement: true,
          isStandardControl: 'false',
        })
        .expect(201);

      const createCall = prisma.control.create.mock.calls[0][0];
      expect(createCall.data.implemented).toBe(true);
      expect(createCall.data.selectedForContractualObligation).toBe(true);
      expect(createCall.data.selectedForLegalRequirement).toBe(false);
      expect(createCall.data.selectedForBusinessRequirement).toBe(true);
      expect(createCall.data.isStandardControl).toBe(false);
    });

    it('should handle justification validation with null value', async () => {
      const newControl = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        code: 'CUSTOM.1.3',
        title: 'Custom Control',
        justification: null,
      };

      prisma.control.findFirst.mockResolvedValue(null);
      prisma.control.create.mockResolvedValue(newControl);

      await request(app)
        .post('/api/controls')
        .send({
          code: 'CUSTOM.1.3',
          title: 'Custom Control',
          justification: null,
        })
        .expect(201);
    });

    it('should handle justification validation with empty string', async () => {
      const newControl = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        code: 'CUSTOM.1.4',
        title: 'Custom Control',
        justification: '',
      };

      prisma.control.findFirst.mockResolvedValue(null);
      prisma.control.create.mockResolvedValue(newControl);

      await request(app)
        .post('/api/controls')
        .send({
          code: 'CUSTOM.1.4',
          title: 'Custom Control',
          justification: '',
        })
        .expect(201);
    });

    it('should validate justification is a string when provided', async () => {
      await request(app)
        .post('/api/controls')
        .send({
          code: 'CUSTOM.1.5',
          title: 'Custom Control',
          justification: 123, // Invalid: not a string
        })
        .expect(400);
    });

    it('should prevent creating controls with existing standard control codes', async () => {
      const existingStandard = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        code: 'A.1.1',
        isStandardControl: true,
      };

      prisma.control.findFirst.mockResolvedValue(existingStandard);

      const response = await request(app)
        .post('/api/controls')
        .send({
          code: 'A.1.1',
          title: 'Test Control',
        })
        .expect(409);

      expect(response.body.error).toContain('standard ISO 27002 control');
      expect(prisma.control.create).not.toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/controls')
        .send({
          // Missing code and title
        })
        .expect(400);
    });

    it('should validate category enum', async () => {
      await request(app)
        .post('/api/controls')
        .send({
          code: 'CUSTOM.1.1',
          title: 'Test Control',
          category: 'INVALID',
        })
        .expect(400);
    });

    it('should handle duplicate code error', async () => {
      const error: any = new Error('Unique constraint failed');
      error.code = 'P2002';

      prisma.control.findFirst.mockResolvedValue(null);
      prisma.control.create.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/controls')
        .send({
          code: 'CUSTOM.1.1',
          title: 'Test Control',
        })
        .expect(409);

      expect(response.body.error).toBe('Control code already exists');
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      prisma.control.findFirst.mockResolvedValue(null);
      prisma.control.create.mockRejectedValue(new Error('Database error'));

      await request(app)
        .post('/api/controls')
        .send({
          code: 'CUSTOM.1.1',
          title: 'Test Control',
        })
        .expect(500);
      
      console.error = originalError;
    });

    it('should handle embedding service errors gracefully', async () => {
      const newControl = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        code: 'CUSTOM.1.1',
        title: 'Custom Control',
        description: null,
        purpose: null,
        guidance: null,
      };

      prisma.control.findFirst.mockResolvedValue(null);
      prisma.control.create.mockResolvedValue(newControl);
      computeAndStoreControlEmbedding.mockRejectedValue(new Error('Embedding error'));

      // Should still return 201 even if embedding fails (best-effort)
      await request(app)
        .post('/api/controls')
        .send({
          code: 'CUSTOM.1.1',
          title: 'Custom Control',
        })
        .expect(201);
    });
  });

  describe('PUT /api/controls/:id', () => {
    it('should update a non-standard control', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: false,
      };
      const updatedControl = {
        ...existingControl,
        code: 'CUSTOM.1.2',
        title: 'Updated Control',
        description: 'Updated Description',
      };

      prisma.control.findUnique.mockResolvedValueOnce(existingControl);
      prisma.control.update.mockResolvedValue(updatedControl);

      const response = await request(app)
        .put(`/api/controls/${controlId}`)
        .send({
          title: 'Updated Control',
          description: 'Updated Description',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Control');
      expect(prisma.control.update).toHaveBeenCalled();
    });

    it('should update standard control selection reasons only', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: true,
        code: 'A.1.1',
        title: 'Standard Control',
      };
      const updatedControl = {
        ...existingControl,
        selectedForContractualObligation: true,
        selectedForLegalRequirement: false,
        selectedForBusinessRequirement: true,
        implemented: true,
        justification: 'Test justification',
      };

      prisma.control.findUnique.mockResolvedValueOnce(existingControl);
      prisma.control.update.mockResolvedValue(updatedControl);

      const response = await request(app)
        .put(`/api/controls/${controlId}`)
        .send({
          selectedForContractualObligation: true,
          selectedForLegalRequirement: false,
          selectedForBusinessRequirement: 'true',
          implemented: true,
          justification: 'Test justification',
        })
        .expect(200);

      expect(response.body.selectedForContractualObligation).toBe(true);
      expect(response.body.selectedForLegalRequirement).toBe(false);
      expect(response.body.selectedForBusinessRequirement).toBe(true);
      expect(response.body.implemented).toBe(true);
    });

    it('should block updating standard control immutable fields', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: true,
      };

      prisma.control.findUnique.mockResolvedValueOnce(existingControl);

      const response = await request(app)
        .put(`/api/controls/${controlId}`)
        .send({
          code: 'A.1.2', // Attempting to change code
        })
        .expect(403);

      expect(response.body.error).toContain('Cannot modify code');
      expect(prisma.control.update).not.toHaveBeenCalled();
    });

    it('should block updating selectedForRiskAssessment for standard controls', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: true,
      };

      prisma.control.findUnique.mockResolvedValueOnce(existingControl);

      const response = await request(app)
        .put(`/api/controls/${controlId}`)
        .send({
          selectedForRiskAssessment: true,
        })
        .expect(403);

      expect(response.body.error).toContain('selectedForRiskAssessment');
    });

    it('should remove selectedForRiskAssessment from update data for non-standard controls', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: false,
      };
      const updatedControl = {
        ...existingControl,
        title: 'Updated',
      };

      prisma.control.findUnique.mockResolvedValueOnce(existingControl);
      prisma.control.update.mockResolvedValue(updatedControl);

      await request(app)
        .put(`/api/controls/${controlId}`)
        .send({
          title: 'Updated',
          selectedForRiskAssessment: true, // Should be removed
        })
        .expect(200);

      const updateCall = prisma.control.update.mock.calls[0][0];
      expect(updateCall.data.selectedForRiskAssessment).toBeUndefined();
    });

    it('should recompute embedding when text fields are updated for non-standard controls', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: false,
      };
      const updatedControl = {
        ...existingControl,
        code: 'CUSTOM.1.2',
        title: 'Updated Title',
        description: 'Updated Description',
        purpose: null,
        guidance: null,
      };

      prisma.control.findUnique.mockResolvedValueOnce(existingControl);
      prisma.control.update.mockResolvedValue(updatedControl);

      await request(app)
        .put(`/api/controls/${controlId}`)
        .send({
          title: 'Updated Title',
          description: 'Updated Description',
        })
        .expect(200);

      expect(computeAndStoreControlEmbedding).toHaveBeenCalledWith(
        controlId,
        updatedControl.code,
        updatedControl.title,
        updatedControl.description,
        updatedControl.purpose,
        updatedControl.guidance
      );
    });

    it('should not recompute embedding when only non-text fields are updated', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: false,
      };
      const updatedControl = {
        ...existingControl,
        implemented: true,
      };

      prisma.control.findUnique.mockResolvedValueOnce(existingControl);
      prisma.control.update.mockResolvedValue(updatedControl);

      computeAndStoreControlEmbedding.mockClear();

      await request(app)
        .put(`/api/controls/${controlId}`)
        .send({
          implemented: true,
        })
        .expect(200);

      expect(computeAndStoreControlEmbedding).not.toHaveBeenCalled();
    });

    it('should not recompute embedding for standard controls', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: true,
      };
      const updatedControl = {
        ...existingControl,
        implemented: true,
      };

      prisma.control.findUnique.mockResolvedValueOnce(existingControl);
      prisma.control.update.mockResolvedValue(updatedControl);

      computeAndStoreControlEmbedding.mockClear();

      await request(app)
        .put(`/api/controls/${controlId}`)
        .send({
          implemented: true,
        })
        .expect(200);

      expect(computeAndStoreControlEmbedding).not.toHaveBeenCalled();
    });

    it('should convert string booleans to actual booleans', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: false,
      };
      const updatedControl = {
        ...existingControl,
        implemented: true,
        selectedForContractualObligation: true,
        selectedForLegalRequirement: false,
        selectedForBusinessRequirement: true,
        isStandardControl: false,
      };

      prisma.control.findUnique.mockResolvedValueOnce(existingControl);
      prisma.control.update.mockResolvedValue(updatedControl);

      await request(app)
        .put(`/api/controls/${controlId}`)
        .send({
          implemented: 'true',
          selectedForContractualObligation: 'true',
          selectedForLegalRequirement: 'false',
          selectedForBusinessRequirement: true,
          isStandardControl: 'false',
        })
        .expect(200);

      const updateCall = prisma.control.update.mock.calls[0][0];
      expect(updateCall.data.implemented).toBe(true);
      expect(updateCall.data.selectedForContractualObligation).toBe(true);
      expect(updateCall.data.selectedForLegalRequirement).toBe(false);
      expect(updateCall.data.selectedForBusinessRequirement).toBe(true);
      expect(updateCall.data.isStandardControl).toBe(false);
    });

    it('should return 404 for non-existent control', async () => {
      prisma.control.findUnique.mockResolvedValue(null);

      await request(app)
        .put('/api/controls/550e8400-e29b-41d4-a716-446655440000')
        .send({
          title: 'Updated',
        })
        .expect(404);
    });

    it('should return 404 when update fails with P2025', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: false,
      };
      const error: any = new Error('Record not found');
      error.code = 'P2025';

      prisma.control.findUnique.mockResolvedValueOnce(existingControl);
      prisma.control.update.mockRejectedValue(error);

      await request(app)
        .put(`/api/controls/${controlId}`)
        .send({
          title: 'Updated',
        })
        .expect(404);
    });

    it('should return 409 when update fails with P2002 (duplicate code)', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: false,
      };
      const error: any = new Error('Unique constraint failed');
      error.code = 'P2002';

      prisma.control.findUnique.mockResolvedValueOnce(existingControl);
      prisma.control.update.mockRejectedValue(error);

      const response = await request(app)
        .put(`/api/controls/${controlId}`)
        .send({
          code: 'DUPLICATE',
        })
        .expect(409);

      expect(response.body.error).toBe('Control code already exists');
    });

    it('should validate UUID parameter', async () => {
      await request(app)
        .put('/api/controls/invalid-id')
        .send({
          title: 'Updated',
        })
        .expect(400);
    });

    it('should validate optional fields', async () => {
      await request(app)
        .put('/api/controls/550e8400-e29b-41d4-a716-446655440001')
        .send({
          code: '', // Empty code should fail
        })
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: false,
      };

      prisma.control.findUnique.mockResolvedValueOnce(existingControl);
      prisma.control.update.mockRejectedValue(new Error('Database error'));

      await request(app)
        .put(`/api/controls/${controlId}`)
        .send({
          title: 'Updated',
        })
        .expect(500);
      
      console.error = originalError;
    });
  });

  describe('DELETE /api/controls/:id', () => {
    it('should delete a custom control', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: false,
      };

      prisma.control.findUnique.mockResolvedValue(existingControl);
      prisma.control.delete.mockResolvedValue(existingControl);

      await request(app)
        .delete(`/api/controls/${controlId}`)
        .expect(204);

      expect(prisma.control.delete).toHaveBeenCalledWith({
        where: { id: controlId },
      });
    });

    it('should return 403 when attempting to delete standard control', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: true,
      };

      prisma.control.findUnique.mockResolvedValue(existingControl);

      const response = await request(app)
        .delete(`/api/controls/${controlId}`)
        .expect(403);

      expect(response.body.error).toContain('Cannot delete standard ISO 27002 controls');
      expect(prisma.control.delete).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent control', async () => {
      prisma.control.findUnique.mockResolvedValue(null);

      await request(app)
        .delete('/api/controls/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);
    });

    it('should return 404 when delete fails with P2025', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: false,
      };
      const error: any = new Error('Record not found');
      error.code = 'P2025';

      prisma.control.findUnique.mockResolvedValue(existingControl);
      prisma.control.delete.mockRejectedValue(error);

      await request(app)
        .delete(`/api/controls/${controlId}`)
        .expect(404);
    });

    it('should validate UUID parameter', async () => {
      await request(app)
        .delete('/api/controls/invalid-id')
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const existingControl = {
        id: controlId,
        isStandardControl: false,
      };

      prisma.control.findUnique.mockResolvedValue(existingControl);
      prisma.control.delete.mockRejectedValue(new Error('Database error'));

      await request(app)
        .delete(`/api/controls/${controlId}`)
        .expect(500);
      
      console.error = originalError;
    });
  });

  describe('GET /api/controls/:id/suppliers', () => {
    it('should return list of suppliers linked to control', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const mockLinks = [
        {
          supplier: {
            id: 'supplier-1',
            name: 'Supplier 1',
            supplierType: 'VENDOR',
            criticality: 'HIGH',
            status: 'ACTIVE',
          },
        },
        {
          supplier: {
            id: 'supplier-2',
            name: 'Supplier 2',
            supplierType: 'PARTNER',
            criticality: 'MEDIUM',
            status: 'ACTIVE',
          },
        },
      ];

      prisma.supplierControlLink.findMany.mockResolvedValue(mockLinks);

      const response = await request(app)
        .get(`/api/controls/${controlId}/suppliers`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].id).toBe('supplier-1');
      expect(response.body[1].id).toBe('supplier-2');
    });

    it('should return empty array when no suppliers are linked', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';

      prisma.supplierControlLink.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/controls/${controlId}/suppliers`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should validate UUID parameter', async () => {
      await request(app)
        .get('/api/controls/invalid-id/suppliers')
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      prisma.supplierControlLink.findMany.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/controls/550e8400-e29b-41d4-a716-446655440001/suppliers')
        .expect(500);
      
      console.error = originalError;
    });
  });

  describe('POST /api/controls/:id/suppliers', () => {
    it('should link supplier to control', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const supplierId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };
      const mockSupplier = {
        id: supplierId,
      };
      const linkedSupplier = {
        id: supplierId,
        name: 'Test Supplier',
        supplierType: 'VENDOR',
        criticality: 'HIGH',
        status: 'ACTIVE',
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      prisma.supplierControlLink.findUnique.mockResolvedValue(null);
      prisma.supplierControlLink.create.mockResolvedValue({});
      prisma.supplier.findUnique.mockResolvedValueOnce(linkedSupplier);

      const response = await request(app)
        .post(`/api/controls/${controlId}/suppliers`)
        .send({ supplierId })
        .expect(201);

      expect(response.body.id).toBe(supplierId);
      expect(prisma.supplierControlLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            supplierId,
            controlId,
          },
        })
      );
    });

    it('should return 404 when control does not exist', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const supplierId = '550e8400-e29b-41d4-a716-446655440002';

      prisma.control.findUnique.mockResolvedValue(null);

      await request(app)
        .post(`/api/controls/${controlId}/suppliers`)
        .send({ supplierId })
        .expect(404);
    });

    it('should return 404 when supplier does not exist', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const supplierId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.supplier.findUnique.mockResolvedValue(null);

      await request(app)
        .post(`/api/controls/${controlId}/suppliers`)
        .send({ supplierId })
        .expect(404);
    });

    it('should return 400 when supplier is already linked', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const supplierId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };
      const mockSupplier = {
        id: supplierId,
      };
      const existingLink = {
        supplierId,
        controlId,
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      prisma.supplierControlLink.findUnique.mockResolvedValue(existingLink);

      const response = await request(app)
        .post(`/api/controls/${controlId}/suppliers`)
        .send({ supplierId })
        .expect(400);

      expect(response.body.error).toBe('Supplier is already linked to this control');
    });

    it('should return 400 when link creation fails with P2002', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const supplierId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };
      const mockSupplier = {
        id: supplierId,
      };
      const error: any = new Error('Unique constraint failed');
      error.code = 'P2002';

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      prisma.supplierControlLink.findUnique.mockResolvedValue(null);
      prisma.supplierControlLink.create.mockRejectedValue(error);

      const response = await request(app)
        .post(`/api/controls/${controlId}/suppliers`)
        .send({ supplierId })
        .expect(400);

      expect(response.body.error).toBe('Supplier is already linked to this control');
    });

    it('should validate UUID parameters', async () => {
      await request(app)
        .post('/api/controls/invalid-id/suppliers')
        .send({ supplierId: '550e8400-e29b-41d4-a716-446655440002' })
        .expect(400);
    });

    it('should validate supplierId in body', async () => {
      await request(app)
        .post('/api/controls/550e8400-e29b-41d4-a716-446655440001/suppliers')
        .send({ supplierId: 'invalid' })
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const supplierId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };
      const mockSupplier = {
        id: supplierId,
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      prisma.supplierControlLink.findUnique.mockResolvedValue(null);
      prisma.supplierControlLink.create.mockRejectedValue(new Error('Database error'));

      await request(app)
        .post(`/api/controls/${controlId}/suppliers`)
        .send({ supplierId })
        .expect(500);
      
      console.error = originalError;
    });
  });

  describe('GET /api/controls/:id/documents', () => {
    it('should return list of documents linked to control', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const mockDocumentControls = [
        {
          document: {
            id: 'doc-1',
            title: 'Document 1',
            version: '1.0',
            type: 'POLICY',
            status: 'APPROVED',
          },
        },
        {
          document: {
            id: 'doc-2',
            title: 'Document 2',
            version: '2.0',
            type: 'PROCEDURE',
            status: 'APPROVED',
          },
        },
      ];

      prisma.control.findUnique.mockResolvedValue({ id: controlId });
      prisma.documentControl.findMany.mockResolvedValue(mockDocumentControls);

      const response = await request(app)
        .get(`/api/controls/${controlId}/documents`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].id).toBe('doc-1');
      expect(response.body[1].id).toBe('doc-2');
    });

    it('should return 404 when control does not exist', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';

      prisma.control.findUnique.mockResolvedValue(null);

      await request(app)
        .get(`/api/controls/${controlId}/documents`)
        .expect(404);
    });

    it('should return empty array when no documents are linked', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';

      prisma.control.findUnique.mockResolvedValue({ id: controlId });
      prisma.documentControl.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/controls/${controlId}/documents`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should validate UUID parameter', async () => {
      await request(app)
        .get('/api/controls/invalid-id/documents')
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      const controlId = '550e8400-e29b-41d4-a716-446655440001';

      prisma.control.findUnique.mockResolvedValue({ id: controlId });
      prisma.documentControl.findMany.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get(`/api/controls/${controlId}/documents`)
        .expect(500);
      
      console.error = originalError;
    });
  });

  describe('POST /api/controls/:id/documents', () => {
    it('should link document to control', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const documentId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };
      const mockDocument = {
        id: documentId,
      };
      const linkedDocument = {
        id: documentId,
        title: 'Test Document',
        version: '1.0',
        type: 'POLICY',
        status: 'APPROVED',
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.document.findUnique.mockResolvedValueOnce(mockDocument);
      prisma.documentControl.findUnique.mockResolvedValue(null);
      prisma.documentControl.create.mockResolvedValue({});
      prisma.document.findUnique.mockResolvedValueOnce(linkedDocument);

      const response = await request(app)
        .post(`/api/controls/${controlId}/documents`)
        .send({ documentId })
        .expect(201);

      expect(response.body.id).toBe(documentId);
      expect(prisma.documentControl.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            documentId,
            controlId,
          },
        })
      );
    });

    it('should return 404 when control does not exist', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const documentId = '550e8400-e29b-41d4-a716-446655440002';

      prisma.control.findUnique.mockResolvedValue(null);

      await request(app)
        .post(`/api/controls/${controlId}/documents`)
        .send({ documentId })
        .expect(404);
    });

    it('should return 404 when document does not exist', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const documentId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.document.findUnique.mockResolvedValue(null);

      await request(app)
        .post(`/api/controls/${controlId}/documents`)
        .send({ documentId })
        .expect(404);
    });

    it('should return 400 when document is already linked', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const documentId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };
      const mockDocument = {
        id: documentId,
      };
      const existingLink = {
        documentId,
        controlId,
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentControl.findUnique.mockResolvedValue(existingLink);

      const response = await request(app)
        .post(`/api/controls/${controlId}/documents`)
        .send({ documentId })
        .expect(400);

      expect(response.body.error).toBe('Document is already linked to this control');
    });

    it('should return 400 when link creation fails with P2002', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const documentId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };
      const mockDocument = {
        id: documentId,
      };
      const error: any = new Error('Unique constraint failed');
      error.code = 'P2002';

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentControl.findUnique.mockResolvedValue(null);
      prisma.documentControl.create.mockRejectedValue(error);

      const response = await request(app)
        .post(`/api/controls/${controlId}/documents`)
        .send({ documentId })
        .expect(400);

      expect(response.body.error).toBe('Document is already linked to this control');
    });

    it('should validate UUID parameters', async () => {
      await request(app)
        .post('/api/controls/invalid-id/documents')
        .send({ documentId: '550e8400-e29b-41d4-a716-446655440002' })
        .expect(400);
    });

    it('should validate documentId in body', async () => {
      await request(app)
        .post('/api/controls/550e8400-e29b-41d4-a716-446655440001/documents')
        .send({ documentId: 'invalid' })
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const documentId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };
      const mockDocument = {
        id: documentId,
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentControl.findUnique.mockResolvedValue(null);
      prisma.documentControl.create.mockRejectedValue(new Error('Database error'));

      await request(app)
        .post(`/api/controls/${controlId}/documents`)
        .send({ documentId })
        .expect(500);
      
      console.error = originalError;
    });
  });

  describe('DELETE /api/controls/:id/documents/:documentId', () => {
    it('should unlink document from control', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const documentId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };
      const mockDocument = {
        id: documentId,
      };
      const existingLink = {
        documentId,
        controlId,
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentControl.findUnique.mockResolvedValue(existingLink);
      prisma.documentControl.delete.mockResolvedValue(existingLink);

      await request(app)
        .delete(`/api/controls/${controlId}/documents/${documentId}`)
        .expect(204);

      expect(prisma.documentControl.delete).toHaveBeenCalledWith({
        where: {
          documentId_controlId: {
            documentId,
            controlId,
          },
        },
      });
    });

    it('should return 404 when control does not exist', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const documentId = '550e8400-e29b-41d4-a716-446655440002';

      prisma.control.findUnique.mockResolvedValue(null);

      await request(app)
        .delete(`/api/controls/${controlId}/documents/${documentId}`)
        .expect(404);
    });

    it('should return 404 when document does not exist', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const documentId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.document.findUnique.mockResolvedValue(null);

      await request(app)
        .delete(`/api/controls/${controlId}/documents/${documentId}`)
        .expect(404);
    });

    it('should return 404 when link does not exist', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const documentId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };
      const mockDocument = {
        id: documentId,
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentControl.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/controls/${controlId}/documents/${documentId}`)
        .expect(404);

      expect(response.body.error).toBe('Document is not linked to this control');
    });

    it('should return 404 when delete fails with P2025', async () => {
      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const documentId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };
      const mockDocument = {
        id: documentId,
      };
      const existingLink = {
        documentId,
        controlId,
      };
      const error: any = new Error('Record not found');
      error.code = 'P2025';

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentControl.findUnique.mockResolvedValue(existingLink);
      prisma.documentControl.delete.mockRejectedValue(error);

      await request(app)
        .delete(`/api/controls/${controlId}/documents/${documentId}`)
        .expect(404);
    });

    it('should validate UUID parameters', async () => {
      await request(app)
        .delete('/api/controls/invalid-id/documents/550e8400-e29b-41d4-a716-446655440002')
        .expect(400);
    });

    it('should validate documentId parameter', async () => {
      await request(app)
        .delete('/api/controls/550e8400-e29b-41d4-a716-446655440001/documents/invalid-id')
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      const controlId = '550e8400-e29b-41d4-a716-446655440001';
      const documentId = '550e8400-e29b-41d4-a716-446655440002';
      const mockControl = {
        id: controlId,
      };
      const mockDocument = {
        id: documentId,
      };
      const existingLink = {
        documentId,
        controlId,
      };

      prisma.control.findUnique.mockResolvedValue(mockControl);
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentControl.findUnique.mockResolvedValue(existingLink);
      prisma.documentControl.delete.mockRejectedValue(new Error('Database error'));

      await request(app)
        .delete(`/api/controls/${controlId}/documents/${documentId}`)
        .expect(500);
      
      console.error = originalError;
    });
  });
});

