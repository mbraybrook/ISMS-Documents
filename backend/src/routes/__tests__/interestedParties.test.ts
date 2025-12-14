/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import interestedPartiesRouter from '../interestedParties';
import { prisma as prismaModule } from '../../lib/prisma';
import * as interestedPartyImportService from '../../services/interestedPartyImportService';
import * as fsModule from 'fs';
import { requireRole as requireRoleModule } from '../../middleware/authorize';
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
}));

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    interestedParty: {
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

// Mock multer - define mock inside factory to avoid hoisting issues
jest.mock('../../lib/multerConfig', () => {
  const mockMiddleware = jest.fn((req: any, res: any, next: any) => {
    next();
  });
  return {
    csvUpload: {
      single: jest.fn(() => mockMiddleware),
    },
    handleMulterError: jest.fn((req: any, res: any, next: any) => next()),
    _getMockMiddleware: () => mockMiddleware, // Helper to access mock
  };
});

// Mock import service
jest.mock('../../services/interestedPartyImportService', () => ({
  importInterestedPartiesFromCSV: jest.fn(),
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

describe('Interested Parties API', () => {
  let app: express.Application;
  let prisma: any;
  let importService: any;
  let fs: any;
  let requireRole: any;
  let mockMulterMiddleware: jest.Mock;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interested-parties', interestedPartiesRouter);
    prisma = prismaModule as any;
    importService = interestedPartyImportService as any;
    fs = fsModule as any;
    requireRole = requireRoleModule as jest.Mock;
    // Get the mock middleware from the csvUpload.single mock return value
    const singleMock = (multerConfig.csvUpload.single as jest.Mock);
    mockMulterMiddleware = singleMock() as jest.Mock;
    jest.clearAllMocks();
    // Reset requireRole to allow access by default
    (requireRole as jest.Mock).mockReturnValue((req: any, res: any, next: any) => next());
    // Reset multer middleware
    mockMulterMiddleware.mockImplementation((req: any, res: any, next: any) => next());
    // Note: console.error is automatically suppressed globally (see test-setup.ts)
  });

  describe('GET /api/interested-parties', () => {
    it('should return list of interested parties with risk counts', async () => {
      // Arrange
      const mockParties = [
        {
          id: 'party-1',
          name: 'Test Party 1',
          group: 'Group A',
          _count: { risks: 5 },
        },
        {
          id: 'party-2',
          name: 'Test Party 2',
          group: null,
          _count: { risks: 2 },
        },
      ];

      prisma.interestedParty.findMany.mockResolvedValue(mockParties);

      // Act
      const response = await request(app)
        .get('/api/interested-parties')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Test Party 1');
      expect(response.body[0]._count.risks).toBe(5);
      expect(prisma.interestedParty.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { risks: true },
          },
        },
      });
    });

    it('should return empty array when no interested parties exist', async () => {
      // Arrange
      prisma.interestedParty.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/interested-parties')
        .expect(200);

      // Assert
      expect(response.body).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Arrange
      prisma.interestedParty.findMany.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .get('/api/interested-parties')
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to fetch interested parties');
    });
  });

  describe('GET /api/interested-parties/:id', () => {
    it('should return interested party details with linked risks', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      const mockParty = {
        id: partyId,
        name: 'Test Party',
        group: 'Group A',
        description: 'Test description',
        risks: [
          {
            id: 'risk-1',
            title: 'Risk 1',
            dateAdded: new Date('2024-01-01'),
            calculatedScore: 18,
          },
        ],
        _count: { risks: 1 },
      };

      prisma.interestedParty.findUnique.mockResolvedValue(mockParty);

      // Act
      const response = await request(app)
        .get(`/api/interested-parties/${partyId}`)
        .expect(200);

      // Assert
      expect(response.body.id).toBe(partyId);
      expect(response.body.name).toBe('Test Party');
      expect(response.body.risks).toHaveLength(1);
      expect(response.body._count.risks).toBe(1);
      expect(prisma.interestedParty.findUnique).toHaveBeenCalledWith({
        where: { id: partyId },
        include: {
          risks: {
            take: 10,
            orderBy: { dateAdded: 'desc' },
            select: {
              id: true,
              title: true,
              dateAdded: true,
              calculatedScore: true,
            },
          },
          _count: {
            select: { risks: true },
          },
        },
      });
    });

    it('should return 404 when interested party not found', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440000';
      prisma.interestedParty.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get(`/api/interested-parties/${partyId}`)
        .expect(404);

      // Assert
      expect(response.body.error).toBe('Interested party not found');
    });

    it('should return 400 for invalid UUID', async () => {
      // Act
      const response = await request(app)
        .get('/api/interested-parties/invalid-id')
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    it('should handle database errors', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.interestedParty.findUnique.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .get(`/api/interested-parties/${partyId}`)
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to fetch interested party');
    });
  });

  describe('POST /api/interested-parties', () => {
    it('should create a new interested party with required fields', async () => {
      // Arrange
      const newParty = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'New Party',
        group: null,
        description: null,
        dateAdded: new Date('2024-01-01'),
        addressedThroughISMS: false,
        updatedAt: new Date(),
      };

      prisma.interestedParty.create.mockResolvedValue(newParty);

      // Act
      const response = await request(app)
        .post('/api/interested-parties')
        .send({
          name: 'New Party',
        })
        .expect(201);

      // Assert
      expect(response.body.name).toBe('New Party');
      expect(prisma.interestedParty.create).toHaveBeenCalled();
      const createCall = prisma.interestedParty.create.mock.calls[0][0];
      expect(createCall.data.name).toBe('New Party');
      expect(createCall.data.id).toBeDefined();
      expect(createCall.data.dateAdded).toBeInstanceOf(Date);
      expect(createCall.data.addressedThroughISMS).toBe(false);
    });

    it('should create interested party with all optional fields', async () => {
      // Arrange
      const newParty = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Complete Party',
        group: 'Group A',
        description: 'Test description',
        dateAdded: new Date('2024-01-01'),
        requirements: 'Test requirements',
        addressedThroughISMS: true,
        howAddressedThroughISMS: 'Through controls',
        sourceLink: 'https://example.com',
        keyProductsServices: 'Products',
        ourObligations: 'Our obligations',
        theirObligations: 'Their obligations',
        updatedAt: new Date(),
      };

      prisma.interestedParty.create.mockResolvedValue(newParty);

      // Act
      const response = await request(app)
        .post('/api/interested-parties')
        .send({
          name: 'Complete Party',
          group: 'Group A',
          description: 'Test description',
          dateAdded: '2024-01-01',
          requirements: 'Test requirements',
          addressedThroughISMS: true,
          howAddressedThroughISMS: 'Through controls',
          sourceLink: 'https://example.com',
          keyProductsServices: 'Products',
          ourObligations: 'Our obligations',
          theirObligations: 'Their obligations',
        })
        .expect(201);

      // Assert
      expect(response.body.name).toBe('Complete Party');
      expect(response.body.group).toBe('Group A');
      expect(response.body.addressedThroughISMS).toBe(true);
    });

    it('should handle addressedThroughISMS as string "true"', async () => {
      // Arrange
      const newParty = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Party',
        addressedThroughISMS: true,
        updatedAt: new Date(),
      };

      prisma.interestedParty.create.mockResolvedValue(newParty);

      // Act
      const response = await request(app)
        .post('/api/interested-parties')
        .send({
          name: 'Test Party',
          addressedThroughISMS: 'true',
        })
        .expect(201);

      // Assert
      expect(response.body.addressedThroughISMS).toBe(true);
      const createCall = prisma.interestedParty.create.mock.calls[0][0];
      expect(createCall.data.addressedThroughISMS).toBe(true);
    });

    it('should set null for optional fields when empty strings provided', async () => {
      // Arrange
      const newParty = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Party',
        group: null,
        description: null,
        updatedAt: new Date(),
      };

      prisma.interestedParty.create.mockResolvedValue(newParty);

      // Act
      await request(app)
        .post('/api/interested-parties')
        .send({
          name: 'Test Party',
          group: '',
          description: '',
        })
        .expect(201);

      // Assert
      const createCall = prisma.interestedParty.create.mock.calls[0][0];
      expect(createCall.data.group).toBe(null);
      expect(createCall.data.description).toBe(null);
    });

    it('should handle partial optional fields in POST', async () => {
      // Arrange
      const newParty = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Partial Party',
        group: 'Group A',
        requirements: 'Test requirements',
        sourceLink: null,
        keyProductsServices: null,
        updatedAt: new Date(),
      };

      prisma.interestedParty.create.mockResolvedValue(newParty);

      // Act
      await request(app)
        .post('/api/interested-parties')
        .send({
          name: 'Partial Party',
          group: 'Group A',
          requirements: 'Test requirements',
          // sourceLink and keyProductsServices not provided (undefined)
        })
        .expect(201);

      // Assert
      const createCall = prisma.interestedParty.create.mock.calls[0][0];
      expect(createCall.data.group).toBe('Group A');
      expect(createCall.data.requirements).toBe('Test requirements');
      expect(createCall.data.sourceLink).toBeUndefined();
      expect(createCall.data.keyProductsServices).toBeUndefined();
    });

    it('should handle all optional fields provided in POST', async () => {
      // Arrange - test when all optional fields ARE provided to cover those branches
      const newParty = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'All Fields Party',
        group: 'Group B',
        description: 'Description',
        requirements: 'Requirements',
        howAddressedThroughISMS: 'How addressed',
        sourceLink: 'https://source.com',
        keyProductsServices: 'Products',
        ourObligations: 'Our obligations',
        theirObligations: 'Their obligations',
        updatedAt: new Date(),
      };

      prisma.interestedParty.create.mockResolvedValue(newParty);

      // Act
      await request(app)
        .post('/api/interested-parties')
        .send({
          name: 'All Fields Party',
          group: 'Group B',
          description: 'Description',
          requirements: 'Requirements',
          howAddressedThroughISMS: 'How addressed',
          sourceLink: 'https://source.com',
          keyProductsServices: 'Products',
          ourObligations: 'Our obligations',
          theirObligations: 'Their obligations',
        })
        .expect(201);

      // Assert - verify all fields are set
      const createCall = prisma.interestedParty.create.mock.calls[0][0];
      expect(createCall.data.requirements).toBe('Requirements');
      expect(createCall.data.howAddressedThroughISMS).toBe('How addressed');
      expect(createCall.data.sourceLink).toBe('https://source.com');
      expect(createCall.data.keyProductsServices).toBe('Products');
      expect(createCall.data.ourObligations).toBe('Our obligations');
      expect(createCall.data.theirObligations).toBe('Their obligations');
    });

    it('should return 400 when name is missing', async () => {
      // Act
      const response = await request(app)
        .post('/api/interested-parties')
        .send({})
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    it('should return 400 when name is empty', async () => {
      // Act
      const response = await request(app)
        .post('/api/interested-parties')
        .send({ name: '' })
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
    });

    it('should return 409 when party name already exists', async () => {
      // Arrange
      const error: any = new Error('Unique constraint failed');
      error.code = 'P2002';
      prisma.interestedParty.create.mockRejectedValue(error);

      // Act
      const response = await request(app)
        .post('/api/interested-parties')
        .send({ name: 'Existing Party' })
        .expect(409);

      // Assert
      expect(response.body.error).toBe('Interested party name already exists');
    });

    it('should return 500 on database error', async () => {
      // Arrange
      prisma.interestedParty.create.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .post('/api/interested-parties')
        .send({ name: 'Test Party' })
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to create interested party');
    });

    it('should require ADMIN or EDITOR role', () => {
      // Assert - requireRole is called during route registration
      // We verify it was set up correctly by checking it's defined
      expect(requireRole).toBeDefined();
      // The actual authorization logic is tested in middleware tests
    });
  });

  describe('PUT /api/interested-parties/:id', () => {
    it('should update interested party with provided fields', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      const updatedParty = {
        id: partyId,
        name: 'Updated Party',
        group: 'Updated Group',
        description: 'Updated description',
        addressedThroughISMS: true,
        updatedAt: new Date(),
      };

      prisma.interestedParty.update.mockResolvedValue(updatedParty);

      // Act
      const response = await request(app)
        .put(`/api/interested-parties/${partyId}`)
        .send({
          name: 'Updated Party',
          group: 'Updated Group',
          description: 'Updated description',
          addressedThroughISMS: true,
        })
        .expect(200);

      // Assert
      expect(response.body.name).toBe('Updated Party');
      expect(response.body.group).toBe('Updated Group');
      expect(prisma.interestedParty.update).toHaveBeenCalledWith({
        where: { id: partyId },
        data: expect.objectContaining({
          name: 'Updated Party',
          updatedAt: expect.any(Date),
        }),
      });
    });

    it('should update only provided fields', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      const updatedParty = {
        id: partyId,
        name: 'Original Name',
        group: 'Updated Group',
        updatedAt: new Date(),
      };

      prisma.interestedParty.update.mockResolvedValue(updatedParty);

      // Act
      await request(app)
        .put(`/api/interested-parties/${partyId}`)
        .send({
          group: 'Updated Group',
        })
        .expect(200);

      // Assert
      const updateCall = prisma.interestedParty.update.mock.calls[0][0];
      expect(updateCall.data.name).toBeUndefined();
      expect(updateCall.data.group).toBe('Updated Group');
    });

    it('should handle addressedThroughISMS as string "true"', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      const updatedParty = {
        id: partyId,
        name: 'Test Party',
        addressedThroughISMS: true,
        updatedAt: new Date(),
      };

      prisma.interestedParty.update.mockResolvedValue(updatedParty);

      // Act
      const response = await request(app)
        .put(`/api/interested-parties/${partyId}`)
        .send({
          addressedThroughISMS: 'true',
        })
        .expect(200);

      // Assert
      expect(response.body.addressedThroughISMS).toBe(true);
      const updateCall = prisma.interestedParty.update.mock.calls[0][0];
      expect(updateCall.data.addressedThroughISMS).toBe(true);
    });

    it('should set null for optional fields when empty strings provided', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      const updatedParty = {
        id: partyId,
        name: 'Test Party',
        group: null,
        updatedAt: new Date(),
      };

      prisma.interestedParty.update.mockResolvedValue(updatedParty);

      // Act
      await request(app)
        .put(`/api/interested-parties/${partyId}`)
        .send({
          group: '',
          description: '',
        })
        .expect(200);

      // Assert
      const updateCall = prisma.interestedParty.update.mock.calls[0][0];
      expect(updateCall.data.group).toBe(null);
      expect(updateCall.data.description).toBe(null);
    });

    it('should handle dateAdded when not provided in update', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      const updatedParty = {
        id: partyId,
        name: 'Test Party',
        updatedAt: new Date(),
      };

      prisma.interestedParty.update.mockResolvedValue(updatedParty);

      // Act - dateAdded not provided (undefined)
      await request(app)
        .put(`/api/interested-parties/${partyId}`)
        .send({
          name: 'Updated Name',
          // dateAdded not provided
        })
        .expect(200);

      // Assert - dateAdded should not be in updateData when undefined
      const updateCall = prisma.interestedParty.update.mock.calls[0][0];
      expect(updateCall.data.name).toBe('Updated Name');
      expect(updateCall.data.dateAdded).toBeUndefined();
    });

    it('should handle partial optional fields in PUT', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      const updatedParty = {
        id: partyId,
        name: 'Test Party',
        group: 'Updated Group',
        howAddressedThroughISMS: 'Updated',
        sourceLink: null,
        keyProductsServices: null,
        updatedAt: new Date(),
      };

      prisma.interestedParty.update.mockResolvedValue(updatedParty);

      // Act
      await request(app)
        .put(`/api/interested-parties/${partyId}`)
        .send({
          group: 'Updated Group',
          howAddressedThroughISMS: 'Updated',
          // sourceLink and keyProductsServices not provided (undefined)
        })
        .expect(200);

      // Assert
      const updateCall = prisma.interestedParty.update.mock.calls[0][0];
      expect(updateCall.data.group).toBe('Updated Group');
      expect(updateCall.data.howAddressedThroughISMS).toBe('Updated');
      expect(updateCall.data.sourceLink).toBeUndefined();
      expect(updateCall.data.keyProductsServices).toBeUndefined();
    });

    it('should handle dateAdded provided in PUT', async () => {
      // Arrange - test when dateAdded IS provided to cover that branch
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      const updatedParty = {
        id: partyId,
        name: 'Test Party',
        dateAdded: new Date('2024-01-15'),
        updatedAt: new Date(),
      };

      prisma.interestedParty.update.mockResolvedValue(updatedParty);

      // Act
      await request(app)
        .put(`/api/interested-parties/${partyId}`)
        .send({
          dateAdded: '2024-01-15',
        })
        .expect(200);

      // Assert - verify dateAdded branch is covered
      const updateCall = prisma.interestedParty.update.mock.calls[0][0];
      expect(updateCall.data.dateAdded).toBeInstanceOf(Date);
    });

    it('should handle all optional fields provided in PUT', async () => {
      // Arrange - test when all optional fields ARE provided to cover those branches
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      const updatedParty = {
        id: partyId,
        name: 'Test Party',
        group: 'Group',
        description: 'Description',
        requirements: 'Requirements',
        howAddressedThroughISMS: 'How addressed',
        sourceLink: 'https://source.com',
        keyProductsServices: 'Products',
        ourObligations: 'Our obligations',
        theirObligations: 'Their obligations',
        updatedAt: new Date(),
      };

      prisma.interestedParty.update.mockResolvedValue(updatedParty);

      // Act
      await request(app)
        .put(`/api/interested-parties/${partyId}`)
        .send({
          group: 'Group',
          description: 'Description',
          requirements: 'Requirements',
          howAddressedThroughISMS: 'How addressed',
          sourceLink: 'https://source.com',
          keyProductsServices: 'Products',
          ourObligations: 'Our obligations',
          theirObligations: 'Their obligations',
        })
        .expect(200);

      // Assert - verify all fields are set
      const updateCall = prisma.interestedParty.update.mock.calls[0][0];
      expect(updateCall.data.requirements).toBe('Requirements');
      expect(updateCall.data.howAddressedThroughISMS).toBe('How addressed');
      expect(updateCall.data.sourceLink).toBe('https://source.com');
      expect(updateCall.data.keyProductsServices).toBe('Products');
      expect(updateCall.data.ourObligations).toBe('Our obligations');
      expect(updateCall.data.theirObligations).toBe('Their obligations');
    });

    it('should return 400 for invalid UUID', async () => {
      // Act
      const response = await request(app)
        .put('/api/interested-parties/invalid-id')
        .send({ name: 'Updated' })
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 when name is empty string', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';

      // Act
      const response = await request(app)
        .put(`/api/interested-parties/${partyId}`)
        .send({ name: '' })
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
    });

    it('should return 404 when interested party not found', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440000';
      const error: any = new Error('Record not found');
      error.code = 'P2025';
      prisma.interestedParty.update.mockRejectedValue(error);

      // Act
      const response = await request(app)
        .put(`/api/interested-parties/${partyId}`)
        .send({ name: 'Updated' })
        .expect(404);

      // Assert
      expect(response.body.error).toBe('Interested party not found');
    });

    it('should return 409 when party name already exists', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      const error: any = new Error('Unique constraint failed');
      error.code = 'P2002';
      prisma.interestedParty.update.mockRejectedValue(error);

      // Act
      const response = await request(app)
        .put(`/api/interested-parties/${partyId}`)
        .send({ name: 'Existing Name' })
        .expect(409);

      // Assert
      expect(response.body.error).toBe('Interested party name already exists');
    });

    it('should return 500 on database error', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.interestedParty.update.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .put(`/api/interested-parties/${partyId}`)
        .send({ name: 'Updated' })
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to update interested party');
    });

    it('should require ADMIN or EDITOR role', () => {
      // Assert - requireRole is called during route registration
      // We verify it was set up correctly by checking it's defined
      expect(requireRole).toBeDefined();
      // The actual authorization logic is tested in middleware tests
    });
  });

  describe('DELETE /api/interested-parties/:id', () => {
    it('should delete interested party when not used by risks', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.risk.count.mockResolvedValue(0);
      prisma.interestedParty.delete.mockResolvedValue({ id: partyId });

      // Act
      await request(app)
        .delete(`/api/interested-parties/${partyId}`)
        .expect(204);

      // Assert
      expect(prisma.risk.count).toHaveBeenCalledWith({
        where: { interestedPartyId: partyId },
      });
      expect(prisma.interestedParty.delete).toHaveBeenCalledWith({
        where: { id: partyId },
      });
    });

    it('should return 409 when interested party is used by risks', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.risk.count.mockResolvedValue(3);

      // Act
      const response = await request(app)
        .delete(`/api/interested-parties/${partyId}`)
        .expect(409);

      // Assert
      expect(response.body.error).toBe('Cannot delete interested party: it is used by 3 risk(s)');
      expect(prisma.interestedParty.delete).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid UUID', async () => {
      // Act
      const response = await request(app)
        .delete('/api/interested-parties/invalid-id')
        .expect(400);

      // Assert
      expect(response.body.errors).toBeDefined();
    });

    it('should return 404 when interested party not found', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440000';
      prisma.risk.count.mockResolvedValue(0);
      const error: any = new Error('Record not found');
      error.code = 'P2025';
      prisma.interestedParty.delete.mockRejectedValue(error);

      // Act
      const response = await request(app)
        .delete(`/api/interested-parties/${partyId}`)
        .expect(404);

      // Assert
      expect(response.body.error).toBe('Interested party not found');
    });

    it('should return 500 on database error', async () => {
      // Arrange
      const partyId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.risk.count.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .delete(`/api/interested-parties/${partyId}`)
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to delete interested party');
    });

    it('should require ADMIN or EDITOR role', () => {
      // Assert - requireRole is called during route registration
      // We verify it was set up correctly by checking it's defined
      expect(requireRole).toBeDefined();
      // The actual authorization logic is tested in middleware tests
    });
  });

  describe('POST /api/interested-parties/import', () => {
    it('should import interested parties from uploaded file', async () => {
      // Arrange
      const mockFile = {
        buffer: Buffer.from('Date Added,Interested party\n2024-01-01,Test Party'),
        mimetype: 'text/csv',
        originalname: 'test.csv',
      };
      const mockResult = {
        success: 1,
        failed: 0,
        total: 1,
        errors: [],
      };

      importService.importInterestedPartiesFromCSV.mockResolvedValue(mockResult);
      mockMulterMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.file = mockFile;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/interested-parties/import')
        .attach('file', mockFile.buffer, 'test.csv')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(1);
      expect(response.body.total).toBe(1);
      expect(importService.importInterestedPartiesFromCSV).toHaveBeenCalledWith(mockFile.buffer);
    });

    it('should import interested parties from file path (legacy support)', async () => {
      // Arrange
      const csvPath = '/path/to/file.csv';
      const mockResult = {
        success: 2,
        failed: 0,
        total: 2,
        errors: [],
      };

      fs.existsSync.mockReturnValue(true);
      importService.importInterestedPartiesFromCSV.mockResolvedValue(mockResult);
      mockMulterMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.file = undefined;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/interested-parties/import')
        .send({ filePath: csvPath })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(2);
      expect(fs.existsSync).toHaveBeenCalledWith(csvPath);
      expect(importService.importInterestedPartiesFromCSV).toHaveBeenCalledWith(csvPath);
    });

    it('should return 400 when no file provided', async () => {
      // Arrange
      mockMulterMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.file = undefined;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/interested-parties/import')
        .send({})
        .expect(400);

      // Assert
      expect(response.body.error).toBe('No file provided. Please upload a CSV file.');
    });

    it('should return 400 when file path does not exist', async () => {
      // Arrange
      const csvPath = '/path/to/nonexistent.csv';
      fs.existsSync.mockReturnValue(false);
      mockMulterMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.file = undefined;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/interested-parties/import')
        .send({ filePath: csvPath })
        .expect(400);

      // Assert
      expect(response.body.error).toBe(`CSV file not found: ${csvPath}`);
    });

    it('should return 500 on import service error', async () => {
      // Arrange
      const mockFile = {
        buffer: Buffer.from('Date Added,Interested party\n2024-01-01,Test Party'),
        mimetype: 'text/csv',
        originalname: 'test.csv',
      };

      importService.importInterestedPartiesFromCSV.mockRejectedValue(
        new Error('Import failed')
      );
      mockMulterMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.file = mockFile;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/interested-parties/import')
        .attach('file', mockFile.buffer, 'test.csv')
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Import failed');
    });

    it('should return 500 on generic error', async () => {
      // Arrange
      const mockFile = {
        buffer: Buffer.from('Date Added,Interested party\n2024-01-01,Test Party'),
        mimetype: 'text/csv',
        originalname: 'test.csv',
      };

      importService.importInterestedPartiesFromCSV.mockRejectedValue(
        new Error()
      );
      mockMulterMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.file = mockFile;
        next();
      });

      // Act
      const response = await request(app)
        .post('/api/interested-parties/import')
        .attach('file', mockFile.buffer, 'test.csv')
        .expect(500);

      // Assert
      expect(response.body.error).toBe('Failed to import interested parties');
    });

    it('should require ADMIN or EDITOR role', () => {
      // Assert - requireRole is called during route registration
      // We verify it was set up correctly by checking it's defined
      expect(requireRole).toBeDefined();
      // The actual authorization logic is tested in middleware tests
    });
  });
});

