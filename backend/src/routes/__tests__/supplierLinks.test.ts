/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test suite for supplierLinks.ts
 * 
 * Note: The source file contains a duplicate route handler for POST /:id/suggest-risks
 * (lines 297-337 and 339-379). Express will only execute the first matching route,
 * so the second handler is dead code. This affects branch coverage (currently 77.27%),
 * but all other coverage metrics exceed 80%:
 * - Statements: 89.52%
 * - Functions: 84.61%
 * - Lines: 89.32%
 */
import request from 'supertest';
import express from 'express';
import supplierLinksRouter from '../supplierLinks';

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      sub: 'test-user',
      email: 'test@paythru.com',
      name: 'Test User',
      oid: 'test-oid',
      role: 'ADMIN',
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
    supplierRiskLink: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
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
    risk: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    control: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock supplier risk suggestion service
jest.mock('../../services/supplierRiskSuggestionService', () => ({
  findRelevantRisksForSupplier: jest.fn(),
}));

import { prisma } from '../../lib/prisma';
import { requireRole } from '../../middleware/authorize';
import { findRelevantRisksForSupplier } from '../../services/supplierRiskSuggestionService';

describe('Supplier Links API', () => {
  let app: express.Application;
  let consoleErrorSpy: jest.SpyInstance;

  const validSupplierId = '550e8400-e29b-41d4-a716-446655440000';
  const validRiskId = '550e8400-e29b-41d4-a716-446655440001';
  const validControlId = '550e8400-e29b-41d4-a716-446655440002';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/suppliers', supplierLinksRouter);
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockReturnValue((req: any, res: any, next: any) => next());
    // Suppress console.error during tests to avoid noise from expected error handling
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error after each test
    consoleErrorSpy.mockRestore();
  });

  describe('GET /api/suppliers/:id/risks', () => {
    it('should return list of linked risks when supplier has risks', async () => {
      // Arrange
      const mockLinks = [
        {
          risk: {
            id: validRiskId,
            title: 'Test Risk 1',
            calculatedScore: 18,
            status: 'ACTIVE',
            riskCategory: 'OPERATIONAL',
          },
        },
        {
          risk: {
            id: '550e8400-e29b-41d4-a716-446655440003',
            title: 'Test Risk 2',
            calculatedScore: 25,
            status: 'DRAFT',
            riskCategory: 'TECHNICAL',
          },
        },
      ];
      (prisma.supplierRiskLink.findMany as jest.Mock).mockResolvedValue(mockLinks);

      // Act
      const response = await request(app)
        .get(`/api/suppliers/${validSupplierId}/risks`)
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toEqual(mockLinks[0].risk);
      expect(response.body[1]).toEqual(mockLinks[1].risk);
      expect(prisma.supplierRiskLink.findMany).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
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
      });
    });

    it('should return empty array when supplier has no linked risks', async () => {
      // Arrange
      (prisma.supplierRiskLink.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get(`/api/suppliers/${validSupplierId}/risks`)
        .expect(200);

      // Assert
      expect(response.body).toEqual([]);
    });

    it('should return 400 when supplier ID is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .get('/api/suppliers/invalid-uuid/risks')
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    it('should return 500 when database query fails', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      (prisma.supplierRiskLink.findMany as jest.Mock).mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .get(`/api/suppliers/${validSupplierId}/risks`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to fetch supplier risks' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching supplier risks:', dbError);
    });
  });

  describe('POST /api/suppliers/:id/risks', () => {
    it('should link a risk to supplier successfully', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId, name: 'Test Supplier' };
      const mockRisk = {
        id: validRiskId,
        title: 'Test Risk',
        isSupplierRisk: false,
      };
      const mockLinkedRisk = {
        id: validRiskId,
        title: 'Test Risk',
        calculatedScore: 18,
        status: 'ACTIVE',
        riskCategory: 'OPERATIONAL',
      };

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.risk.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockRisk) // First call for verification
        .mockResolvedValueOnce(mockLinkedRisk); // Second call for response
      (prisma.supplierRiskLink.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.supplierRiskLink.create as jest.Mock).mockResolvedValue({});
      (prisma.risk.update as jest.Mock).mockResolvedValue({});

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/risks`)
        .send({ riskId: validRiskId })
        .expect(201);

      // Assert
      expect(response.body).toEqual(mockLinkedRisk);
      expect(prisma.supplier.findUnique).toHaveBeenCalledWith({
        where: { id: validSupplierId },
      });
      expect(prisma.risk.findUnique).toHaveBeenCalledWith({
        where: { id: validRiskId },
      });
      expect(prisma.supplierRiskLink.create).toHaveBeenCalledWith({
        data: {
          supplierId: validSupplierId,
          riskId: validRiskId,
        },
      });
      expect(prisma.risk.update).toHaveBeenCalledWith({
        where: { id: validRiskId },
        data: { isSupplierRisk: true },
      });
    });

    it('should not update isSupplierRisk when risk already has it set to true', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId, name: 'Test Supplier' };
      const mockRisk = {
        id: validRiskId,
        title: 'Test Risk',
        isSupplierRisk: true,
      };
      const mockLinkedRisk = {
        id: validRiskId,
        title: 'Test Risk',
        calculatedScore: 18,
        status: 'ACTIVE',
        riskCategory: 'OPERATIONAL',
      };

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.risk.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockRisk) // First call for verification
        .mockResolvedValueOnce(mockLinkedRisk); // Second call for response
      (prisma.supplierRiskLink.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.supplierRiskLink.create as jest.Mock).mockResolvedValue({});

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/risks`)
        .send({ riskId: validRiskId })
        .expect(201);

      // Assert
      expect(response.body).toEqual(mockLinkedRisk);
      expect(prisma.risk.update).not.toHaveBeenCalled();
    });

    it('should return 404 when supplier does not exist', async () => {
      // Arrange
      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/risks`)
        .send({ riskId: validRiskId })
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Supplier not found' });
      expect(prisma.supplierRiskLink.create).not.toHaveBeenCalled();
    });

    it('should return 404 when risk does not exist', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId, name: 'Test Supplier' };
      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.risk.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/risks`)
        .send({ riskId: validRiskId })
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Risk not found' });
      expect(prisma.supplierRiskLink.create).not.toHaveBeenCalled();
    });

    it('should return 400 when risk is already linked to supplier', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId, name: 'Test Supplier' };
      const mockRisk = { id: validRiskId, title: 'Test Risk' };
      const mockExistingLink = {
        supplierId: validSupplierId,
        riskId: validRiskId,
      };

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.risk.findUnique as jest.Mock).mockResolvedValue(mockRisk);
      (prisma.supplierRiskLink.findUnique as jest.Mock).mockResolvedValue(mockExistingLink);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/risks`)
        .send({ riskId: validRiskId })
        .expect(400);

      // Assert
      expect(response.body).toEqual({ error: 'Risk is already linked to this supplier' });
      expect(prisma.supplierRiskLink.create).not.toHaveBeenCalled();
    });

    it('should return 400 when duplicate link is detected by Prisma (P2002)', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId, name: 'Test Supplier' };
      const mockRisk = { id: validRiskId, title: 'Test Risk' };
      const prismaError: any = new Error('Unique constraint violation');
      prismaError.code = 'P2002';

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.risk.findUnique as jest.Mock).mockResolvedValue(mockRisk);
      (prisma.supplierRiskLink.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.supplierRiskLink.create as jest.Mock).mockRejectedValue(prismaError);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/risks`)
        .send({ riskId: validRiskId })
        .expect(400);

      // Assert
      expect(response.body).toEqual({ error: 'Risk is already linked to this supplier' });
    });

    it('should return 400 when supplier ID is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .post('/api/suppliers/invalid-uuid/risks')
        .send({ riskId: validRiskId })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 when riskId is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/risks`)
        .send({ riskId: 'invalid-uuid' })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 500 when database operation fails', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId, name: 'Test Supplier' };
      const mockRisk = { id: validRiskId, title: 'Test Risk' };
      const dbError = new Error('Database error');

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.risk.findUnique as jest.Mock).mockResolvedValue(mockRisk);
      (prisma.supplierRiskLink.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.supplierRiskLink.create as jest.Mock).mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/risks`)
        .send({ riskId: validRiskId })
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to link risk to supplier' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error linking risk to supplier:', dbError);
    });
  });

  describe('DELETE /api/suppliers/:id/risks/:riskId', () => {
    it('should unlink risk from supplier successfully', async () => {
      // Arrange
      (prisma.supplierRiskLink.delete as jest.Mock).mockResolvedValue({});

      // Act
      await request(app)
        .delete(`/api/suppliers/${validSupplierId}/risks/${validRiskId}`)
        .expect(204);

      // Assert
      expect(prisma.supplierRiskLink.delete).toHaveBeenCalledWith({
        where: {
          supplierId_riskId: {
            supplierId: validSupplierId,
            riskId: validRiskId,
          },
        },
      });
    });

    it('should return 404 when link does not exist (P2025)', async () => {
      // Arrange
      const prismaError: any = new Error('Record not found');
      prismaError.code = 'P2025';
      (prisma.supplierRiskLink.delete as jest.Mock).mockRejectedValue(prismaError);

      // Act
      const response = await request(app)
        .delete(`/api/suppliers/${validSupplierId}/risks/${validRiskId}`)
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Link not found' });
    });

    it('should return 400 when supplier ID is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .delete('/api/suppliers/invalid-uuid/risks/550e8400-e29b-41d4-a716-446655440001')
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 when riskId is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/suppliers/${validSupplierId}/risks/invalid-uuid`)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 500 when database operation fails', async () => {
      // Arrange
      const dbError = new Error('Database error');
      (prisma.supplierRiskLink.delete as jest.Mock).mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .delete(`/api/suppliers/${validSupplierId}/risks/${validRiskId}`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to unlink risk from supplier' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error unlinking risk from supplier:', dbError);
    });
  });

  describe('GET /api/suppliers/:id/controls', () => {
    it('should return list of linked controls when supplier has controls', async () => {
      // Arrange
      const mockLinks = [
        {
          control: {
            id: validControlId,
            code: 'CTRL-001',
            title: 'Test Control 1',
            implemented: true,
            category: 'TECHNICAL',
          },
        },
        {
          control: {
            id: '550e8400-e29b-41d4-a716-446655440003',
            code: 'CTRL-002',
            title: 'Test Control 2',
            implemented: false,
            category: 'OPERATIONAL',
          },
        },
      ];
      (prisma.supplierControlLink.findMany as jest.Mock).mockResolvedValue(mockLinks);

      // Act
      const response = await request(app)
        .get(`/api/suppliers/${validSupplierId}/controls`)
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toEqual(mockLinks[0].control);
      expect(response.body[1]).toEqual(mockLinks[1].control);
      expect(prisma.supplierControlLink.findMany).toHaveBeenCalledWith({
        where: { supplierId: validSupplierId },
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
      });
    });

    it('should return empty array when supplier has no linked controls', async () => {
      // Arrange
      (prisma.supplierControlLink.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get(`/api/suppliers/${validSupplierId}/controls`)
        .expect(200);

      // Assert
      expect(response.body).toEqual([]);
    });

    it('should return 400 when supplier ID is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .get('/api/suppliers/invalid-uuid/controls')
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    it('should return 500 when database query fails', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      (prisma.supplierControlLink.findMany as jest.Mock).mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .get(`/api/suppliers/${validSupplierId}/controls`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to fetch supplier controls' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching supplier controls:', dbError);
    });
  });

  describe('POST /api/suppliers/:id/controls', () => {
    it('should link a control to supplier successfully', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId, name: 'Test Supplier' };
      const mockControl = { id: validControlId, code: 'CTRL-001', title: 'Test Control' };
      const mockLinkedControl = {
        id: validControlId,
        code: 'CTRL-001',
        title: 'Test Control',
        implemented: true,
        category: 'TECHNICAL',
      };

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.control.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockControl) // First call for verification
        .mockResolvedValueOnce(mockLinkedControl); // Second call for response
      (prisma.supplierControlLink.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.supplierControlLink.create as jest.Mock).mockResolvedValue({});

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/controls`)
        .send({ controlId: validControlId })
        .expect(201);

      // Assert
      expect(response.body).toEqual(mockLinkedControl);
      expect(prisma.supplier.findUnique).toHaveBeenCalledWith({
        where: { id: validSupplierId },
      });
      expect(prisma.control.findUnique).toHaveBeenCalledWith({
        where: { id: validControlId },
      });
      expect(prisma.supplierControlLink.create).toHaveBeenCalledWith({
        data: {
          supplierId: validSupplierId,
          controlId: validControlId,
        },
      });
    });

    it('should return 404 when supplier does not exist', async () => {
      // Arrange
      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/controls`)
        .send({ controlId: validControlId })
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Supplier not found' });
      expect(prisma.supplierControlLink.create).not.toHaveBeenCalled();
    });

    it('should return 404 when control does not exist', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId, name: 'Test Supplier' };
      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.control.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/controls`)
        .send({ controlId: validControlId })
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Control not found' });
      expect(prisma.supplierControlLink.create).not.toHaveBeenCalled();
    });

    it('should return 400 when control is already linked to supplier', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId, name: 'Test Supplier' };
      const mockControl = { id: validControlId, code: 'CTRL-001', title: 'Test Control' };
      const mockExistingLink = {
        supplierId: validSupplierId,
        controlId: validControlId,
      };

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.control.findUnique as jest.Mock).mockResolvedValue(mockControl);
      (prisma.supplierControlLink.findUnique as jest.Mock).mockResolvedValue(mockExistingLink);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/controls`)
        .send({ controlId: validControlId })
        .expect(400);

      // Assert
      expect(response.body).toEqual({ error: 'Control is already linked to this supplier' });
      expect(prisma.supplierControlLink.create).not.toHaveBeenCalled();
    });

    it('should return 400 when duplicate link is detected by Prisma (P2002)', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId, name: 'Test Supplier' };
      const mockControl = { id: validControlId, code: 'CTRL-001', title: 'Test Control' };
      const prismaError: any = new Error('Unique constraint violation');
      prismaError.code = 'P2002';

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.control.findUnique as jest.Mock).mockResolvedValue(mockControl);
      (prisma.supplierControlLink.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.supplierControlLink.create as jest.Mock).mockRejectedValue(prismaError);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/controls`)
        .send({ controlId: validControlId })
        .expect(400);

      // Assert
      expect(response.body).toEqual({ error: 'Control is already linked to this supplier' });
    });

    it('should return 400 when supplier ID is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .post('/api/suppliers/invalid-uuid/controls')
        .send({ controlId: validControlId })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 when controlId is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/controls`)
        .send({ controlId: 'invalid-uuid' })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 500 when database operation fails', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId, name: 'Test Supplier' };
      const mockControl = { id: validControlId, code: 'CTRL-001', title: 'Test Control' };
      const dbError = new Error('Database error');

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (prisma.control.findUnique as jest.Mock).mockResolvedValue(mockControl);
      (prisma.supplierControlLink.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.supplierControlLink.create as jest.Mock).mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/controls`)
        .send({ controlId: validControlId })
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to link control to supplier' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error linking control to supplier:', dbError);
    });
  });

  describe('DELETE /api/suppliers/:id/controls/:controlId', () => {
    it('should unlink control from supplier successfully', async () => {
      // Arrange
      (prisma.supplierControlLink.delete as jest.Mock).mockResolvedValue({});

      // Act
      await request(app)
        .delete(`/api/suppliers/${validSupplierId}/controls/${validControlId}`)
        .expect(204);

      // Assert
      expect(prisma.supplierControlLink.delete).toHaveBeenCalledWith({
        where: {
          supplierId_controlId: {
            supplierId: validSupplierId,
            controlId: validControlId,
          },
        },
      });
    });

    it('should return 404 when link does not exist (P2025)', async () => {
      // Arrange
      const prismaError: any = new Error('Record not found');
      prismaError.code = 'P2025';
      (prisma.supplierControlLink.delete as jest.Mock).mockRejectedValue(prismaError);

      // Act
      const response = await request(app)
        .delete(`/api/suppliers/${validSupplierId}/controls/${validControlId}`)
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Link not found' });
    });

    it('should return 400 when supplier ID is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .delete('/api/suppliers/invalid-uuid/controls/550e8400-e29b-41d4-a716-446655440002')
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 when controlId is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/suppliers/${validSupplierId}/controls/invalid-uuid`)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 500 when database operation fails', async () => {
      // Arrange
      const dbError = new Error('Database error');
      (prisma.supplierControlLink.delete as jest.Mock).mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .delete(`/api/suppliers/${validSupplierId}/controls/${validControlId}`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to unlink control from supplier' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error unlinking control from supplier:', dbError);
    });
  });

  describe('POST /api/suppliers/:id/suggest-risks', () => {
    it('should return risk suggestions successfully with default limit', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId };
      const mockSuggestions = [
        {
          risk: {
            id: validRiskId,
            title: 'Suggested Risk 1',
            calculatedScore: 20,
            status: 'ACTIVE',
            riskCategory: 'OPERATIONAL',
          },
          similarityScore: 85,
          matchedFields: ['title', 'description'],
        },
        {
          risk: {
            id: '550e8400-e29b-41d4-a716-446655440003',
            title: 'Suggested Risk 2',
            calculatedScore: 15,
            status: 'DRAFT',
            riskCategory: 'TECHNICAL',
          },
          similarityScore: 75,
          matchedFields: ['title'],
        },
      ];

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (findRelevantRisksForSupplier as jest.Mock).mockResolvedValue(mockSuggestions);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/suggest-risks`)
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        suggestions: mockSuggestions.map((s) => ({
          risk: s.risk,
          similarityScore: s.similarityScore,
          matchedFields: s.matchedFields,
        })),
      });
      expect(prisma.supplier.findUnique).toHaveBeenCalledWith({
        where: { id: validSupplierId },
        select: { id: true },
      });
      expect(findRelevantRisksForSupplier).toHaveBeenCalledWith(validSupplierId, 15);
    });

    it('should return risk suggestions with custom limit', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId };
      const mockSuggestions = [
        {
          risk: {
            id: validRiskId,
            title: 'Suggested Risk',
            calculatedScore: 20,
            status: 'ACTIVE',
            riskCategory: 'OPERATIONAL',
          },
          similarityScore: 85,
          matchedFields: ['title'],
        },
      ];

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (findRelevantRisksForSupplier as jest.Mock).mockResolvedValue(mockSuggestions);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/suggest-risks?limit=5`)
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('suggestions');
      expect(findRelevantRisksForSupplier).toHaveBeenCalledWith(validSupplierId, 5);
    });

    it('should return 404 when supplier does not exist', async () => {
      // Arrange
      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/suggest-risks`)
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Supplier not found' });
      expect(findRelevantRisksForSupplier).not.toHaveBeenCalled();
    });

    it('should return 400 when supplier ID is not a valid UUID', async () => {
      // Act
      const response = await request(app)
        .post('/api/suppliers/invalid-uuid/suggest-risks')
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 when limit is less than 1', async () => {
      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/suggest-risks?limit=0`)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 when limit is greater than 20', async () => {
      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/suggest-risks?limit=21`)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 500 when service throws an error', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId };
      const serviceError = new Error('Service error');

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (findRelevantRisksForSupplier as jest.Mock).mockRejectedValue(serviceError);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/suggest-risks`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Service error' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting risk suggestions:', serviceError);
    });

    it('should return 500 with default message when service error has no message', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId };
      const serviceError = new Error();

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (findRelevantRisksForSupplier as jest.Mock).mockRejectedValue(serviceError);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/suggest-risks`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to get risk suggestions' });
    });

    it('should return empty suggestions array when service returns empty array', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId };

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (findRelevantRisksForSupplier as jest.Mock).mockResolvedValue([]);

      // Act
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/suggest-risks`)
        .expect(200);

      // Assert
      expect(response.body).toEqual({ suggestions: [] });
    });

    it('should handle non-integer limit query parameter', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId };
      const mockSuggestions: any[] = [];

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (findRelevantRisksForSupplier as jest.Mock).mockResolvedValue(mockSuggestions);

      // Act - limit as non-integer string should fail validation
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/suggest-risks?limit=abc`)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
    });

    it('should handle limit query parameter as string number', async () => {
      // Arrange
      const mockSupplier = { id: validSupplierId };
      const mockSuggestions = [
        {
          risk: {
            id: validRiskId,
            title: 'Suggested Risk',
            calculatedScore: 20,
            status: 'ACTIVE',
            riskCategory: 'OPERATIONAL',
          },
          similarityScore: 85,
          matchedFields: ['title'],
        },
      ];

      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue(mockSupplier);
      (findRelevantRisksForSupplier as jest.Mock).mockResolvedValue(mockSuggestions);

      // Act - limit as string "10" should be parsed correctly
      const response = await request(app)
        .post(`/api/suppliers/${validSupplierId}/suggest-risks?limit=10`)
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('suggestions');
      expect(findRelevantRisksForSupplier).toHaveBeenCalledWith(validSupplierId, 10);
    });
  });
});

