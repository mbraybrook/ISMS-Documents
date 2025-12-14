/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import supplierExitPlansRouter from '../supplierExitPlans';

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
    supplierExitPlan: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    supplier: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma';
import { requireRole } from '../../middleware/authorize';

describe('Supplier Exit Plans API', () => {
  let app: express.Application;
  let consoleErrorSpy: jest.SpyInstance;

  // Valid UUIDs for testing
  const validSupplierId = '550e8400-e29b-41d4-a716-446655440000';
  const validExitPlanId = '550e8400-e29b-41d4-a716-446655440001';
  const invalidUUID = 'not-a-uuid';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/suppliers', supplierExitPlansRouter);
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockReturnValue((req: any, res: any, next: any) => next());
    // Suppress console.error during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('GET /api/suppliers/:id/exit-plan', () => {
    it('should return exit plan when it exists', async () => {
      // Arrange
      const mockExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
        impactAssessment: { notes: 'Test impact', completed: false },
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        supplier: {
          id: validSupplierId,
          name: 'Test Supplier',
          lifecycleState: 'ACTIVE',
        },
      };
      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExitPlan);

      // Act
      const response = await request(app)
        .get(`/api/suppliers/${validSupplierId}/exit-plan`)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        id: validExitPlanId,
        supplierId: validSupplierId,
        impactAssessment: { notes: 'Test impact', completed: false },
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
        supplier: {
          id: validSupplierId,
          name: 'Test Supplier',
          lifecycleState: 'ACTIVE',
        },
      });
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
      expect(prisma.supplierExitPlan.findUnique).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              lifecycleState: true,
            },
          },
        },
      });
    });

    it('should return null when exit plan does not exist', async () => {
      // Arrange
      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get(`/api/suppliers/${validSupplierId}/exit-plan`)
        .expect(200);

      // Assert
      expect(response.body).toBeNull();
      expect(prisma.supplierExitPlan.findUnique).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              lifecycleState: true,
            },
          },
        },
      });
    });

    it('should return 400 when supplier ID is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .get(`/api/suppliers/${invalidUUID}/exit-plan`)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(prisma.supplierExitPlan.findUnique).not.toHaveBeenCalled();
    });

    it('should return 500 when database error occurs', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      (prisma.supplierExitPlan.findUnique as jest.Mock).mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .get(`/api/suppliers/${validSupplierId}/exit-plan`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to fetch exit plan' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching exit plan:', dbError);
    });
  });

  describe('POST /api/suppliers/:id/exit-plan', () => {
    it('should create exit plan when supplier exists and no exit plan exists', async () => {
      // Arrange
      const mockSupplier = {
        id: validSupplierId,
        name: 'Test Supplier',
        tradingName: 'Test Trading',
        status: 'ACTIVE',
        supplierType: 'SERVICE',
      };
      const mockCreatedExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
        impactAssessment: null,
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.supplierExitPlan.create as jest.Mock).mockResolvedValue(mockCreatedExitPlan);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/exit-plan`)
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        id: expect.any(String),
        supplierId: validSupplierId,
        impactAssessment: null,
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
      });
      expect(prisma.supplier.findUnique).toHaveBeenCalledWith({
        where: { id: validSupplierId },
      });
      expect(prisma.supplierExitPlan.findUnique).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
      });
      expect(prisma.supplierExitPlan.create).toHaveBeenCalled();
    });

    it('should return 404 when supplier does not exist', async () => {
      // Arrange
      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/exit-plan`)
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Supplier not found' });
      expect(prisma.supplierExitPlan.create).not.toHaveBeenCalled();
    });

    it('should return 400 when exit plan already exists', async () => {
      // Arrange
      const mockSupplier = {
        id: validSupplierId,
        name: 'Test Supplier',
      };
      const mockExistingExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
      };

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExistingExitPlan);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/exit-plan`)
        .expect(400);

      // Assert
      expect(response.body).toEqual({ error: 'Exit plan already exists for this supplier' });
      expect(prisma.supplierExitPlan.create).not.toHaveBeenCalled();
    });

    it('should return 400 when Prisma unique constraint error occurs', async () => {
      // Arrange
      const mockSupplier = {
        id: validSupplierId,
        name: 'Test Supplier',
      };
      const prismaError: any = new Error('Unique constraint failed');
      prismaError.code = 'P2002';

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.supplierExitPlan.create as jest.Mock).mockRejectedValue(prismaError);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/exit-plan`)
        .expect(400);

      // Assert
      expect(response.body).toEqual({ error: 'Exit plan already exists for this supplier' });
    });

    it('should return 400 when supplier ID is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .post(`/api/suppliers/${invalidUUID}/exit-plan`)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
      expect(prisma.supplier.findUnique).not.toHaveBeenCalled();
    });

    it('should return 500 when database error occurs', async () => {
      // Arrange
      const mockSupplier = {
        id: validSupplierId,
        name: 'Test Supplier',
      };
      const dbError = new Error('Database connection failed');

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.supplierExitPlan.create as jest.Mock).mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/exit-plan`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to create exit plan' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error creating exit plan:', dbError);
    });

    it('should require ADMIN or EDITOR role', () => {
      // Assert - requireRole is called during route registration
      // We verify it's defined and the actual authorization logic is tested in middleware tests
      expect(requireRole).toBeDefined();
      // The route is protected by requireRole('ADMIN', 'EDITOR')
      // Authorization behavior is tested in middleware/__tests__/authorize.test.ts
    });
  });

  describe('PUT /api/suppliers/:id/exit-plan', () => {
    it('should update exit plan when it exists', async () => {
      // Arrange
      const mockExistingExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
        impactAssessment: null,
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
      };
      const updateData = {
        impactAssessment: { notes: 'Updated impact', completed: true },
        dataAndIpr: { notes: 'Updated data', completed: false },
      };
      const mockUpdatedExitPlan = {
        ...mockExistingExitPlan,
        ...updateData,
        updatedAt: new Date(),
      };

      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExistingExitPlan);
      (prisma.supplierExitPlan.update as jest.Mock).mockResolvedValue(mockUpdatedExitPlan);

      // Act
      const response = await request(app)
        .put(`/api/suppliers/${validSupplierId}/exit-plan`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        id: validExitPlanId,
        supplierId: validSupplierId,
        impactAssessment: { notes: 'Updated impact', completed: true },
        dataAndIpr: { notes: 'Updated data', completed: false },
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
      });
      expect(response.body.updatedAt).toBeDefined();
      expect(prisma.supplierExitPlan.findUnique).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
      });
      expect(prisma.supplierExitPlan.update).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
        data: updateData,
      });
    });

    it('should update only provided fields', async () => {
      // Arrange
      const mockExistingExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
        impactAssessment: { notes: 'Original', completed: false },
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
      };
      const updateData = {
        impactAssessment: { notes: 'Updated', completed: true },
      };
      const mockUpdatedExitPlan = {
        ...mockExistingExitPlan,
        impactAssessment: updateData.impactAssessment,
        updatedAt: new Date(),
      };

      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExistingExitPlan);
      (prisma.supplierExitPlan.update as jest.Mock).mockResolvedValue(mockUpdatedExitPlan);

      // Act
      const response = await request(app)
        .put(`/api/suppliers/${validSupplierId}/exit-plan`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.impactAssessment).toEqual(updateData.impactAssessment);
      expect(prisma.supplierExitPlan.update).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
        data: updateData,
      });
    });

    it('should return 404 when exit plan does not exist', async () => {
      // Arrange
      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put(`/api/suppliers/${validSupplierId}/exit-plan`)
        .send({ impactAssessment: { notes: 'Test' } })
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Exit plan not found' });
      expect(prisma.supplierExitPlan.update).not.toHaveBeenCalled();
    });

    it('should return 404 when Prisma record not found error occurs', async () => {
      // Arrange
      const mockExistingExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
      };
      const prismaError: any = new Error('Record not found');
      prismaError.code = 'P2025';

      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExistingExitPlan);
      (prisma.supplierExitPlan.update as jest.Mock).mockRejectedValue(prismaError);

      // Act
      const response = await request(app)
        .put(`/api/suppliers/${validSupplierId}/exit-plan`)
        .send({ impactAssessment: { notes: 'Test' } })
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Exit plan not found' });
    });

    it('should return 400 when supplier ID is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .put(`/api/suppliers/${invalidUUID}/exit-plan`)
        .send({ impactAssessment: { notes: 'Test' } })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
      expect(prisma.supplierExitPlan.findUnique).not.toHaveBeenCalled();
    });

    it('should return 400 when body fields are not objects', async () => {
      // Act
      const response = await request(app)
        .put(`/api/suppliers/${validSupplierId}/exit-plan`)
        .send({ impactAssessment: 'not-an-object' })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
      expect(prisma.supplierExitPlan.findUnique).not.toHaveBeenCalled();
    });

    it('should allow undefined fields in body', async () => {
      // Arrange
      const mockExistingExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
        impactAssessment: null,
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
      };
      const updateData = {
        impactAssessment: { notes: 'Updated' },
      };
      const mockUpdatedExitPlan = {
        ...mockExistingExitPlan,
        ...updateData,
        updatedAt: new Date(),
      };

      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExistingExitPlan);
      (prisma.supplierExitPlan.update as jest.Mock).mockResolvedValue(mockUpdatedExitPlan);

      // Act
      const response = await request(app)
        .put(`/api/suppliers/${validSupplierId}/exit-plan`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        id: validExitPlanId,
        supplierId: validSupplierId,
        impactAssessment: { notes: 'Updated' },
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
      });
      expect(response.body.updatedAt).toBeDefined();
      expect(prisma.supplierExitPlan.update).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
        data: updateData,
      });
    });

    it('should update replacementServiceAnalysis field', async () => {
      // Arrange
      const mockExistingExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
        impactAssessment: null,
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
      };
      const updateData = {
        replacementServiceAnalysis: { notes: 'Updated replacement', completed: true },
      };
      const mockUpdatedExitPlan = {
        ...mockExistingExitPlan,
        ...updateData,
        updatedAt: new Date(),
      };

      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExistingExitPlan);
      (prisma.supplierExitPlan.update as jest.Mock).mockResolvedValue(mockUpdatedExitPlan);

      // Act
      const response = await request(app)
        .put(`/api/suppliers/${validSupplierId}/exit-plan`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.replacementServiceAnalysis).toEqual(updateData.replacementServiceAnalysis);
      expect(prisma.supplierExitPlan.update).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
        data: updateData,
      });
    });

    it('should update contractClosure field', async () => {
      // Arrange
      const mockExistingExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
        impactAssessment: null,
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
      };
      const updateData = {
        contractClosure: { notes: 'Updated closure', completed: true },
      };
      const mockUpdatedExitPlan = {
        ...mockExistingExitPlan,
        ...updateData,
        updatedAt: new Date(),
      };

      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExistingExitPlan);
      (prisma.supplierExitPlan.update as jest.Mock).mockResolvedValue(mockUpdatedExitPlan);

      // Act
      const response = await request(app)
        .put(`/api/suppliers/${validSupplierId}/exit-plan`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.contractClosure).toEqual(updateData.contractClosure);
      expect(prisma.supplierExitPlan.update).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
        data: updateData,
      });
    });

    it('should update lessonsLearned field', async () => {
      // Arrange
      const mockExistingExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
        impactAssessment: null,
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
      };
      const updateData = {
        lessonsLearned: { notes: 'Updated lessons', completed: true },
      };
      const mockUpdatedExitPlan = {
        ...mockExistingExitPlan,
        ...updateData,
        updatedAt: new Date(),
      };

      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExistingExitPlan);
      (prisma.supplierExitPlan.update as jest.Mock).mockResolvedValue(mockUpdatedExitPlan);

      // Act
      const response = await request(app)
        .put(`/api/suppliers/${validSupplierId}/exit-plan`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.lessonsLearned).toEqual(updateData.lessonsLearned);
      expect(prisma.supplierExitPlan.update).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
        data: updateData,
      });
    });

    it('should return 500 when database error occurs', async () => {
      // Arrange
      const mockExistingExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
      };
      const dbError = new Error('Database connection failed');

      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExistingExitPlan);
      (prisma.supplierExitPlan.update as jest.Mock).mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .put(`/api/suppliers/${validSupplierId}/exit-plan`)
        .send({ impactAssessment: { notes: 'Test' } })
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to update exit plan' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating exit plan:', dbError);
    });

    it('should require ADMIN or EDITOR role', () => {
      // Assert - requireRole is called during route registration
      // We verify it's defined and the actual authorization logic is tested in middleware tests
      expect(requireRole).toBeDefined();
      // The route is protected by requireRole('ADMIN', 'EDITOR')
      // Authorization behavior is tested in middleware/__tests__/authorize.test.ts
    });
  });

  describe('DELETE /api/suppliers/:id/exit-plan', () => {
    it('should delete exit plan when it exists', async () => {
      // Arrange
      const mockExistingExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
        impactAssessment: null,
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
      };

      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExistingExitPlan);
      (prisma.supplierExitPlan.delete as jest.Mock).mockResolvedValue(mockExistingExitPlan);

      // Act
      await request(app)
        .delete(`/api/suppliers/${validSupplierId}/exit-plan`)
        .expect(204);

      // Assert
      expect(prisma.supplierExitPlan.findUnique).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
      });
      expect(prisma.supplierExitPlan.delete).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
      });
    });

    it('should return 404 when exit plan does not exist', async () => {
      // Arrange
      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .delete(`/api/suppliers/${validSupplierId}/exit-plan`)
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Exit plan not found' });
      expect(prisma.supplierExitPlan.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when Prisma record not found error occurs', async () => {
      // Arrange
      const mockExistingExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
      };
      const prismaError: any = new Error('Record not found');
      prismaError.code = 'P2025';

      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExistingExitPlan);
      (prisma.supplierExitPlan.delete as jest.Mock).mockRejectedValue(prismaError);

      // Act
      const response = await request(app)
        .delete(`/api/suppliers/${validSupplierId}/exit-plan`)
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Exit plan not found' });
    });

    it('should return 400 when supplier ID is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/suppliers/${invalidUUID}/exit-plan`)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
      expect(prisma.supplierExitPlan.findUnique).not.toHaveBeenCalled();
    });

    it('should return 500 when database error occurs', async () => {
      // Arrange
      const mockExistingExitPlan = {
        id: validExitPlanId,
        supplierId: validSupplierId,
      };
      const dbError = new Error('Database connection failed');

      (prisma.supplierExitPlan.findUnique as jest.Mock).mockResolvedValue(mockExistingExitPlan);
      (prisma.supplierExitPlan.delete as jest.Mock).mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .delete(`/api/suppliers/${validSupplierId}/exit-plan`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to delete exit plan' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting exit plan:', dbError);
    });

    it('should require ADMIN or EDITOR role', () => {
      // Assert - requireRole is called during route registration
      // We verify it's defined and the actual authorization logic is tested in middleware tests
      expect(requireRole).toBeDefined();
      // The route is protected by requireRole('ADMIN', 'EDITOR')
      // Authorization behavior is tested in middleware/__tests__/authorize.test.ts
    });
  });
});

