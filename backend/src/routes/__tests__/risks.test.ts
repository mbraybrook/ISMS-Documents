/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import { risksRouter } from '../risks';
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
  requireDepartmentAccess: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    risk: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    interestedParty: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    control: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    riskControl: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(),
    },
    $transaction: jest.fn(async (arg) => {
      // Handle both callback and array of promises
      if (typeof arg === 'function') {
        const tx = {
          riskControl: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return await arg(tx);
      } else if (Array.isArray(arg)) {
        // Array of promises - execute them all
        return await Promise.all(arg);
      }
      return arg;
    }),
  },
}));

// Mock risk service
jest.mock('../../services/riskService', () => ({
  calculateRiskScore: jest.fn((c, i, a, l) => (c + i + a) * l),
  calculateMitigatedScore: jest.fn((c, i, a, l) => (c + i + a) * l),
  getRiskLevel: jest.fn((score: number) => {
    if (score >= 36) return 'HIGH';
    if (score >= 15) return 'MEDIUM';
    return 'LOW';
  }),
  parseControlCodes: jest.fn((codes) => codes ? codes.split(',').map((c: string) => c.trim()) : []),
  updateRiskControls: jest.fn(),
  updateControlApplicability: jest.fn(),
  validateStatusTransition: jest.fn(() => true),
  calculateCIAFromWizard: jest.fn(() => ({ c: 3, i: 3, a: 3 })),
}));

describe('Risks API', () => {
  let app: express.Application;
  let prisma: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/risks', risksRouter);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    prisma = require('../../lib/prisma').prisma;
    jest.clearAllMocks();
  });

  describe('GET /api/risks', () => {
    it('should return list of risks', async () => {
      const mockRisks = [
        {
          id: 'risk-1',
          title: 'Test Risk',
          calculatedScore: 18,
          status: 'DRAFT',
          createdAt: new Date(),
        },
      ];

      prisma.risk.findMany.mockResolvedValue(mockRisks);
      prisma.risk.count.mockResolvedValue(1);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get('/api/risks')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Test Risk');
    });

    it('should filter by department for CONTRIBUTOR users', async () => {
      const contributorUser = mockUsers.contributor('OPERATIONS');
      prisma.user.findUnique.mockResolvedValue(contributorUser);
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);

      await request(app)
        .get('/api/risks')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            department: 'OPERATIONS',
          }),
        })
      );
    });

    it('should filter by status', async () => {
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/risks?status=ACTIVE')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should support pagination', async () => {
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(50);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .get('/api/risks?page=2&limit=10')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(response.body.pagination.page).toBe(2);
    });
  });

  describe('POST /api/risks', () => {
    it('should create a new risk', async () => {
      const partyId = '550e8400-e29b-41d4-a716-446655440010';
      const newRisk = {
        id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'New Risk',
        confidentialityScore: 3,
        integrityScore: 3,
        availabilityScore: 3,
        likelihood: 2,
        calculatedScore: 18,
        status: 'DRAFT',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
        riskControls: [],
      };

      prisma.interestedParty.findUnique.mockResolvedValue({ id: partyId });
      prisma.risk.create.mockResolvedValue(newRisk);
      prisma.risk.findUnique.mockResolvedValue(newRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
          confidentialityScore: 3,
          integrityScore: 3,
          availabilityScore: 3,
          likelihood: 2,
          interestedPartyId: partyId,
        })
        .expect(201);

      expect(response.body.title).toBe('New Risk');
      expect(response.body.calculatedScore).toBe(18);
    });

    it('should calculate risk score automatically', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { calculateRiskScore } = require('../../services/riskService');
      const partyId = '550e8400-e29b-41d4-a716-446655440010';
      const newRisk = {
        id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'New Risk',
        calculatedScore: 24,
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
        riskControls: [],
      };

      prisma.interestedParty.findUnique.mockResolvedValue({ id: partyId });
      prisma.risk.create.mockResolvedValue(newRisk);
      prisma.risk.findUnique.mockResolvedValue(newRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
          confidentialityScore: 4,
          integrityScore: 4,
          availabilityScore: 4,
          likelihood: 2,
          interestedPartyId: partyId,
        })
        .expect(201);

      expect(calculateRiskScore).toHaveBeenCalledWith(4, 4, 4, 2);
    });

    it('should handle wizard data for CONTRIBUTOR users', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { calculateCIAFromWizard } = require('../../services/riskService');
      const contributorUser = mockUsers.contributor('OPERATIONS');
      const partyId = '550e8400-e29b-41d4-a716-446655440010';
      const newRisk = {
        id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'New Risk',
        calculatedScore: 18,
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
        riskControls: [],
      };

      prisma.interestedParty.findUnique.mockResolvedValue({ id: partyId });
      prisma.risk.create.mockResolvedValue(newRisk);
      prisma.risk.findUnique.mockResolvedValue(newRisk);
      prisma.user.findUnique.mockResolvedValue(contributorUser);

      await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
          wizardData: JSON.stringify({ impactLevel: 3 }),
          interestedPartyId: partyId,
        })
        .expect(201);

      expect(calculateCIAFromWizard).toHaveBeenCalled();
    });

    it('should parse and associate control codes', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { parseControlCodes } = require('../../services/riskService');
      const partyId = '550e8400-e29b-41d4-a716-446655440010';
      const newRisk = {
        id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'New Risk',
        calculatedScore: 18,
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
        riskControls: [],
      };

      prisma.interestedParty.findUnique.mockResolvedValue({ id: partyId });
      prisma.risk.create.mockResolvedValue(newRisk);
      prisma.risk.findUnique.mockResolvedValue(newRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
          annexAControlsRaw: 'A.8.3, A.5.9, A.8.24',
          interestedPartyId: partyId,
        })
        .expect(201);

      expect(parseControlCodes).toHaveBeenCalledWith('A.8.3, A.5.9, A.8.24');
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/risks')
        .send({
          // Missing required fields
        })
        .expect(400);
    });
  });

  describe('PUT /api/risks/:id', () => {
    it('should update an existing risk', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        status: 'DRAFT',
        calculatedScore: 18,
        confidentialityScore: 3,
        integrityScore: 3,
        availabilityScore: 3,
        likelihood: 2,
      };
      const updatedRisk = {
        ...existingRisk,
        title: 'Updated Risk',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
        interestedParty: {
          id: '550e8400-e29b-41d4-a716-446655440010',
          name: 'Test Party',
          group: null,
        },
        riskControls: [],
      };

      prisma.risk.findUnique
        .mockResolvedValueOnce(existingRisk) // First call for existing check
        .mockResolvedValueOnce(updatedRisk); // Second call for response
      prisma.risk.update.mockResolvedValue(updatedRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .put(`/api/risks/${riskId}`)
        .send({
          title: 'Updated Risk',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Risk');
      expect(prisma.risk.update).toHaveBeenCalled();
    });

    it('should allow status updates in PUT request', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        status: 'DRAFT',
        calculatedScore: 18,
        confidentialityScore: 3,
        integrityScore: 3,
        availabilityScore: 3,
        likelihood: 2,
      };
      const updatedRisk = {
        ...existingRisk,
        status: 'PROPOSED',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
        interestedParty: {
          id: '550e8400-e29b-41d4-a716-446655440010',
          name: 'Test Party',
          group: null,
        },
        riskControls: [],
      };

      prisma.risk.findUnique
        .mockResolvedValueOnce(existingRisk) // First call for existing check
        .mockResolvedValueOnce(updatedRisk); // Second call for response
      prisma.risk.update.mockResolvedValue(updatedRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .put(`/api/risks/${riskId}`)
        .send({
          status: 'PROPOSED',
        })
        .expect(200);

      expect(response.body.status).toBe('PROPOSED');
      expect(prisma.risk.update).toHaveBeenCalled();
    });

    it('should return 404 for non-existent risk', async () => {
      prisma.risk.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const riskId = '550e8400-e29b-41d4-a716-446655440000';
      await request(app)
        .put(`/api/risks/${riskId}`)
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('POST /api/risks/:id/controls', () => {
    it('should associate controls with risk', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
      };
      const mockControls = [
        { id: '550e8400-e29b-41d4-a716-446655440011', code: 'A.8.3' },
        { id: '550e8400-e29b-41d4-a716-446655440012', code: 'A.5.9' },
      ];

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.control.findMany.mockResolvedValue(mockControls);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/controls`)
        .send({
          controlIds: ['550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440012'],
        })
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalled();
    });
  });
});

