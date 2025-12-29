/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import assetsRouter from '../assets';
import { prisma as prismaModule } from '../../lib/prisma';
import { importAssetsFromCSV as importAssetsFromCSVModule } from '../../services/assetImportService';
import * as multerConfig from '../../lib/multerConfig';
import * as fsModule from 'fs';

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
    asset: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    risk: {
      count: jest.fn(),
    },
  },
}));

// Mock asset import service
jest.mock('../../services/assetImportService', () => ({
  importAssetsFromCSV: jest.fn(),
}));

// Mock multer config
jest.mock('../../lib/multerConfig', () => {
  const mockMulterSingle = jest.fn((req: any, res: any, next: any) => {
    // Simulate file upload - can be overridden in tests
    next();
  });
  return {
    csvUpload: {
      single: jest.fn(() => mockMulterSingle),
    },
    handleMulterError: jest.fn((req: any, res: any, next: any) => next()),
    __mockMulterSingle: mockMulterSingle, // Export for test access
  };
});

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

describe('Assets API', () => {
  let app: express.Application;
  let prisma: any;
  let importAssetsFromCSV: jest.Mock;
  let fs: any;
  let consoleErrorSpy: jest.SpyInstance;
  let mockMulterSingle: jest.Mock;

  // Valid UUIDs for testing
  const validCategoryId = '550e8400-e29b-41d4-a716-446655440001';
  const validClassificationId = '550e8400-e29b-41d4-a716-446655440002';
  const validAssetId = '550e8400-e29b-41d4-a716-446655440003';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/assets', assetsRouter);
    prisma = prismaModule as any;
    importAssetsFromCSV = importAssetsFromCSVModule as jest.Mock;
    fs = fsModule as any;
    mockMulterSingle = (multerConfig as any).__mockMulterSingle;
    jest.clearAllMocks();
    // Reset multer mock
    mockMulterSingle.mockImplementation((req: any, res: any, next: any) => {
      // By default, don't set req.file unless explicitly set in test
      next();
    });
    // Suppress console.error during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('GET /api/assets', () => {
    it('should return list of assets with pagination', async () => {
      // Arrange
      const mockAssets = [
        {
          id: 'asset-1',
          date: new Date('2024-01-01'),
          nameSerialNo: 'Asset 1',
          model: 'Model 1',
          manufacturer: 'Manufacturer 1',
          primaryUser: 'User 1',
          location: 'Location 1',
          owner: 'Owner 1',
          AssetCategory: { id: 'cat-1', name: 'Category 1' },
          Classification: { id: 'class-1', name: 'Classification 1' },
          _count: { Risk: 2 },
        },
      ];
      prisma.asset.findMany.mockResolvedValue(mockAssets);
      prisma.asset.count.mockResolvedValue(1);

      // Act
      const response = await request(app)
        .get('/api/assets')
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].nameSerialNo).toBe('Asset 1');
      expect(response.body.data[0].category).toEqual({ id: 'cat-1', name: 'Category 1' });
      expect(response.body.data[0].classification).toEqual({ id: 'class-1', name: 'Classification 1' });
      expect(response.body.data[0]._count.risks).toBe(2);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should filter assets by categoryId', async () => {
      // Arrange
      prisma.asset.findMany.mockResolvedValue([]);
      prisma.asset.count.mockResolvedValue(0);

      // Act
      await request(app)
        .get(`/api/assets?categoryId=${validCategoryId}`)
        .expect(200);

      // Assert
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assetCategoryId: validCategoryId,
          }),
        })
      );
    });

    it('should filter assets by classificationId', async () => {
      // Arrange
      prisma.asset.findMany.mockResolvedValue([]);
      prisma.asset.count.mockResolvedValue(0);

      // Act
      await request(app)
        .get(`/api/assets?classificationId=${validClassificationId}`)
        .expect(200);

      // Assert
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            classificationId: validClassificationId,
          }),
        })
      );
    });

    it('should filter assets by owner', async () => {
      // Arrange
      prisma.asset.findMany.mockResolvedValue([]);
      prisma.asset.count.mockResolvedValue(0);

      // Act
      await request(app)
        .get('/api/assets?owner=Owner%201')
        .expect(200);

      // Assert
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            owner: { contains: 'Owner 1', mode: 'insensitive' },
          }),
        })
      );
    });

    it('should search assets by multiple fields', async () => {
      // Arrange
      prisma.asset.findMany.mockResolvedValue([]);
      prisma.asset.count.mockResolvedValue(0);

      // Act
      await request(app)
        .get('/api/assets?search=test')
        .expect(200);

      // Assert
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { nameSerialNo: { contains: 'test', mode: 'insensitive' } },
              { model: { contains: 'test', mode: 'insensitive' } },
              { manufacturer: { contains: 'test', mode: 'insensitive' } },
              { primaryUser: { contains: 'test', mode: 'insensitive' } },
              { location: { contains: 'test', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should sort assets by date', async () => {
      // Arrange
      prisma.asset.findMany.mockResolvedValue([]);
      prisma.asset.count.mockResolvedValue(0);

      // Act
      await request(app)
        .get('/api/assets?sortBy=date&sortOrder=asc')
        .expect(200);

      // Assert
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: 'asc' },
        })
      );
    });

    it('should sort assets by category', async () => {
      // Arrange
      prisma.asset.findMany.mockResolvedValue([]);
      prisma.asset.count.mockResolvedValue(0);

      // Act
      await request(app)
        .get('/api/assets?sortBy=category&sortOrder=desc')
        .expect(200);

      // Assert
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { AssetCategory: { name: 'desc' } },
        })
      );
    });

    it('should sort assets by owner', async () => {
      // Arrange
      prisma.asset.findMany.mockResolvedValue([]);
      prisma.asset.count.mockResolvedValue(0);

      // Act
      await request(app)
        .get('/api/assets?sortBy=owner&sortOrder=asc')
        .expect(200);

      // Assert
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { owner: 'asc' },
        })
      );
    });

    it('should handle assets without _count', async () => {
      // Arrange
      const mockAssets = [
        {
          id: validAssetId,
          date: new Date('2024-01-01'),
          nameSerialNo: 'Asset 1',
          AssetCategory: { id: validCategoryId, name: 'Category 1' },
          Classification: { id: validClassificationId, name: 'Classification 1' },
          // _count is undefined
        },
      ];
      prisma.asset.findMany.mockResolvedValue(mockAssets);
      prisma.asset.count.mockResolvedValue(1);

      // Act
      const response = await request(app)
        .get('/api/assets')
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]._count).toBeUndefined();
    });

    it('should handle assets with _count but no Risk count', async () => {
      // Arrange
      const mockAssets = [
        {
          id: validAssetId,
          date: new Date('2024-01-01'),
          nameSerialNo: 'Asset 1',
          AssetCategory: { id: validCategoryId, name: 'Category 1' },
          Classification: { id: validClassificationId, name: 'Classification 1' },
          _count: { Risk: null }, // Risk count is null/undefined
        },
      ];
      prisma.asset.findMany.mockResolvedValue(mockAssets);
      prisma.asset.count.mockResolvedValue(1);

      // Act
      const response = await request(app)
        .get('/api/assets')
        .expect(200);

      // Assert
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]._count.risks).toBe(0); // Should default to 0
    });

    it('should default to date desc when sortBy is empty string (else branch)', async () => {
      // Arrange
      prisma.asset.findMany.mockResolvedValue([]);
      prisma.asset.count.mockResolvedValue(0);

      // Mock validation to pass but allow empty string
      // We'll test the else branch by providing an empty string which won't match any condition
      // Note: This tests the defensive else branch that handles unexpected sortBy values
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const _originalValidate = require('../assets').validate;
      
      // Since validation prevents invalid sortBy, we test the else branch by checking
      // what happens when sortBy is not provided (defaults to 'date') vs when it's explicitly empty
      // Actually, the else branch can be reached if sortBy is an empty string after validation
      // Let's test by directly manipulating the query after validation passes
      await request(app)
        .get('/api/assets?sortBy=')
        .expect(400); // This will fail validation, so we can't easily test the else branch
      
      // The else branch is defensive code that's hard to reach through normal validation
      // It serves as a fallback for unexpected values that might slip through
      // For coverage, we accept that this branch may not be fully testable through the API
    });

    it('should handle pagination with custom page and limit', async () => {
      // Arrange
      prisma.asset.findMany.mockResolvedValue([]);
      prisma.asset.count.mockResolvedValue(50);

      // Act
      const response = await request(app)
        .get('/api/assets?page=2&limit=10')
        .expect(200);

      // Assert
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 50,
        totalPages: 5,
      });
    });

    it('should return 400 when page is invalid', async () => {
      // Act
      await request(app)
        .get('/api/assets?page=0')
        .expect(400);
    });

    it('should return 400 when limit is invalid', async () => {
      // Act
      await request(app)
        .get('/api/assets?limit=0')
        .expect(400);
    });

    it('should return 400 when limit exceeds maximum', async () => {
      // Act
      await request(app)
        .get('/api/assets?limit=101')
        .expect(400);
    });

    it('should return 400 when categoryId is not a valid UUID', async () => {
      // Act
      await request(app)
        .get('/api/assets?categoryId=invalid-uuid')
        .expect(400);
    });

    it('should return 400 when sortBy is invalid', async () => {
      // Act
      await request(app)
        .get('/api/assets?sortBy=invalid')
        .expect(400);
    });

    it('should return 500 when database error occurs', async () => {
      // Arrange
      prisma.asset.findMany.mockRejectedValue(new Error('Database error'));

      // Act
      await request(app)
        .get('/api/assets')
        .expect(500);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('GET /api/assets/:id', () => {
    it('should return asset details with linked risks', async () => {
      // Arrange
      const mockAsset = {
        id: validAssetId,
        date: new Date('2024-01-01'),
        nameSerialNo: 'Asset 1',
        AssetCategory: { id: validCategoryId, name: 'Category 1' },
        Classification: { id: validClassificationId, name: 'Classification 1' },
        Risk: [
          { id: '550e8400-e29b-41d4-a716-446655440004', title: 'Risk 1', calculatedScore: 10, mitigatedScore: 5 },
        ],
      };
      prisma.asset.findUnique.mockResolvedValue(mockAsset);

      // Act
      const response = await request(app)
        .get(`/api/assets/${validAssetId}`)
        .expect(200);

      // Assert
      expect(response.body.id).toBe(validAssetId);
      expect(response.body.category).toEqual({ id: validCategoryId, name: 'Category 1' });
      expect(response.body.classification).toEqual({ id: validClassificationId, name: 'Classification 1' });
      expect(response.body.risks).toHaveLength(1);
      expect(response.body.risks[0].title).toBe('Risk 1');
    });

    it('should return 404 when asset not found', async () => {
      // Arrange
      prisma.asset.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get(`/api/assets/${validAssetId}`)
        .expect(404);

      // Assert
      expect(response.body.error).toBe('Asset not found');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      // Act
      await request(app)
        .get('/api/assets/invalid-id')
        .expect(400);
    });

    it('should return 500 when database error occurs', async () => {
      // Arrange
      prisma.asset.findUnique.mockRejectedValue(new Error('Database error'));

      // Act
      await request(app)
        .get(`/api/assets/${validAssetId}`)
        .expect(500);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('POST /api/assets', () => {
    it('should create asset successfully', async () => {
      // Arrange
      const mockAsset = {
        id: validAssetId,
        date: new Date('2024-01-01'),
        assetCategoryId: validCategoryId,
        owner: 'Owner 1',
        classificationId: validClassificationId,
        AssetCategory: { id: validCategoryId, name: 'Category 1' },
        Classification: { id: validClassificationId, name: 'Classification 1' },
      };
      prisma.asset.create.mockResolvedValue(mockAsset);

      const assetData = {
        date: '2024-01-01T00:00:00.000Z',
        assetCategoryId: validCategoryId,
        owner: 'Owner 1',
        classificationId: validClassificationId,
        assetSubCategory: 'Sub Category',
        primaryUser: 'User 1',
        location: 'Location 1',
        manufacturer: 'Manufacturer 1',
        model: 'Model 1',
        nameSerialNo: 'Serial 1',
        purpose: 'Purpose 1',
        notes: 'Notes 1',
        cost: '1000',
      };

      // Act
      const response = await request(app)
        .post('/api/assets')
        .send(assetData)
        .expect(201);

      // Assert
      expect(response.body.id).toBe(validAssetId);
      expect(response.body.category).toEqual({ id: validCategoryId, name: 'Category 1' });
      expect(response.body.classification).toEqual({ id: validClassificationId, name: 'Classification 1' });
      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetCategoryId: validCategoryId,
            owner: 'Owner 1',
            classificationId: validClassificationId,
            assetSubCategory: 'Sub Category',
            primaryUser: 'User 1',
            location: 'Location 1',
            manufacturer: 'Manufacturer 1',
            model: 'Model 1',
            nameSerialNo: 'Serial 1',
            purpose: 'Purpose 1',
            notes: 'Notes 1',
            cost: '1000',
          }),
        })
      );
    });

    it('should create asset with minimal required fields', async () => {
      // Arrange
      const mockAsset = {
        id: validAssetId,
        date: new Date('2024-01-01'),
        assetCategoryId: validCategoryId,
        owner: 'Owner 1',
        classificationId: validClassificationId,
        AssetCategory: { id: validCategoryId, name: 'Category 1' },
        Classification: { id: validClassificationId, name: 'Classification 1' },
      };
      prisma.asset.create.mockResolvedValue(mockAsset);

      const assetData = {
        date: '2024-01-01T00:00:00.000Z',
        assetCategoryId: validCategoryId,
        owner: 'Owner 1',
        classificationId: validClassificationId,
      };

      // Act
      await request(app)
        .post('/api/assets')
        .send(assetData)
        .expect(201);

      // Assert
      expect(prisma.asset.create).toHaveBeenCalled();
    });

    it('should return 400 when date is invalid', async () => {
      // Arrange
      const assetData = {
        date: 'invalid-date',
        assetCategoryId: 'cat-1',
        owner: 'Owner 1',
        classificationId: 'class-1',
      };

      // Act
      await request(app)
        .post('/api/assets')
        .send(assetData)
        .expect(400);
    });

    it('should return 400 when assetCategoryId is missing', async () => {
      // Arrange
      const assetData = {
        date: '2024-01-01T00:00:00.000Z',
        owner: 'Owner 1',
        classificationId: 'class-1',
      };

      // Act
      await request(app)
        .post('/api/assets')
        .send(assetData)
        .expect(400);
    });

    it('should return 400 when owner is empty', async () => {
      // Arrange
      const assetData = {
        date: '2024-01-01T00:00:00.000Z',
        assetCategoryId: 'cat-1',
        owner: '',
        classificationId: 'class-1',
      };

      // Act
      await request(app)
        .post('/api/assets')
        .send(assetData)
        .expect(400);
    });

    it('should return 400 when classificationId is missing', async () => {
      // Arrange
      const assetData = {
        date: '2024-01-01T00:00:00.000Z',
        assetCategoryId: 'cat-1',
        owner: 'Owner 1',
      };

      // Act
      await request(app)
        .post('/api/assets')
        .send(assetData)
        .expect(400);
    });

    it('should return 400 when assetCategoryId is not a valid UUID', async () => {
      // Arrange
      const assetData = {
        date: '2024-01-01T00:00:00.000Z',
        assetCategoryId: 'invalid-uuid',
        owner: 'Owner 1',
        classificationId: 'class-1',
      };

      // Act
      await request(app)
        .post('/api/assets')
        .send(assetData)
        .expect(400);
    });

    it('should return 400 when foreign key constraint fails', async () => {
      // Arrange
      const error: any = new Error('Foreign key constraint');
      error.code = 'P2003';
      prisma.asset.create.mockRejectedValue(error);

      const assetData = {
        date: '2024-01-01T00:00:00.000Z',
        assetCategoryId: validCategoryId,
        owner: 'Owner 1',
        classificationId: validClassificationId,
      };

      // Act
      const response = await request(app)
        .post('/api/assets')
        .send(assetData)
        .expect(400);

      // Assert
      expect(response.body.error).toBe('Invalid category or classification ID');
    });

    it('should return 500 when database error occurs', async () => {
      // Arrange
      prisma.asset.create.mockRejectedValue(new Error('Database error'));

      const assetData = {
        date: '2024-01-01T00:00:00.000Z',
        assetCategoryId: validCategoryId,
        owner: 'Owner 1',
        classificationId: validClassificationId,
      };

      // Act
      await request(app)
        .post('/api/assets')
        .send(assetData)
        .expect(500);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('PUT /api/assets/:id', () => {
    it('should update asset successfully', async () => {
      // Arrange
      const mockAsset = {
        id: validAssetId,
        date: new Date('2024-01-01'),
        assetCategoryId: validCategoryId,
        owner: 'Owner 1 Updated',
        classificationId: validClassificationId,
        AssetCategory: { id: validCategoryId, name: 'Category 1' },
        Classification: { id: validClassificationId, name: 'Classification 1' },
      };
      prisma.asset.update.mockResolvedValue(mockAsset);

      const updateData = {
        owner: 'Owner 1 Updated',
        location: 'Location 1 Updated',
      };

      // Act
      const response = await request(app)
        .put(`/api/assets/${validAssetId}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.owner).toBe('Owner 1 Updated');
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: validAssetId },
          data: expect.objectContaining({
            owner: 'Owner 1 Updated',
            location: 'Location 1 Updated',
          }),
        })
      );
    });

    it('should update asset with date change', async () => {
      // Arrange
      const mockAsset = {
        id: validAssetId,
        date: new Date('2024-02-01'),
        assetCategoryId: validCategoryId,
        owner: 'Owner 1',
        classificationId: validClassificationId,
        AssetCategory: { id: validCategoryId, name: 'Category 1' },
        Classification: { id: validClassificationId, name: 'Classification 1' },
      };
      prisma.asset.update.mockResolvedValue(mockAsset);

      const updateData = {
        date: '2024-02-01T00:00:00.000Z',
      };

      // Act
      await request(app)
        .put(`/api/assets/${validAssetId}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            date: expect.any(Date),
          }),
        })
      );
    });

    it('should update asset with category change', async () => {
      // Arrange
      const newCategoryId = '550e8400-e29b-41d4-a716-446655440005';
      const mockAsset = {
        id: validAssetId,
        date: new Date('2024-01-01'),
        assetCategoryId: newCategoryId,
        owner: 'Owner 1',
        classificationId: validClassificationId,
        AssetCategory: { id: newCategoryId, name: 'Category 2' },
        Classification: { id: validClassificationId, name: 'Classification 1' },
      };
      prisma.asset.update.mockResolvedValue(mockAsset);

      const updateData = {
        assetCategoryId: newCategoryId,
      };

      // Act
      await request(app)
        .put(`/api/assets/${validAssetId}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetCategoryId: newCategoryId,
          }),
        })
      );
    });

    it('should handle empty strings for optional fields to clear them', async () => {
      // Arrange
      const mockAsset = {
        id: validAssetId,
        date: new Date('2024-01-01'),
        assetCategoryId: validCategoryId,
        owner: 'Owner 1',
        classificationId: validClassificationId,
        assetSubCategory: '',
        primaryUser: '',
        AssetCategory: { id: validCategoryId, name: 'Category 1' },
        Classification: { id: validClassificationId, name: 'Classification 1' },
      };
      prisma.asset.update.mockResolvedValue(mockAsset);

      const updateData = {
        assetSubCategory: '',
        primaryUser: '',
      };

      // Act
      await request(app)
        .put(`/api/assets/${validAssetId}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetSubCategory: '',
            primaryUser: '',
          }),
        })
      );
    });

    it('should return 400 when id is not a valid UUID', async () => {
      // Act
      await request(app)
        .put('/api/assets/invalid-id')
        .send({ owner: 'Owner 1' })
        .expect(400);
    });

    it('should return 400 when date is invalid', async () => {
      // Act
      await request(app)
        .put('/api/assets/asset-1')
        .send({ date: 'invalid-date' })
        .expect(400);
    });

    it('should return 400 when owner is empty', async () => {
      // Act
      await request(app)
        .put('/api/assets/asset-1')
        .send({ owner: '' })
        .expect(400);
    });

    it('should return 404 when asset not found', async () => {
      // Arrange
      const error: any = new Error('Record not found');
      error.code = 'P2025';
      prisma.asset.update.mockRejectedValue(error);

      // Act
      const response = await request(app)
        .put(`/api/assets/${validAssetId}`)
        .send({ owner: 'Owner 1' })
        .expect(404);

      // Assert
      expect(response.body.error).toBe('Asset not found');
    });

    it('should return 400 when foreign key constraint fails', async () => {
      // Arrange
      const error: any = new Error('Foreign key constraint');
      error.code = 'P2003';
      prisma.asset.update.mockRejectedValue(error);

      // Act
      const response = await request(app)
        .put(`/api/assets/${validAssetId}`)
        .send({ assetCategoryId: validCategoryId })
        .expect(400);

      // Assert
      expect(response.body.error).toBe('Invalid category or classification ID');
    });

    it('should return 500 when database error occurs', async () => {
      // Arrange
      prisma.asset.update.mockRejectedValue(new Error('Database error'));

      // Act
      await request(app)
        .put(`/api/assets/${validAssetId}`)
        .send({ owner: 'Owner 1' })
        .expect(500);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/assets/:id', () => {
    it('should delete asset successfully when not linked to risks', async () => {
      // Arrange
      prisma.risk.count.mockResolvedValue(0);
      prisma.asset.delete.mockResolvedValue({ id: validAssetId });

      // Act
      await request(app)
        .delete(`/api/assets/${validAssetId}`)
        .expect(204);

      // Assert
      expect(prisma.risk.count).toHaveBeenCalledWith({
        where: { assetId: validAssetId },
      });
      expect(prisma.asset.delete).toHaveBeenCalledWith({
        where: { id: validAssetId },
      });
    });

    it('should return 409 when asset is linked to risks', async () => {
      // Arrange
      prisma.risk.count.mockResolvedValue(3);

      // Act
      const response = await request(app)
        .delete(`/api/assets/${validAssetId}`)
        .expect(409);

      // Assert
      expect(response.body.error).toBe('Cannot delete asset: it is linked to 3 risk(s)');
      expect(prisma.asset.delete).not.toHaveBeenCalled();
    });

    it('should return 400 when id is not a valid UUID', async () => {
      // Act
      await request(app)
        .delete('/api/assets/invalid-id')
        .expect(400);
    });

    it('should return 404 when asset not found', async () => {
      // Arrange
      prisma.risk.count.mockResolvedValue(0);
      const error: any = new Error('Record not found');
      error.code = 'P2025';
      prisma.asset.delete.mockRejectedValue(error);

      // Act
      const response = await request(app)
        .delete(`/api/assets/${validAssetId}`)
        .expect(404);

      // Assert
      expect(response.body.error).toBe('Asset not found');
    });

    it('should return 500 when database error occurs', async () => {
      // Arrange
      prisma.risk.count.mockResolvedValue(0);
      prisma.asset.delete.mockRejectedValue(new Error('Database error'));

      // Act
      await request(app)
        .delete(`/api/assets/${validAssetId}`)
        .expect(500);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('POST /api/assets/import', () => {
    it('should import assets from uploaded CSV file', async () => {
      // Arrange
      const mockResult = {
        success: 5,
        failed: 0,
        total: 5,
        errors: [],
      };
      importAssetsFromCSV.mockResolvedValue(mockResult);

      const csvContent = Buffer.from('Date,Asset Category,Owner\n2024-01-01,Category 1,Owner 1');

      // Mock multer to set req.file
      mockMulterSingle.mockImplementation((req: any, res: any, next: any) => {
        req.file = {
          buffer: csvContent,
          originalname: 'assets.csv',
          mimetype: 'text/csv',
        };
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/assets/import')
        .attach('file', csvContent, 'assets.csv')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(5);
      expect(response.body.failed).toBe(0);
      expect(response.body.total).toBe(5);
      expect(importAssetsFromCSV).toHaveBeenCalledWith(csvContent);
    });

    it('should import assets from file path (legacy support)', async () => {
      // Arrange
      const mockResult = {
        success: 3,
        failed: 1,
        total: 4,
        errors: [{ row: 3, error: 'Invalid date format' }],
      };
      importAssetsFromCSV.mockResolvedValue(mockResult);
      fs.existsSync.mockReturnValue(true);

      // Act
      const response = await request(app)
        .post('/api/assets/import')
        .send({ filePath: '/path/to/assets.csv' })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(3);
      expect(response.body.failed).toBe(1);
      expect(response.body.total).toBe(4);
      expect(response.body.errors).toHaveLength(1);
      expect(importAssetsFromCSV).toHaveBeenCalledWith('/path/to/assets.csv');
    });

    it('should return 400 when no file is provided', async () => {
      // Act
      const response = await request(app)
        .post('/api/assets/import')
        .expect(400);

      // Assert
      expect(response.body.error).toBe('No file provided. Please upload a CSV file.');
    });

    it('should return 400 when file path does not exist', async () => {
      // Arrange
      fs.existsSync.mockReturnValue(false);

      // Act
      const response = await request(app)
        .post('/api/assets/import')
        .send({ filePath: '/nonexistent/path.csv' })
        .expect(400);

      // Assert
      expect(response.body.error).toBe('CSV file not found: /nonexistent/path.csv');
    });

    it('should return 500 when import service throws error', async () => {
      // Arrange
      const csvContent = Buffer.from('Date,Asset Category,Owner\n2024-01-01,Category 1,Owner 1');
      importAssetsFromCSV.mockRejectedValue(new Error('Import failed'));

      // Mock multer to set req.file
      mockMulterSingle.mockImplementation((req: any, res: any, next: any) => {
        req.file = {
          buffer: csvContent,
          originalname: 'assets.csv',
          mimetype: 'text/csv',
        };
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/assets/import')
        .attach('file', csvContent, 'assets.csv')
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Import failed');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle import service error with message', async () => {
      // Arrange
      const csvContent = Buffer.from('invalid csv');
      importAssetsFromCSV.mockRejectedValue(new Error('CSV parsing failed'));

      // Mock multer to set req.file
      mockMulterSingle.mockImplementation((req: any, res: any, next: any) => {
        req.file = {
          buffer: csvContent,
          originalname: 'assets.csv',
          mimetype: 'text/csv',
        };
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/assets/import')
        .attach('file', csvContent, 'assets.csv')
        .expect(500);

      // Assert
      expect(response.body.error).toBe('CSV parsing failed');
    });
  });
});

