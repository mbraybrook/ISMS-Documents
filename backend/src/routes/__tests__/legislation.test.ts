/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import legislationRouter from '../legislation';
import { prisma as prismaModule } from '../../lib/prisma';
import * as legislationImportService from '../../services/legislationImportService';
import * as fsModule from 'fs';
import * as multerConfig from '../../lib/multerConfig';

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
  requireDepartmentAccess: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    legislation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    legislationRisk: {
      count: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    risk: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock legislation import service
jest.mock('../../services/legislationImportService', () => ({
  importLegislationFromCSV: jest.fn(),
}));

// Mock multer config
jest.mock('../../lib/multerConfig', () => {
  const mockSingle = jest.fn((req: any, res: any, next: any) => {
    // Simulate file upload - can be overridden in tests
    next();
  });
  return {
    csvUpload: {
      single: jest.fn(() => mockSingle),
    },
    handleMulterError: jest.fn((req: any, res: any, next: any) => next()),
    __mockMulterSingle: mockSingle, // Export for test access
  };
});

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

describe('Legislation API', () => {
  let app: express.Application;
  let prisma: any;
  let importService: any;
  let fs: any;
  let mockMulterSingle: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/legislation', legislationRouter);
    prisma = prismaModule as any;
    importService = legislationImportService as any;
    fs = fsModule as any;
    mockMulterSingle = (multerConfig as any).__mockMulterSingle;
    jest.clearAllMocks();
  });

  describe('GET /api/legislation', () => {
    it('should return list of all legislation with risk counts', async () => {
      // Arrange
      const mockLegislation = [
        {
          id: 'leg-1',
          actRegulationRequirement: 'Test Act',
          dateAdded: new Date('2024-01-01'),
          _count: { risks: 2 },
        },
        {
          id: 'leg-2',
          actRegulationRequirement: 'Another Act',
          dateAdded: new Date('2024-01-02'),
          _count: { risks: 0 },
        },
      ];

      prisma.legislation.findMany.mockResolvedValue(mockLegislation);

      // Act
      const response = await request(app)
        .get('/api/legislation')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(2);
      expect(response.body[0].actRegulationRequirement).toBe('Test Act');
      expect(response.body[0]._count.risks).toBe(2);
      expect(prisma.legislation.findMany).toHaveBeenCalledWith({
        orderBy: { actRegulationRequirement: 'asc' },
        include: {
          _count: {
            select: { risks: true },
          },
        },
      });
    });

    it('should return empty array when no legislation exists', async () => {
      // Arrange
      prisma.legislation.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/legislation')
        .expect(200);

      // Assert
      expect(response.body).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      prisma.legislation.findMany.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .get('/api/legislation')
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to fetch legislation');
    });
  });

  describe('GET /api/legislation/:id', () => {
    it('should return legislation details with linked risks', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440001';
      const mockLegislation = {
        id: legislationId,
        actRegulationRequirement: 'Test Act',
        dateAdded: new Date('2024-01-01'),
        risks: [
          {
            risk: {
              id: 'risk-1',
              title: 'Test Risk',
              dateAdded: new Date('2024-01-01'),
              calculatedScore: 18,
            },
          },
        ],
        _count: { risks: 1 },
      };

      prisma.legislation.findUnique.mockResolvedValue(mockLegislation);

      // Act
      const response = await request(app)
        .get(`/api/legislation/${legislationId}`)
        .expect(200);

      // Assert
      expect(response.body.id).toBe(legislationId);
      expect(response.body.actRegulationRequirement).toBe('Test Act');
      expect(response.body.risks).toHaveLength(1);
      expect(response.body.risks[0].risk.title).toBe('Test Risk');
      expect(prisma.legislation.findUnique).toHaveBeenCalledWith({
        where: { id: legislationId },
        include: {
          risks: {
            include: {
              risk: {
                select: {
                  id: true,
                  title: true,
                  dateAdded: true,
                  calculatedScore: true,
                },
              },
            },
          },
          _count: {
            select: { risks: true },
          },
        },
      });
    });

    it('should return 404 when legislation not found', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440000';
      prisma.legislation.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get(`/api/legislation/${legislationId}`)
        .expect(404);

      // Assert
      expect(response.body.error).toBe('Legislation not found');
    });

    it('should return 400 for invalid UUID', async () => {
      // Act
      const response = await request(app)
        .get('/api/legislation/invalid-id')
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.legislation.findUnique.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .get(`/api/legislation/${legislationId}`)
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to fetch legislation');
    });
  });

  describe('POST /api/legislation', () => {
    it('should create new legislation without risk links', async () => {
      // Arrange
      const newLegislation = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        actRegulationRequirement: 'New Act',
        dateAdded: new Date('2024-01-01'),
        description: 'Test description',
        _count: { risks: 0 },
      };

      prisma.legislation.create.mockResolvedValue(newLegislation);

      // Act
      const response = await request(app)
        .post('/api/legislation')
        .send({
          actRegulationRequirement: 'New Act',
          dateAdded: '2024-01-01',
          description: 'Test description',
        })
        .expect(201);

      // Assert
      expect(response.body.actRegulationRequirement).toBe('New Act');
      expect(response.body.description).toBe('Test description');
      expect(prisma.legislation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actRegulationRequirement: 'New Act',
            description: 'Test description',
          }),
        })
      );
    });

    it('should create legislation with risk links', async () => {
      // Arrange
      const riskIds = ['risk-1', 'risk-2'];
      const newLegislation = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        actRegulationRequirement: 'New Act',
        _count: { risks: 2 },
      };

      prisma.legislation.create.mockResolvedValue(newLegislation);

      // Act
      const response = await request(app)
        .post('/api/legislation')
        .send({
          actRegulationRequirement: 'New Act',
          riskIds,
        })
        .expect(201);

      // Assert
      expect(response.body.actRegulationRequirement).toBe('New Act');
      expect(prisma.legislation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actRegulationRequirement: 'New Act',
            risks: {
              create: [
                { riskId: 'risk-1' },
                { riskId: 'risk-2' },
              ],
            },
          }),
        })
      );
    });

    it('should create legislation with empty riskIds array', async () => {
      // Arrange
      const newLegislation = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        actRegulationRequirement: 'New Act',
        _count: { risks: 0 },
      };

      prisma.legislation.create.mockResolvedValue(newLegislation);

      // Act
      const response = await request(app)
        .post('/api/legislation')
        .send({
          actRegulationRequirement: 'New Act',
          riskIds: [],
        })
        .expect(201);

      // Assert
      expect(response.body.actRegulationRequirement).toBe('New Act');
      expect(prisma.legislation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actRegulationRequirement: 'New Act',
          }),
        })
      );
      // Should not include risks when array is empty
      const createCall = prisma.legislation.create.mock.calls[0][0];
      expect(createCall.data.risks).toBeUndefined();
    });

    it('should validate required fields', async () => {
      // Act
      const response = await request(app)
        .post('/api/legislation')
        .send({
          // Missing actRegulationRequirement
        })
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
    });

    it('should validate actRegulationRequirement is not empty', async () => {
      // Act
      const response = await request(app)
        .post('/api/legislation')
        .send({
          actRegulationRequirement: '', // Empty string
        })
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
    });

    it('should validate dateAdded is ISO8601 format', async () => {
      // Act
      const response = await request(app)
        .post('/api/legislation')
        .send({
          actRegulationRequirement: 'Test Act',
          dateAdded: 'invalid-date',
        })
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      prisma.legislation.create.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .post('/api/legislation')
        .send({
          actRegulationRequirement: 'Test Act',
        })
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to create legislation');
    });
  });

  describe('PUT /api/legislation/:id', () => {
    it('should update legislation without risk links', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440001';
      const updatedLegislation = {
        id: legislationId,
        actRegulationRequirement: 'Updated Act',
        description: 'Updated description',
        _count: { risks: 0 },
      };

      prisma.legislation.update.mockResolvedValue(updatedLegislation);
      prisma.legislation.findUnique.mockResolvedValue(updatedLegislation);

      // Act
      const response = await request(app)
        .put(`/api/legislation/${legislationId}`)
        .send({
          actRegulationRequirement: 'Updated Act',
          description: 'Updated description',
        })
        .expect(200);

      // Assert
      expect(response.body.actRegulationRequirement).toBe('Updated Act');
      expect(response.body.description).toBe('Updated description');
      expect(prisma.legislation.update).toHaveBeenCalledWith({
        where: { id: legislationId },
        data: expect.objectContaining({
          actRegulationRequirement: 'Updated Act',
          description: 'Updated description',
        }),
      });
    });

    it('should update legislation and replace risk links', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440001';
      const newRiskIds = ['risk-3', 'risk-4'];
      const updatedLegislation = {
        id: legislationId,
        actRegulationRequirement: 'Updated Act',
        _count: { risks: 2 },
      };

      prisma.legislation.update.mockResolvedValue(updatedLegislation);
      prisma.legislationRisk.deleteMany.mockResolvedValue({ count: 2 });
      prisma.legislationRisk.createMany.mockResolvedValue({ count: 2 });
      prisma.legislation.findUnique.mockResolvedValue(updatedLegislation);

      // Act
      const response = await request(app)
        .put(`/api/legislation/${legislationId}`)
        .send({
          actRegulationRequirement: 'Updated Act',
          riskIds: newRiskIds,
        })
        .expect(200);

      // Assert
      expect(response.body.actRegulationRequirement).toBe('Updated Act');
      expect(prisma.legislationRisk.deleteMany).toHaveBeenCalledWith({
        where: { legislationId },
      });
      expect(prisma.legislationRisk.createMany).toHaveBeenCalledWith({
        data: [
          { legislationId, riskId: 'risk-3' },
          { legislationId, riskId: 'risk-4' },
        ],
      });
    });

    it('should clear risk links when empty array provided', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440001';
      const updatedLegislation = {
        id: legislationId,
        actRegulationRequirement: 'Updated Act',
        _count: { risks: 0 },
      };

      prisma.legislation.update.mockResolvedValue(updatedLegislation);
      prisma.legislationRisk.deleteMany.mockResolvedValue({ count: 2 });
      prisma.legislation.findUnique.mockResolvedValue(updatedLegislation);

      // Act
      const response = await request(app)
        .put(`/api/legislation/${legislationId}`)
        .send({
          actRegulationRequirement: 'Updated Act',
          riskIds: [],
        })
        .expect(200);

      // Assert
      expect(response.body.actRegulationRequirement).toBe('Updated Act');
      expect(prisma.legislationRisk.deleteMany).toHaveBeenCalledWith({
        where: { legislationId },
      });
      expect(prisma.legislationRisk.createMany).not.toHaveBeenCalled();
    });

    it('should not update risk links when riskIds is undefined', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440001';
      const updatedLegislation = {
        id: legislationId,
        actRegulationRequirement: 'Updated Act',
        _count: { risks: 1 },
      };

      prisma.legislation.update.mockResolvedValue(updatedLegislation);
      prisma.legislation.findUnique.mockResolvedValue(updatedLegislation);

      // Act
      const response = await request(app)
        .put(`/api/legislation/${legislationId}`)
        .send({
          actRegulationRequirement: 'Updated Act',
          // riskIds not provided
        })
        .expect(200);

      // Assert
      expect(response.body.actRegulationRequirement).toBe('Updated Act');
      expect(prisma.legislationRisk.deleteMany).not.toHaveBeenCalled();
      expect(prisma.legislationRisk.createMany).not.toHaveBeenCalled();
    });

    it('should return 404 when legislation not found', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440000';
      const error: any = new Error('Not found');
      error.code = 'P2025';
      prisma.legislation.update.mockRejectedValue(error);

      // Act
      const response = await request(app)
        .put(`/api/legislation/${legislationId}`)
        .send({
          actRegulationRequirement: 'Updated Act',
        })
        .expect(404);

      // Assert
      expect(response.body.error).toBe('Legislation not found');
    });

    it('should return 400 for invalid UUID', async () => {
      // Act
      const response = await request(app)
        .put('/api/legislation/invalid-id')
        .send({
          actRegulationRequirement: 'Updated Act',
        })
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.legislation.update.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .put(`/api/legislation/${legislationId}`)
        .send({
          actRegulationRequirement: 'Updated Act',
        })
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to update legislation');
    });
  });

  describe('DELETE /api/legislation/:id', () => {
    it('should delete legislation when not linked to risks', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.legislationRisk.count.mockResolvedValue(0);
      prisma.legislation.delete.mockResolvedValue({ id: legislationId });

      // Act
      await request(app)
        .delete(`/api/legislation/${legislationId}`)
        .expect(204);

      // Assert
      expect(prisma.legislationRisk.count).toHaveBeenCalledWith({
        where: { legislationId },
      });
      expect(prisma.legislation.delete).toHaveBeenCalledWith({
        where: { id: legislationId },
      });
    });

    it('should return 409 when legislation is linked to risks', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.legislationRisk.count.mockResolvedValue(3);

      // Act
      const response = await request(app)
        .delete(`/api/legislation/${legislationId}`)
        .expect(409);

      // Assert
      expect(response.body.error).toBe('Cannot delete legislation: it is linked to 3 risk(s)');
      expect(prisma.legislation.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when legislation not found', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440000';
      prisma.legislationRisk.count.mockResolvedValue(0);
      const error: any = new Error('Not found');
      error.code = 'P2025';
      prisma.legislation.delete.mockRejectedValue(error);

      // Act
      const response = await request(app)
        .delete(`/api/legislation/${legislationId}`)
        .expect(404);

      // Assert
      expect(response.body.error).toBe('Legislation not found');
    });

    it('should return 400 for invalid UUID', async () => {
      // Act
      const response = await request(app)
        .delete('/api/legislation/invalid-id')
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const legislationId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.legislationRisk.count.mockResolvedValue(0);
      prisma.legislation.delete.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .delete(`/api/legislation/${legislationId}`)
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to delete legislation');
    });
  });

  describe('POST /api/legislation/import', () => {
    it('should import legislation from uploaded file', async () => {
      // Arrange
      const mockFile = {
        buffer: Buffer.from('Date Added,Act / Regulation / Requirement\n2024-01-01,Test Act'),
        mimetype: 'text/csv',
        originalname: 'test.csv',
      };
      const mockResult = {
        success: 1,
        failed: 0,
        total: 1,
        errors: [],
      };

      importService.importLegislationFromCSV.mockResolvedValue(mockResult);
      mockMulterSingle.mockImplementation((req: any, res: any, next: any) => {
        req.file = mockFile;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/legislation/import')
        .attach('file', mockFile.buffer, 'test.csv')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(1);
      expect(response.body.total).toBe(1);
      expect(importService.importLegislationFromCSV).toHaveBeenCalledWith(mockFile.buffer);
    });

    it('should import legislation from file path (legacy support)', async () => {
      // Arrange
      const csvPath = '/path/to/file.csv';
      const mockResult = {
        success: 2,
        failed: 0,
        total: 2,
        errors: [],
      };

      fs.existsSync.mockReturnValue(true);
      importService.importLegislationFromCSV.mockResolvedValue(mockResult);
      mockMulterSingle.mockImplementation((req: any, res: any, next: any) => {
        req.file = undefined;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/legislation/import')
        .send({ filePath: csvPath })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(2);
      expect(fs.existsSync).toHaveBeenCalledWith(csvPath);
      expect(importService.importLegislationFromCSV).toHaveBeenCalledWith(csvPath);
    });

    it('should return 400 when file path does not exist', async () => {
      // Arrange
      const csvPath = '/path/to/nonexistent.csv';
      fs.existsSync.mockReturnValue(false);
      mockMulterSingle.mockImplementation((req: any, res: any, next: any) => {
        req.file = undefined;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/legislation/import')
        .send({ filePath: csvPath })
        .expect(400);

      // Assert
      expect(response.body.error).toBe(`CSV file not found: ${csvPath}`);
      expect(importService.importLegislationFromCSV).not.toHaveBeenCalled();
    });

    it('should return 400 when no file provided', async () => {
      // Arrange
      mockMulterSingle.mockImplementation((req: any, res: any, next: any) => {
        req.file = undefined;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/legislation/import')
        .send({})
        .expect(400);

      // Assert
      expect(response.body.error).toBe('No file provided. Please upload a CSV file.');
      expect(importService.importLegislationFromCSV).not.toHaveBeenCalled();
    });

    it('should handle import service errors gracefully', async () => {
      // Arrange
      const mockFile = {
        buffer: Buffer.from('invalid csv'),
        mimetype: 'text/csv',
        originalname: 'test.csv',
      };

      importService.importLegislationFromCSV.mockRejectedValue(
        new Error('Invalid CSV format')
      );
      mockMulterSingle.mockImplementation((req: any, res: any, next: any) => {
        req.file = mockFile;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/legislation/import')
        .attach('file', mockFile.buffer, 'test.csv')
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Invalid CSV format');
    });

    it('should handle import service errors without message', async () => {
      // Arrange
      const mockFile = {
        buffer: Buffer.from('invalid csv'),
        mimetype: 'text/csv',
        originalname: 'test.csv',
      };

      const errorWithoutMessage: any = new Error();
      errorWithoutMessage.message = undefined;
      importService.importLegislationFromCSV.mockRejectedValue(errorWithoutMessage);
      mockMulterSingle.mockImplementation((req: any, res: any, next: any) => {
        req.file = mockFile;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/legislation/import')
        .attach('file', mockFile.buffer, 'test.csv')
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to import legislation');
    });

    it('should return import result with errors', async () => {
      // Arrange
      const mockFile = {
        buffer: Buffer.from('Date Added,Act / Regulation / Requirement\n2024-01-01,Test Act'),
        mimetype: 'text/csv',
        originalname: 'test.csv',
      };
      const mockResult = {
        success: 1,
        failed: 1,
        total: 2,
        errors: [
          { row: 3, error: 'Missing Act / Regulation / Requirement' },
        ],
      };

      importService.importLegislationFromCSV.mockResolvedValue(mockResult);
      mockMulterSingle.mockImplementation((req: any, res: any, next: any) => {
        req.file = mockFile;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/legislation/import')
        .attach('file', mockFile.buffer, 'test.csv')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(1);
      expect(response.body.failed).toBe(1);
      expect(response.body.errors).toHaveLength(1);
    });
  });

  describe('POST /api/legislation/suggest-risks', () => {
    it('should suggest risks based on keyword matching', async () => {
      // Arrange
      const allRisks = [
        {
          id: 'risk-1',
          title: 'Data Protection Compliance Risk',
          description: 'Risk related to data protection',
          threatDescription: 'Data breach',
          riskCategory: 'Compliance',
        },
        {
          id: 'risk-2',
          title: 'Security Access Control',
          description: 'Access control issues',
          threatDescription: 'Unauthorized access',
          riskCategory: 'Security',
        },
        {
          id: 'risk-3',
          title: 'Unrelated Risk',
          description: 'No matching keywords',
          threatDescription: '',
          riskCategory: 'Other',
        },
      ];

      prisma.risk.findMany.mockResolvedValue(allRisks);

      // Act
      const response = await request(app)
        .post('/api/legislation/suggest-risks')
        .send({
          riskOfNonCompliance: 'Data protection compliance breach',
          actRegulationRequirement: 'GDPR',
          description: 'Privacy and security concerns',
        })
        .expect(200);

      // Assert
      expect(response.body.suggestedRiskIds).toBeDefined();
      expect(Array.isArray(response.body.suggestedRiskIds)).toBe(true);
      expect(response.body.totalMatches).toBeDefined();
      expect(prisma.risk.findMany).toHaveBeenCalledWith({
        where: {
          archived: false,
        },
        select: {
          id: true,
          title: true,
          description: true,
          threatDescription: true,
          riskCategory: true,
        },
      });
    });

    it('should suggest risks based on title word matches', async () => {
      // Arrange
      const allRisks = [
        {
          id: 'risk-1',
          title: 'Compliance Monitoring Risk',
          description: '',
          threatDescription: '',
          riskCategory: null,
        },
      ];

      prisma.risk.findMany.mockResolvedValue(allRisks);

      // Act
      const response = await request(app)
        .post('/api/legislation/suggest-risks')
        .send({
          riskOfNonCompliance: 'We need compliance monitoring',
        })
        .expect(200);

      // Assert
      expect(response.body.suggestedRiskIds).toContain('risk-1');
    });

    it('should suggest risks based on compliance term matches', async () => {
      // Arrange
      const allRisks = [
        {
          id: 'risk-1',
          title: 'Security Risk',
          description: 'Compliance and regulatory issues',
          threatDescription: '',
          riskCategory: null,
        },
      ];

      prisma.risk.findMany.mockResolvedValue(allRisks);

      // Act
      const response = await request(app)
        .post('/api/legislation/suggest-risks')
        .send({
          riskOfNonCompliance: 'Regulatory compliance breach',
        })
        .expect(200);

      // Assert
      expect(response.body.suggestedRiskIds).toContain('risk-1');
    });

    it('should suggest risks based on category matches', async () => {
      // Arrange
      const allRisks = [
        {
          id: 'risk-1',
          title: 'Test Risk',
          description: '',
          threatDescription: '',
          riskCategory: 'Security',
        },
      ];

      prisma.risk.findMany.mockResolvedValue(allRisks);

      // Act
      const response = await request(app)
        .post('/api/legislation/suggest-risks')
        .send({
          riskOfNonCompliance: 'Security concerns',
        })
        .expect(200);

      // Assert
      expect(response.body.suggestedRiskIds).toContain('risk-1');
    });

    it('should limit suggestions to top 10', async () => {
      // Arrange
      const allRisks = Array.from({ length: 15 }, (_, i) => ({
        id: `risk-${i + 1}`,
        title: `Compliance Risk ${i + 1}`,
        description: 'Compliance issue',
        threatDescription: '',
        riskCategory: 'Compliance',
      }));

      prisma.risk.findMany.mockResolvedValue(allRisks);

      // Act
      const response = await request(app)
        .post('/api/legislation/suggest-risks')
        .send({
          riskOfNonCompliance: 'Compliance breach',
        })
        .expect(200);

      // Assert
      expect(response.body.suggestedRiskIds.length).toBeLessThanOrEqual(10);
      expect(response.body.totalMatches).toBeGreaterThanOrEqual(10);
    });

    it('should return 400 when no text provided for analysis', async () => {
      // Act
      const response = await request(app)
        .post('/api/legislation/suggest-risks')
        .send({
          riskOfNonCompliance: '   ', // Only whitespace
          actRegulationRequirement: '',
          description: '',
        })
        .expect(400);

      // Assert
      expect(response.body.error).toBe('No text provided for analysis');
    });

    it('should validate required riskOfNonCompliance field', async () => {
      // Act
      const response = await request(app)
        .post('/api/legislation/suggest-risks')
        .send({
          // Missing riskOfNonCompliance
        })
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
    });

    it('should handle empty risks list', async () => {
      // Arrange
      prisma.risk.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .post('/api/legislation/suggest-risks')
        .send({
          riskOfNonCompliance: 'Test compliance issue',
        })
        .expect(200);

      // Assert
      expect(response.body.suggestedRiskIds).toEqual([]);
      expect(response.body.totalMatches).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      prisma.risk.findMany.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .post('/api/legislation/suggest-risks')
        .send({
          riskOfNonCompliance: 'Test compliance issue',
        })
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to generate risk suggestions');
    });

    it('should filter out archived risks', async () => {
      // Arrange
      const allRisks = [
        {
          id: 'risk-1',
          title: 'Active Compliance Risk',
          description: 'Compliance issue',
          threatDescription: '',
          riskCategory: null,
        },
      ];

      prisma.risk.findMany.mockResolvedValue(allRisks);

      // Act
      await request(app)
        .post('/api/legislation/suggest-risks')
        .send({
          riskOfNonCompliance: 'Compliance',
        })
        .expect(200);

      // Assert
      expect(prisma.risk.findMany).toHaveBeenCalledWith({
        where: {
          archived: false,
        },
        select: {
          id: true,
          title: true,
          description: true,
          threatDescription: true,
          riskCategory: true,
        },
      });
    });

    it('should handle risks with null or undefined title', async () => {
      // Arrange
      const allRisks = [
        {
          id: 'risk-1',
          title: null,
          description: 'Compliance issue',
          threatDescription: '',
          riskCategory: 'Compliance',
        },
        {
          id: 'risk-2',
          title: undefined,
          description: 'Security issue',
          threatDescription: '',
          riskCategory: 'Security',
        },
      ];

      prisma.risk.findMany.mockResolvedValue(allRisks);

      // Act
      const response = await request(app)
        .post('/api/legislation/suggest-risks')
        .send({
          riskOfNonCompliance: 'Compliance security',
        })
        .expect(200);

      // Assert
      expect(response.body.suggestedRiskIds).toBeDefined();
      expect(Array.isArray(response.body.suggestedRiskIds)).toBe(true);
    });
  });
});

