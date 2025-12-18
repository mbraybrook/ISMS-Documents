/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import suppliersRouter from '../suppliers';
import { mockUsers } from '../../lib/test-helpers';

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
    supplier: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Suppliers API', () => {
  let app: express.Application;
  let prisma: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/suppliers', suppliersRouter);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    prisma = require('../../lib/prisma').prisma;
    jest.clearAllMocks();
  });

  describe('GET /api/suppliers', () => {
    it('should return list of suppliers', async () => {
      const mockSuppliers = [
        {
          id: 'supplier-1',
          name: 'Supplier 1',
          supplierType: 'SERVICE_PROVIDER',
          status: 'ACTIVE',
          relationshipOwner: null,
          createdBy: { id: 'user-1', displayName: 'Creator', email: 'creator@paythru.com' },
          updatedBy: { id: 'user-1', displayName: 'Creator', email: 'creator@paythru.com' },
        },
      ];

      prisma.supplier.findMany.mockResolvedValue(mockSuppliers);

      const response = await request(app)
        .get('/api/suppliers')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Supplier 1');
      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
          include: expect.objectContaining({
            relationshipOwner: expect.any(Object),
            createdBy: expect.any(Object),
            updatedBy: expect.any(Object),
          }),
        })
      );
    });

    it('should filter by supplierType', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/suppliers?supplierType=SERVICE_PROVIDER')
        .expect(200);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            supplierType: 'SERVICE_PROVIDER',
          }),
        })
      );
    });

    it('should filter by criticality', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/suppliers?criticality=HIGH')
        .expect(200);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            criticality: 'HIGH',
          }),
        })
      );
    });

    it('should filter by pciStatus', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/suppliers?pciStatus=PASS')
        .expect(200);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pciStatus: 'PASS',
          }),
        })
      );
    });

    it('should filter by iso27001Status', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/suppliers?iso27001Status=CERTIFIED')
        .expect(200);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            iso27001Status: 'CERTIFIED',
          }),
        })
      );
    });

    it('should filter by status', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/suppliers?status=ACTIVE')
        .expect(200);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should filter by performanceRating', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/suppliers?performanceRating=GOOD')
        .expect(200);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            performanceRating: 'GOOD',
          }),
        })
      );
    });

    it('should filter by lifecycleState', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/suppliers?lifecycleState=APPROVED')
        .expect(200);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lifecycleState: 'APPROVED',
          }),
        })
      );
    });

    it('should filter by search query', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/suppliers?search=test')
        .expect(200);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: {
              contains: 'test',
              mode: 'insensitive',
            },
          }),
        })
      );
    });

    it('should combine multiple filters', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/suppliers?supplierType=SERVICE_PROVIDER&status=ACTIVE&criticality=HIGH')
        .expect(200);

      const callArgs = prisma.supplier.findMany.mock.calls[0][0];
      expect(callArgs.where.supplierType).toBe('SERVICE_PROVIDER');
      expect(callArgs.where.status).toBe('ACTIVE');
      expect(callArgs.where.criticality).toBe('HIGH');
    });

    it('should validate supplierType enum', async () => {
      await request(app)
        .get('/api/suppliers?supplierType=INVALID')
        .expect(400);
    });

    it('should validate criticality enum', async () => {
      await request(app)
        .get('/api/suppliers?criticality=INVALID')
        .expect(400);
    });

    it('should validate pciStatus enum', async () => {
      await request(app)
        .get('/api/suppliers?pciStatus=INVALID')
        .expect(400);
    });

    it('should validate iso27001Status enum', async () => {
      await request(app)
        .get('/api/suppliers?iso27001Status=INVALID')
        .expect(400);
    });

    it('should validate status enum', async () => {
      await request(app)
        .get('/api/suppliers?status=INVALID')
        .expect(400);
    });

    it('should validate performanceRating enum', async () => {
      await request(app)
        .get('/api/suppliers?performanceRating=INVALID')
        .expect(400);
    });

    it('should validate lifecycleState enum', async () => {
      await request(app)
        .get('/api/suppliers?lifecycleState=INVALID')
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      prisma.supplier.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/suppliers')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch suppliers');
      expect(prisma.supplier.findMany).toHaveBeenCalled();

      console.error = originalError;
    });

    it('should include error details in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalError = console.error;
      console.error = jest.fn();

      process.env.NODE_ENV = 'development';
      const dbError = new Error('Database error');
      prisma.supplier.findMany.mockRejectedValue(dbError);

      const response = await request(app)
        .get('/api/suppliers')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch suppliers');
      expect(response.body.details).toBe('Database error');
      expect(response.body.errors).toEqual(['Database error']);

      process.env.NODE_ENV = originalEnv;
      console.error = originalError;
    });

    it('should return empty array when no suppliers match', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/suppliers')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should not include search filter when search is not provided', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/suppliers?supplierType=SERVICE_PROVIDER')
        .expect(200);

      const callArgs = prisma.supplier.findMany.mock.calls[0][0];
      expect(callArgs.where.name).toBeUndefined();
      expect(callArgs.where.supplierType).toBe('SERVICE_PROVIDER');
    });
  });

  describe('GET /api/suppliers/:id', () => {
    it('should return supplier details with relationships', async () => {
      const supplierId = '550e8400-e29b-41d4-a716-446655440001';
      const mockSupplier = {
        id: supplierId,
        name: 'Test Supplier',
        supplierType: 'SERVICE_PROVIDER',
        status: 'ACTIVE',
        relationshipOwner: null,
        createdBy: { id: 'user-1', displayName: 'Creator', email: 'creator@paythru.com' },
        updatedBy: { id: 'user-1', displayName: 'Creator', email: 'creator@paythru.com' },
        supplierRisks: [
          {
            risk: {
              id: 'risk-1',
              title: 'Test Risk',
              calculatedScore: 5.5,
              status: 'OPEN',
              riskCategory: 'TECHNICAL',
            },
          },
        ],
        supplierControls: [
          {
            control: {
              id: 'control-1',
              code: 'A.1.1',
              title: 'Test Control',
              implemented: true,
              category: 'ORGANIZATIONAL',
            },
          },
        ],
        exitPlan: null,
      };

      prisma.supplier.findUnique.mockResolvedValue(mockSupplier);

      const response = await request(app)
        .get(`/api/suppliers/${supplierId}`)
        .expect(200);

      expect(response.body.id).toBe(supplierId);
      expect(response.body.name).toBe('Test Supplier');
      expect(response.body.supplierRisks).toHaveLength(1);
      expect(response.body.supplierControls).toHaveLength(1);
      expect(prisma.supplier.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: supplierId },
          include: expect.objectContaining({
            supplierRisks: expect.any(Object),
            supplierControls: expect.any(Object),
            exitPlan: true,
          }),
        })
      );
    });

    it('should return 404 for non-existent supplier', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await request(app)
        .get('/api/suppliers/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app)
        .get('/api/suppliers/invalid-id')
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      prisma.supplier.findUnique.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/suppliers/550e8400-e29b-41d4-a716-446655440001')
        .expect(500);

      console.error = originalError;
    });
  });

  describe('POST /api/suppliers', () => {
    const mockUser = mockUsers.admin();

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
    });

    it('should create a new supplier with required fields', async () => {
      const newSupplier = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'New Supplier',
        supplierType: 'SERVICE_PROVIDER',
        status: 'ACTIVE',
        lifecycleState: 'DRAFT',
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.create.mockResolvedValue(newSupplier);

      const response = await request(app)
        .post('/api/suppliers')
        .send({
          name: 'New Supplier',
          supplierType: 'SERVICE_PROVIDER',
        })
        .expect(201);

      expect(response.body.name).toBe('New Supplier');
      expect(response.body.supplierType).toBe('SERVICE_PROVIDER');
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.lifecycleState).toBe('DRAFT');
      expect(prisma.supplier.create).toHaveBeenCalled();
    });

    it('should create supplier with all optional fields', async () => {
      const newSupplier = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Full Supplier',
        tradingName: 'Trading Name',
        supplierType: 'SERVICE_PROVIDER',
        serviceSubType: 'SAAS',
        status: 'IN_ONBOARDING',
        lifecycleState: 'AWAITING_APPROVAL',
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.create.mockResolvedValue(newSupplier);

      const response = await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Full Supplier',
          tradingName: 'Trading Name',
          supplierType: 'SERVICE_PROVIDER',
          serviceSubType: 'SAAS',
          status: 'IN_ONBOARDING',
          lifecycleState: 'AWAITING_APPROVAL',
          processesCardholderData: true,
          processesPersonalData: true,
          hostingRegions: ['US', 'EU'],
          customerFacingImpact: true,
          overallRiskRating: 'HIGH',
          criticality: 'HIGH',
          riskRationale: 'High risk rationale',
          criticalityRationale: 'High criticality rationale',
          pciStatus: 'PASS',
          iso27001Status: 'CERTIFIED',
          iso22301Status: 'CERTIFIED',
          iso9001Status: 'CERTIFIED',
          gdprStatus: 'ADEQUATE',
          reviewDate: '2024-12-31',
          complianceEvidenceLinks: ['https://example.com'],
          relationshipOwnerUserId: '550e8400-e29b-41d4-a716-446655440002',
          primaryContacts: [{ name: 'John Doe', email: 'john@example.com' }],
          contractReferences: ['CONTRACT-001'],
          dataProcessingAgreementRef: 'DPA-001',
          contractStartDate: '2024-01-01',
          contractEndDate: '2024-12-31',
          autoRenewal: true,
          performanceRating: 'GOOD',
          performanceNotes: 'Good performance',
          cisoExemptionGranted: false,
        })
        .expect(201);

      expect(response.body.name).toBe('Full Supplier');
      expect(response.body.tradingName).toBe('Trading Name');
      expect(response.body.serviceSubType).toBe('SAAS');
    });

    it('should validate required name field', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          supplierType: 'SERVICE_PROVIDER',
        })
        .expect(400);
    });

    it('should validate required supplierType field', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
        })
        .expect(400);
    });

    it('should validate supplierType enum', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'INVALID',
        })
        .expect(400);
    });

    it('should validate serviceSubType', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          serviceSubType: 'INVALID',
        })
        .expect(400);
    });

    it('should accept null serviceSubType', async () => {
      const newSupplier = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Supplier',
        supplierType: 'SERVICE_PROVIDER',
        serviceSubType: null,
        status: 'ACTIVE',
        lifecycleState: 'DRAFT',
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.create.mockResolvedValue(newSupplier);

      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          serviceSubType: null,
        })
        .expect(201);
    });

    it('should validate status enum', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          status: 'INVALID',
        })
        .expect(400);
    });

    it('should validate lifecycleState enum', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          lifecycleState: 'INVALID',
        })
        .expect(400);
    });

    it('should validate overallRiskRating enum', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          overallRiskRating: 'INVALID',
        })
        .expect(400);
    });

    it('should validate criticality enum', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          criticality: 'INVALID',
        })
        .expect(400);
    });

    it('should validate pciStatus enum', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          pciStatus: 'INVALID',
        })
        .expect(400);
    });

    it('should validate iso27001Status enum', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          iso27001Status: 'INVALID',
        })
        .expect(400);
    });

    it('should validate iso22301Status enum', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          iso22301Status: 'INVALID',
        })
        .expect(400);
    });

    it('should validate iso9001Status enum', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          iso9001Status: 'INVALID',
        })
        .expect(400);
    });

    it('should validate gdprStatus enum', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          gdprStatus: 'INVALID',
        })
        .expect(400);
    });

    it('should validate performanceRating enum', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          performanceRating: 'INVALID',
        })
        .expect(400);
    });

    it('should validate relationshipOwnerUserId as UUID', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          relationshipOwnerUserId: 'invalid-uuid',
        })
        .expect(400);
    });

    it('should validate reviewDate format', async () => {
      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          reviewDate: 'invalid-date',
        })
        .expect(400);
    });

    it('should return 403 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
        })
        .expect(403);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      prisma.supplier.create.mockRejectedValue(new Error('Database error'));

      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
        })
        .expect(500);

      console.error = originalError;
    });

    it('should set default values when optional fields are not provided', async () => {
      const newSupplier = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Supplier',
        supplierType: 'SERVICE_PROVIDER',
        status: 'ACTIVE',
        lifecycleState: 'DRAFT',
        processesCardholderData: false,
        processesPersonalData: false,
        customerFacingImpact: false,
        autoRenewal: false,
        cisoExemptionGranted: false,
        showInTrustCenter: false,
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.create.mockResolvedValue(newSupplier);

      const response = await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
        })
        .expect(201);

      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.lifecycleState).toBe('DRAFT');
      expect(response.body.processesCardholderData).toBe(false);
    });

    it('should handle empty arrays for array fields', async () => {
      const newSupplier = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Supplier',
        supplierType: 'SERVICE_PROVIDER',
        hostingRegions: null,
        complianceEvidenceLinks: null,
        primaryContacts: null,
        contractReferences: null,
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.create.mockResolvedValue(newSupplier);

      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          hostingRegions: [],
          complianceEvidenceLinks: [],
          primaryContacts: [],
          contractReferences: [],
        })
        .expect(201);
    });

    it('should handle all ISO status values allowed in POST', async () => {
      // Note: POST route doesn't allow NOT_APPLICABLE, only PUT route does
      const newSupplier = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Supplier',
        supplierType: 'SERVICE_PROVIDER',
        iso27001Status: 'NOT_CERTIFIED',
        iso22301Status: 'IN_PROGRESS',
        iso9001Status: 'CERTIFIED',
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.create.mockResolvedValue(newSupplier);

      await request(app)
        .post('/api/suppliers')
        .send({
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          iso27001Status: 'NOT_CERTIFIED',
          iso22301Status: 'IN_PROGRESS',
          iso9001Status: 'CERTIFIED',
        })
        .expect(201);
    });

    it('should handle all lifecycle state values', async () => {
      const lifecycleStates = ['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_REVIEW', 'EXIT_IN_PROGRESS'];
      
      for (const state of lifecycleStates) {
        const newSupplier = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          lifecycleState: state,
          relationshipOwner: null,
          createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
          updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        };

        prisma.supplier.create.mockResolvedValue(newSupplier);

        await request(app)
          .post('/api/suppliers')
          .send({
            name: `Test Supplier ${state}`,
            supplierType: 'SERVICE_PROVIDER',
            lifecycleState: state,
          })
          .expect(201);
      }
    });

    it('should handle all supplier types in POST', async () => {
      const supplierTypes = ['SERVICE_PROVIDER', 'CONNECTED_ENTITY', 'PCI_SERVICE_PROVIDER'];
      
      for (const type of supplierTypes) {
        const newSupplier = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Test Supplier',
          supplierType: type,
          relationshipOwner: null,
          createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
          updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        };

        prisma.supplier.create.mockResolvedValue(newSupplier);

        await request(app)
          .post('/api/suppliers')
          .send({
            name: `Test Supplier ${type}`,
            supplierType: type,
          })
          .expect(201);
      }
    });

    it('should handle all status values in POST', async () => {
      const statuses = ['ACTIVE', 'IN_ONBOARDING', 'IN_EXIT', 'INACTIVE'];
      
      for (const status of statuses) {
        const newSupplier = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          status,
          relationshipOwner: null,
          createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
          updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        };

        prisma.supplier.create.mockResolvedValue(newSupplier);

        await request(app)
          .post('/api/suppliers')
          .send({
            name: `Test Supplier ${status}`,
            supplierType: 'SERVICE_PROVIDER',
            status,
          })
          .expect(201);
      }
    });

    it('should handle all PCI status values', async () => {
      const pciStatuses = ['UNKNOWN', 'PASS', 'FAIL', 'NOT_APPLICABLE'];
      
      for (const status of pciStatuses) {
        const newSupplier = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          pciStatus: status,
          relationshipOwner: null,
          createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
          updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        };

        prisma.supplier.create.mockResolvedValue(newSupplier);

        await request(app)
          .post('/api/suppliers')
          .send({
            name: `Test Supplier ${status}`,
            supplierType: 'SERVICE_PROVIDER',
            pciStatus: status,
          })
          .expect(201);
      }
    });

    it('should handle all GDPR status values', async () => {
      const gdprStatuses = ['UNKNOWN', 'ADEQUATE', 'HIGH_RISK', 'NOT_APPLICABLE'];
      
      for (const status of gdprStatuses) {
        const newSupplier = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          gdprStatus: status,
          relationshipOwner: null,
          createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
          updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        };

        prisma.supplier.create.mockResolvedValue(newSupplier);

        await request(app)
          .post('/api/suppliers')
          .send({
            name: `Test Supplier ${status}`,
            supplierType: 'SERVICE_PROVIDER',
            gdprStatus: status,
          })
          .expect(201);
      }
    });

    it('should handle all performance rating values', async () => {
      const ratings = ['GOOD', 'CAUTION', 'BAD'];
      
      for (const rating of ratings) {
        const newSupplier = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          performanceRating: rating,
          relationshipOwner: null,
          createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
          updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        };

        prisma.supplier.create.mockResolvedValue(newSupplier);

        await request(app)
          .post('/api/suppliers')
          .send({
            name: `Test Supplier ${rating}`,
            supplierType: 'SERVICE_PROVIDER',
            performanceRating: rating,
          })
          .expect(201);
      }
    });

    it('should handle all risk rating values', async () => {
      const ratings = ['LOW', 'MEDIUM', 'HIGH'];
      
      for (const rating of ratings) {
        const newSupplier = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Test Supplier',
          supplierType: 'SERVICE_PROVIDER',
          overallRiskRating: rating,
          criticality: rating,
          relationshipOwner: null,
          createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
          updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        };

        prisma.supplier.create.mockResolvedValue(newSupplier);

        await request(app)
          .post('/api/suppliers')
          .send({
            name: `Test Supplier ${rating}`,
            supplierType: 'SERVICE_PROVIDER',
            overallRiskRating: rating,
            criticality: rating,
          })
          .expect(201);
      }
    });
  });

  describe('PUT /api/suppliers/:id', () => {
    const mockUser = mockUsers.admin();
    const supplierId = '550e8400-e29b-41d4-a716-446655440001';
    const mockSupplier = {
      id: supplierId,
      name: 'Existing Supplier',
      supplierType: 'SERVICE_PROVIDER',
      status: 'ACTIVE',
      lifecycleState: 'DRAFT',
    };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.supplier.findUnique.mockResolvedValue(mockSupplier);
    });

    it('should update supplier with provided fields', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        name: 'Updated Supplier',
        status: 'INACTIVE',
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      const response = await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          name: 'Updated Supplier',
          status: 'INACTIVE',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Supplier');
      expect(response.body.status).toBe('INACTIVE');
      expect(prisma.supplier.update).toHaveBeenCalled();
    });

    it('should update all fields when provided', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        name: 'Updated Supplier',
        tradingName: 'Updated Trading Name',
        status: 'IN_ONBOARDING',
        supplierType: 'CONNECTED_ENTITY',
        serviceSubType: 'SAAS',
        lifecycleState: 'APPROVED',
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          name: 'Updated Supplier',
          tradingName: 'Updated Trading Name',
          status: 'IN_ONBOARDING',
          supplierType: 'CONNECTED_ENTITY',
          serviceSubType: 'SAAS',
          lifecycleState: 'APPROVED',
        })
        .expect(200);
    });

    it('should handle null values for optional fields that accept null', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        serviceSubType: null,
        overallRiskRating: null,
        criticality: null,
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      // Note: tradingName uses isString() which doesn't accept null, so we omit it
      // Only fields with custom validators that explicitly check for null accept null
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          serviceSubType: null,
          overallRiskRating: null,
          criticality: null,
        })
        .expect(200);
    });

    it('should handle empty string dates as null', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        reviewDate: null,
        contractStartDate: null,
        contractEndDate: null,
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          reviewDate: '',
          contractStartDate: '',
          contractEndDate: '',
        })
        .expect(200);

      const updateCall = prisma.supplier.update.mock.calls[0][0];
      expect(updateCall.data.reviewDate).toBeNull();
      expect(updateCall.data.contractStartDate).toBeNull();
      expect(updateCall.data.contractEndDate).toBeNull();
    });

    it('should validate UUID parameter', async () => {
      await request(app)
        .put('/api/suppliers/invalid-id')
        .send({
          name: 'Updated Supplier',
        })
        .expect(400);
    });

    it('should validate name is not empty when provided', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          name: '',
        })
        .expect(400);
    });

    it('should validate supplierType enum', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          supplierType: 'INVALID',
        })
        .expect(400);
    });

    it('should validate serviceSubType', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          serviceSubType: 'INVALID',
        })
        .expect(400);
    });

    it('should validate overallRiskRating enum', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          overallRiskRating: 'INVALID',
        })
        .expect(400);
    });

    it('should validate criticality enum', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          criticality: 'INVALID',
        })
        .expect(400);
    });

    it('should validate pciStatus enum', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          pciStatus: 'INVALID',
        })
        .expect(400);
    });

    it('should validate iso27001Status enum', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          iso27001Status: 'INVALID',
        })
        .expect(400);
    });

    it('should validate iso22301Status enum', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          iso22301Status: 'INVALID',
        })
        .expect(400);
    });

    it('should validate iso9001Status enum', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          iso9001Status: 'INVALID',
        })
        .expect(400);
    });

    it('should validate gdprStatus enum', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          gdprStatus: 'INVALID',
        })
        .expect(400);
    });

    it('should validate performanceRating enum', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          performanceRating: 'INVALID',
        })
        .expect(400);
    });

    it('should validate lifecycleState enum', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          lifecycleState: 'INVALID',
        })
        .expect(400);
    });

    it('should validate relationshipOwnerUserId as UUID', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          relationshipOwnerUserId: 'invalid-uuid',
        })
        .expect(400);
    });

    it('should validate reviewDate format', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          reviewDate: 'invalid-date',
        })
        .expect(400);
    });

    it('should validate contractStartDate format', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          contractStartDate: 'invalid-date',
        })
        .expect(400);
    });

    it('should validate contractEndDate format', async () => {
      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          contractEndDate: 'invalid-date',
        })
        .expect(400);
    });

    it('should return 403 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          name: 'Updated Supplier',
        })
        .expect(403);
    });

    it('should return 404 when supplier not found', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          name: 'Updated Supplier',
        })
        .expect(404);
    });

    it('should return 404 when update fails with P2025', async () => {
      const error: any = new Error('Record not found');
      error.code = 'P2025';

      prisma.supplier.update.mockRejectedValue(error);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          name: 'Updated Supplier',
        })
        .expect(404);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      prisma.supplier.update.mockRejectedValue(new Error('Database error'));

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          name: 'Updated Supplier',
        })
        .expect(500);

      console.error = originalError;
    });

    it('should only update fields that are provided', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        name: 'Updated Name Only',
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          name: 'Updated Name Only',
        })
        .expect(200);

      const updateCall = prisma.supplier.update.mock.calls[0][0];
      expect(updateCall.data.name).toBe('Updated Name Only');
      expect(updateCall.data.status).toBeUndefined();
      expect(updateCall.data.supplierType).toBeUndefined();
    });

    it('should handle trust centre fields', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        showInTrustCenter: true,
        trustCenterDisplayName: 'Trust Centre Name',
        trustCenterDescription: 'Trust Centre Description',
        trustCenterCategory: 'Category',
        trustCenterComplianceSummary: 'Summary',
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          showInTrustCenter: true,
          trustCenterDisplayName: 'Trust Centre Name',
          trustCenterDescription: 'Trust Centre Description',
          trustCenterCategory: 'Category',
          trustCenterComplianceSummary: 'Summary',
        })
        .expect(200);
    });

    it('should handle all ISO status values in update', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        iso27001Status: 'NOT_APPLICABLE',
        iso22301Status: 'NOT_APPLICABLE',
        iso9001Status: 'NOT_APPLICABLE',
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          iso27001Status: 'NOT_APPLICABLE',
          iso22301Status: 'NOT_APPLICABLE',
          iso9001Status: 'NOT_APPLICABLE',
        })
        .expect(200);
    });

    it('should handle valid date strings', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        reviewDate: new Date('2024-12-31'),
        contractStartDate: new Date('2024-01-01'),
        contractEndDate: new Date('2024-12-31'),
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          reviewDate: '2024-12-31',
          contractStartDate: '2024-01-01',
          contractEndDate: '2024-12-31',
        })
        .expect(200);
    });

    it('should handle all supplier types', async () => {
      const supplierTypes = ['SERVICE_PROVIDER', 'CONNECTED_ENTITY', 'PCI_SERVICE_PROVIDER'];
      
      for (const type of supplierTypes) {
        const updatedSupplier = {
          ...mockSupplier,
          supplierType: type,
          relationshipOwner: null,
          createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
          updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        };

        prisma.supplier.update.mockResolvedValue(updatedSupplier);

        await request(app)
          .put(`/api/suppliers/${supplierId}`)
          .send({
            supplierType: type,
          })
          .expect(200);
      }
    });

    it('should handle all status values', async () => {
      const statuses = ['ACTIVE', 'IN_ONBOARDING', 'IN_EXIT', 'INACTIVE'];
      
      for (const status of statuses) {
        const updatedSupplier = {
          ...mockSupplier,
          status,
          relationshipOwner: null,
          createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
          updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        };

        prisma.supplier.update.mockResolvedValue(updatedSupplier);

        await request(app)
          .put(`/api/suppliers/${supplierId}`)
          .send({
            status,
          })
          .expect(200);
      }
    });

    it('should handle tradingName with empty string as null', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        tradingName: null,
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          tradingName: '',
        })
        .expect(200);

      const updateCall = prisma.supplier.update.mock.calls[0][0];
      expect(updateCall.data.tradingName).toBeNull();
    });

    it('should handle hostingRegions with empty array', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        hostingRegions: [],
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          hostingRegions: [],
        })
        .expect(200);

      const updateCall = prisma.supplier.update.mock.calls[0][0];
      // Empty arrays are kept as arrays, not converted to null
      expect(Array.isArray(updateCall.data.hostingRegions)).toBe(true);
      expect(updateCall.data.hostingRegions).toEqual([]);
    });

    it('should handle hostingRegions with data', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        hostingRegions: ['US', 'EU'],
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          hostingRegions: ['US', 'EU'],
        })
        .expect(200);

      const updateCall = prisma.supplier.update.mock.calls[0][0];
      expect(updateCall.data.hostingRegions).toEqual(['US', 'EU']);
    });

    it('should handle complianceEvidenceLinks with data', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        complianceEvidenceLinks: ['https://example.com'],
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          complianceEvidenceLinks: ['https://example.com'],
        })
        .expect(200);
    });

    it('should handle primaryContacts with data', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        primaryContacts: [{ name: 'John Doe', email: 'john@example.com' }],
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          primaryContacts: [{ name: 'John Doe', email: 'john@example.com' }],
        })
        .expect(200);
    });

    it('should handle contractReferences with data', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        contractReferences: ['CONTRACT-001'],
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          contractReferences: ['CONTRACT-001'],
        })
        .expect(200);
    });

    it('should handle boolean fields correctly', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        processesCardholderData: true,
        processesPersonalData: false,
        customerFacingImpact: true,
        autoRenewal: false,
        cisoExemptionGranted: true,
        showInTrustCenter: true,
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          processesCardholderData: true,
          processesPersonalData: false,
          customerFacingImpact: true,
          autoRenewal: false,
          cisoExemptionGranted: true,
          showInTrustCenter: true,
        })
        .expect(200);

      const updateCall = prisma.supplier.update.mock.calls[0][0];
      expect(updateCall.data.processesCardholderData).toBe(true);
      expect(updateCall.data.processesPersonalData).toBe(false);
      expect(updateCall.data.customerFacingImpact).toBe(true);
      expect(updateCall.data.autoRenewal).toBe(false);
      expect(updateCall.data.cisoExemptionGranted).toBe(true);
      expect(updateCall.data.showInTrustCenter).toBe(true);
    });

    it('should handle string fields with empty strings', async () => {
      // Note: String fields with .isString() validation don't accept null
      // They must be strings, but can be empty
      const updatedSupplier = {
        ...mockSupplier,
        serviceDescription: '',
        riskRationale: '',
        criticalityRationale: '',
        dataProcessingAgreementRef: '',
        performanceNotes: '',
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          serviceDescription: '',
          riskRationale: '',
          criticalityRationale: '',
          dataProcessingAgreementRef: '',
          performanceNotes: '',
        })
        .expect(200);
    });

    it('should handle relationshipOwnerUserId as null', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        relationshipOwnerUserId: null,
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          relationshipOwnerUserId: null,
        })
        .expect(200);

      const updateCall = prisma.supplier.update.mock.calls[0][0];
      expect(updateCall.data.relationshipOwnerUserId).toBeNull();
    });

    it('should handle reviewDate with empty string as null', async () => {
      const updatedSupplier = {
        ...mockSupplier,
        reviewDate: null,
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(updatedSupplier);

      await request(app)
        .put(`/api/suppliers/${supplierId}`)
        .send({
          reviewDate: '',
        })
        .expect(200);

      const updateCall = prisma.supplier.update.mock.calls[0][0];
      expect(updateCall.data.reviewDate).toBeNull();
    });
  });

  describe('PATCH /api/suppliers/:id/archive', () => {
    const mockUser = mockUsers.admin();
    const supplierId = '550e8400-e29b-41d4-a716-446655440001';
    const mockSupplier = {
      id: supplierId,
      name: 'Supplier to Archive',
      status: 'ACTIVE',
    };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
    });

    it('should archive supplier by setting status to INACTIVE', async () => {
      const archivedSupplier = {
        ...mockSupplier,
        status: 'INACTIVE',
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(archivedSupplier);

      const response = await request(app)
        .patch(`/api/suppliers/${supplierId}/archive`)
        .expect(200);

      expect(response.body.status).toBe('INACTIVE');
      expect(prisma.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: supplierId },
          data: expect.objectContaining({
            status: 'INACTIVE',
            updatedByUserId: mockUser.id,
          }),
        })
      );
    });

    it('should validate UUID parameter', async () => {
      await request(app)
        .patch('/api/suppliers/invalid-id/archive')
        .expect(400);
    });

    it('should return 403 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await request(app)
        .patch(`/api/suppliers/${supplierId}/archive`)
        .expect(403);
    });

    it('should return 404 when supplier not found', async () => {
      const error: any = new Error('Record not found');
      error.code = 'P2025';

      prisma.supplier.update.mockRejectedValue(error);

      await request(app)
        .patch(`/api/suppliers/${supplierId}/archive`)
        .expect(404);
    });

    it('should handle database errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      prisma.supplier.update.mockRejectedValue(new Error('Database error'));

      await request(app)
        .patch(`/api/suppliers/${supplierId}/archive`)
        .expect(500);

      console.error = originalError;
    });

    it('should update updatedAt timestamp when archiving', async () => {
      const archivedSupplier = {
        ...mockSupplier,
        status: 'INACTIVE',
        updatedAt: new Date(),
        relationshipOwner: null,
        createdBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
        updatedBy: { id: mockUser.id, displayName: mockUser.displayName, email: mockUser.email },
      };

      prisma.supplier.update.mockResolvedValue(archivedSupplier);

      await request(app)
        .patch(`/api/suppliers/${supplierId}/archive`)
        .expect(200);

      const updateCall = prisma.supplier.update.mock.calls[0][0];
      expect(updateCall.data.updatedAt).toBeInstanceOf(Date);
      expect(updateCall.data.updatedByUserId).toBe(mockUser.id);
    });
  });
});

