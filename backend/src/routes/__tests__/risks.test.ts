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
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    department: {
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
      create: jest.fn().mockResolvedValue({}),
    },
    documentRisk: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    legislationRisk: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    riskAsset: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    supplier: {
      findUnique: jest.fn(),
    },
    supplierRiskLink: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (arg) => {
      // Handle both callback and array of promises
      if (typeof arg === 'function') {
        const tx = {
          riskControl: {
            create: jest.fn().mockResolvedValue({}),
          },
          documentRisk: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          legislationRisk: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          risk: {
            delete: jest.fn().mockResolvedValue({}),
          },
        };
        return await arg(tx);
      } else if (Array.isArray(arg)) {
        // Array of promises - execute them all
        // Each element is already a promise from prisma.riskControl.create()
        // Just await all of them
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
  updateControlApplicability: jest.fn().mockResolvedValue(undefined),
  validateStatusTransition: jest.fn(() => true),
  calculateCIAFromWizard: jest.fn(() => ({ c: 3, i: 3, a: 3 })),
  hasPolicyNonConformance: jest.fn(() => false),
}));

// Mock embedding service
jest.mock('../../services/embeddingService', () => ({
  computeAndStoreEmbedding: jest.fn().mockResolvedValue(undefined),
}));

// Mock similarity service
jest.mock('../../services/similarityService', () => ({
  findSimilarRisksForRisk: jest.fn().mockResolvedValue([]),
  checkSimilarityForNewRisk: jest.fn().mockResolvedValue([]),
}));

// Mock risk import service
jest.mock('../../services/riskImportService', () => ({
  importRisksFromCSV: jest.fn().mockResolvedValue({
    success: 0,
    failed: 0,
    total: 0,
    errors: [],
  }),
}));

// Mock LLM service
jest.mock('../../services/llmService', () => ({
  generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  normalizeRiskText: jest.fn((title, threat, desc) => `${title} ${threat || ''} ${desc || ''}`),
  cosineSimilarity: jest.fn(() => 0.8),
  mapToScore: jest.fn((sim) => Math.round(sim * 100)),
}));

// Mock AI service client
jest.mock('../../clients/aiServiceClient', () => ({
  generateEmbeddingRemote: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  similaritySearchRemote: jest.fn().mockResolvedValue({ results: [] }),
}));

// Mock multer config
jest.mock('../../lib/multerConfig', () => ({
  csvUpload: {
    single: jest.fn(() => (req: any, res: any, next: any) => {
      // Set req.file if it's an attachment request
      if (req.get && req.get('content-type')?.includes('multipart/form-data')) {
        req.file = {
          buffer: Buffer.from('csv,data'),
          originalname: 'risks.csv',
          mimetype: 'text/csv',
        };
      }
      next();
    }),
  },
  handleMulterError: jest.fn((req: any, res: any, next: any) => next()),
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const aiServiceClient = require('../../clients/aiServiceClient');
    // Reset aiServiceClient mocks to default after clearing
    aiServiceClient.generateEmbeddingRemote.mockResolvedValue([0.1, 0.2, 0.3]);
    aiServiceClient.similaritySearchRemote.mockResolvedValue({ results: [] });
    // Reset all Prisma mocks to their default state
    prisma.risk.findUnique.mockReset();
    prisma.risk.findMany.mockReset();
    prisma.risk.create.mockReset();
    prisma.risk.update.mockReset();
    prisma.risk.delete.mockReset();
    prisma.risk.count.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.control.findMany.mockReset();
    prisma.riskControl.deleteMany.mockReset();
    prisma.riskControl.create.mockReset();
    prisma.supplier.findUnique.mockReset();
    prisma.supplierRiskLink.findUnique.mockReset();
    prisma.supplierRiskLink.create.mockReset();
    prisma.supplierRiskLink.findMany.mockReset();
    prisma.$transaction.mockReset();
    // Reset default mock implementations
    prisma.riskControl.create.mockResolvedValue({});
    prisma.riskControl.deleteMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') {
        const tx = {
          riskControl: {
            create: jest.fn().mockResolvedValue({}),
          },
          documentRisk: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          legislationRisk: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          risk: {
            delete: jest.fn().mockResolvedValue({}),
          },
        };
        return await arg(tx);
      } else if (Array.isArray(arg)) {
        return await Promise.all(arg);
      }
      return arg;
    });
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
          owner: { id: 'user-1', displayName: 'Owner', email: 'owner@test.com' },
          interestedParty: { id: 'party-1', name: 'Party', group: null },
          riskControls: [],
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
      expect(response.body.pagination.total).toBe(1);
    });

    it('should allow CONTRIBUTOR users to view all risks (no department filter)', async () => {
      const contributorUser = mockUsers.contributor('OPERATIONS');
      prisma.user.findUnique.mockResolvedValue(contributorUser);
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);

      await request(app)
        .get('/api/risks')
        .expect(200);

      // Contributors can now see all risks - no department filter applied by default
      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            archived: false,
          }),
        })
      );
      // Department should not be in where clause unless explicitly filtered
      const findManyCall = prisma.risk.findMany.mock.calls[0][0];
      expect(findManyCall.where.department).toBeUndefined();
    });

    it('should allow STAFF users to view all risks', async () => {
      const staffUser = mockUsers.staff();
      prisma.user.findUnique.mockResolvedValue(staffUser);
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);

      await request(app)
        .get('/api/risks')
        .expect(200);

      // Staff can see all risks - no department filter, archived defaults to false
      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            archived: false,
          }),
        })
      );
      // Department should not be in where clause unless explicitly filtered
      const findManyCall = prisma.risk.findMany.mock.calls[0][0];
      expect(findManyCall.where.department).toBeUndefined();
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
      expect(response.body.pagination.totalPages).toBe(5);
    });

    it('should filter by riskCategory', async () => {
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/risks?riskCategory=INFORMATION_SECURITY')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            riskCategory: 'INFORMATION_SECURITY',
          }),
        })
      );
    });

    it('should filter by riskNature', async () => {
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/risks?riskNature=STATIC')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            riskNature: 'STATIC',
          }),
        })
      );
    });

    it('should filter by archived status', async () => {
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/risks?archived=true')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            archived: true,
          }),
        })
      );
    });

    it('should filter by ownerId', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440030';
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get(`/api/risks?ownerId=${ownerId}`)
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ownerUserId: ownerId,
          }),
        })
      );
    });

    it('should filter by treatmentCategory', async () => {
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/risks?treatmentCategory=RETAIN')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalled();
    });

    it('should filter by mitigationImplemented', async () => {
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/risks?mitigationImplemented=true')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            mitigationImplemented: true,
          }),
        })
      );
    });

    it('should filter by riskLevel', async () => {
      const mockRisks = [
        { id: 'risk-1', calculatedScore: 40 },
        { id: 'risk-2', calculatedScore: 20 },
      ];
      prisma.risk.findMany
        .mockResolvedValueOnce(mockRisks) // First call for filtering
        .mockResolvedValueOnce(mockRisks); // Second call for results
      prisma.risk.count.mockResolvedValue(2);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/risks?riskLevel=HIGH')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalled();
    });

    it('should filter by search query', async () => {
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/risks?search=test')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: 'test', mode: 'insensitive' } },
              { description: { contains: 'test', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter by dateAdded range', async () => {
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/risks?dateAddedFrom=2024-01-01&dateAddedTo=2024-12-31')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dateAdded: {
              gte: '2024-01-01',
              lte: '2024-12-31',
            },
          }),
        })
      );
    });

    it('should filter by assetId', async () => {
      const assetId = '550e8400-e29b-41d4-a716-446655440040';
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get(`/api/risks?assetId=${assetId}`)
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            riskAssets: expect.objectContaining({
              some: expect.objectContaining({
                assetId,
              }),
            }),
          }),
        })
      );
    });

    it('should filter by assetCategoryId', async () => {
      const categoryId = '550e8400-e29b-41d4-a716-446655440050';
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get(`/api/risks?assetCategoryId=${categoryId}`)
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assetCategoryId: categoryId,
          }),
        })
      );
    });

    it('should filter by view=inbox for EDITOR/ADMIN', async () => {
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.editor());

      await request(app)
        .get('/api/risks?view=inbox')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PROPOSED',
          }),
        })
      );
    });

    it('should return 403 when CONTRIBUTOR tries to access inbox', async () => {
      const contributorUser = mockUsers.contributor('OPERATIONS');
      prisma.user.findUnique.mockResolvedValue(contributorUser);

      await request(app)
        .get('/api/risks?view=inbox')
        .expect(403);
    });

    it('should filter by department when provided for ADMIN/EDITOR', async () => {
      const operationsDeptId = '11111111-1111-1111-1111-111111111111';
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.department.findUnique.mockResolvedValue({
        id: operationsDeptId,
        name: 'OPERATIONS',
      });

      await request(app)
        .get('/api/risks?department=OPERATIONS')
        .expect(200);

      expect(prisma.department.findUnique).toHaveBeenCalledWith({
        where: { name: 'OPERATIONS' },
      });
      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: operationsDeptId,
          }),
        })
      );
    });

    it('should filter by policyNonConformance', async () => {
      const mockRisks = [
        {
          id: 'risk-1',
          initialRiskTreatmentCategory: 'RETAIN',
          calculatedScore: 20,
          mitigatedConfidentialityScore: 3,
          mitigatedIntegrityScore: 3,
          mitigatedAvailabilityScore: 3,
          mitigatedLikelihood: 2,
          mitigatedScore: 18,
          mitigationDescription: null,
        },
      ];
      prisma.risk.findMany
        .mockResolvedValueOnce(mockRisks)
        .mockResolvedValueOnce(mockRisks);
      prisma.risk.count.mockResolvedValue(1);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/risks?policyNonConformance=true')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalled();
    });

    it('should filter by controlsApplied', async () => {
      const mockRisks = [
        {
          id: 'risk-1',
          riskControls: [{ controlId: 'control-1' }],
        },
      ];
      prisma.risk.findMany
        .mockResolvedValueOnce(mockRisks)
        .mockResolvedValueOnce(mockRisks);
      prisma.risk.count.mockResolvedValue(1);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .get('/api/risks?controlsApplied=true')
        .expect(200);

      expect(prisma.risk.findMany).toHaveBeenCalled();
    });

    describe('Sorting', () => {
      beforeEach(() => {
        prisma.risk.findMany.mockResolvedValue([]);
        prisma.risk.count.mockResolvedValue(0);
        prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      });

      it('should support sorting by title ascending', async () => {
        await request(app)
          .get('/api/risks?sortBy=title&sortOrder=asc')
          .expect(200);

        expect(prisma.risk.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              title: 'asc',
            },
          })
        );
      });

      it('should support sorting by title descending', async () => {
        await request(app)
          .get('/api/risks?sortBy=title&sortOrder=desc')
          .expect(200);

        expect(prisma.risk.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              title: 'desc',
            },
          })
        );
      });

      it('should support sorting by calculatedScore', async () => {
        await request(app)
          .get('/api/risks?sortBy=calculatedScore&sortOrder=desc')
          .expect(200);

        expect(prisma.risk.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              calculatedScore: 'desc',
            },
          })
        );
      });

      it('should support sorting by mitigatedScore', async () => {
        await request(app)
          .get('/api/risks?sortBy=mitigatedScore&sortOrder=asc')
          .expect(200);

        expect(prisma.risk.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              mitigatedScore: 'asc',
            },
          })
        );
      });

      it('should support sorting by createdAt', async () => {
        await request(app)
          .get('/api/risks?sortBy=createdAt&sortOrder=desc')
          .expect(200);

        expect(prisma.risk.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              createdAt: 'desc',
            },
          })
        );
      });

      it('should support sorting by dateAdded', async () => {
        await request(app)
          .get('/api/risks?sortBy=dateAdded&sortOrder=asc')
          .expect(200);

        expect(prisma.risk.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              dateAdded: 'asc',
            },
          })
        );
      });

      it('should reject invalid sortBy value', async () => {
        await request(app)
          .get('/api/risks?sortBy=interestedParty&sortOrder=asc')
          .expect(400);
      });

      it('should reject invalid sortOrder value', async () => {
        await request(app)
          .get('/api/risks?sortBy=title&sortOrder=invalid')
          .expect(400);
      });

      it('should use default sortBy and sortOrder when not provided', async () => {
        await request(app)
          .get('/api/risks')
          .expect(200);

        expect(prisma.risk.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              calculatedScore: 'desc',
            },
          })
        );
      });
    });

    it('should handle testDepartment parameter for ADMIN', async () => {
      const operationsDeptId = '11111111-1111-1111-1111-111111111111';
      prisma.risk.findMany.mockResolvedValue([]);
      prisma.risk.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.department.findUnique.mockResolvedValue({
        id: operationsDeptId,
        name: 'OPERATIONS',
      });

      await request(app)
        .get('/api/risks?view=department&testDepartment=OPERATIONS')
        .expect(200);

      expect(prisma.department.findUnique).toHaveBeenCalledWith({
        where: { name: 'OPERATIONS' },
      });
      expect(prisma.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: operationsDeptId,
          }),
        })
      );
    });

    it('should return 500 on database error', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.risk.findMany.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/risks')
        .expect(500);
    });
  });

  describe('GET /api/risks/:id', () => {
    it('should return risk details', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const mockRisk = {
        id: riskId,
        title: 'Test Risk',
        calculatedScore: 18,
        mitigatedScore: null,
        owner: {
          id: 'user-1',
          displayName: 'Owner',
          email: 'owner@test.com',
        },
        interestedParty: {
          id: 'party-1',
          name: 'Party',
          group: null,
        },
        riskControls: [],
        DocumentRisk: [],
        supplierRisks: [],
      };

      prisma.risk.findUnique.mockResolvedValue(mockRisk);

      const response = await request(app)
        .get(`/api/risks/${riskId}`)
        .expect(200);

      expect(response.body.id).toBe(riskId);
      expect(response.body.title).toBe('Test Risk');
      expect(response.body.riskLevel).toBe('MEDIUM');
    });

    it('should return 404 when risk not found', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440000';
      prisma.risk.findUnique.mockResolvedValue(null);

      await request(app)
        .get(`/api/risks/${riskId}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app)
        .get('/api/risks/invalid-id')
        .expect(400);
    });

    it('should include mitigated risk level when mitigatedScore exists', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const mockRisk = {
        id: riskId,
        title: 'Test Risk',
        calculatedScore: 40,
        mitigatedScore: 20,
        owner: {
          id: 'user-1',
          displayName: 'Owner',
          email: 'owner@test.com',
        },
        interestedParty: {
          id: 'party-1',
          name: 'Party',
          group: null,
        },
        riskControls: [],
        DocumentRisk: [],
        supplierRisks: [],
      };

      prisma.risk.findUnique.mockResolvedValue(mockRisk);

      const response = await request(app)
        .get(`/api/risks/${riskId}`)
        .expect(200);

      expect(response.body.riskLevel).toBe('HIGH');
      expect(response.body.mitigatedRiskLevel).toBe('MEDIUM');
    });

    it('should return 500 on database error', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.risk.findUnique.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get(`/api/risks/${riskId}`)
        .expect(500);
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
      prisma.department.findUnique.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'OPERATIONS',
      });

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

    it('should create risk with all fields', async () => {
      const partyId = '550e8400-e29b-41d4-a716-446655440010';
      const newRisk = {
        id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'Complete Risk',
        description: 'Test description',
        confidentialityScore: 4,
        integrityScore: 4,
        availabilityScore: 4,
        likelihood: 3,
        calculatedScore: 36,
        status: 'DRAFT',
        riskCategory: 'INFORMATION_SECURITY',
        riskNature: 'STATIC',
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
          title: 'Complete Risk',
          description: 'Test description',
          confidentialityScore: 4,
          integrityScore: 4,
          availabilityScore: 4,
          likelihood: 3,
          riskCategory: 'INFORMATION_SECURITY',
          riskNature: 'STATIC',
          interestedPartyId: partyId,
        })
        .expect(201);

      expect(response.body.title).toBe('Complete Risk');
      expect(response.body.calculatedScore).toBe(36);
    });

    it('should create Unspecified interested party if not provided', async () => {
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

      prisma.interestedParty.findUnique.mockResolvedValue(null);
      prisma.interestedParty.create.mockResolvedValue({ id: 'party-unspecified', name: 'Unspecified' });
      prisma.risk.create.mockResolvedValue(newRisk);
      prisma.risk.findUnique.mockResolvedValue(newRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
        })
        .expect(201);

      expect(prisma.interestedParty.create).toHaveBeenCalled();
    });

    it('should enforce department for CONTRIBUTOR users', async () => {
      const operationsDeptId = '11111111-1111-1111-1111-111111111111';
      const contributorUser = mockUsers.contributor('OPERATIONS');
      const partyId = '550e8400-e29b-41d4-a716-446655440010';
      const newRisk = {
        id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'New Risk',
        calculatedScore: 18,
        departmentId: operationsDeptId,
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
        riskControls: [],
      };

      prisma.user.findUnique.mockResolvedValue(contributorUser);
      prisma.interestedParty.findUnique.mockResolvedValue({ id: partyId });
      prisma.risk.create.mockResolvedValue(newRisk);
      prisma.risk.findUnique.mockResolvedValue(newRisk);
      prisma.department.findUnique.mockResolvedValue({
        id: operationsDeptId,
        name: 'OPERATIONS',
      });

      const _response = await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
        })
        .expect(201);

      expect(prisma.risk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            departmentId: operationsDeptId,
          }),
        })
      );
    });

    it('should return 403 when CONTRIBUTOR has no department', async () => {
      const contributorUser = mockUsers.contributor();
      contributorUser.department = null;
      prisma.user.findUnique.mockResolvedValue(contributorUser);

      await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
        })
        .expect(403);
    });

    it('should return 403 when STAFF tries to create a risk', async () => {
      const staffUser = mockUsers.staff();
      prisma.user.findUnique.mockResolvedValue(staffUser);

      await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
        })
        .expect(403);

      expect(prisma.risk.create).not.toHaveBeenCalled();
    });

    it('should restrict CONTRIBUTOR status to DRAFT or PROPOSED', async () => {
      const contributorUser = mockUsers.contributor('OPERATIONS');
      const partyId = '550e8400-e29b-41d4-a716-446655440010';
      const newRisk = {
        id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'New Risk',
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
      prisma.user.findUnique.mockResolvedValue(contributorUser);
      prisma.department.findUnique.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'OPERATIONS',
      });

      await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
          status: 'ACTIVE',
          interestedPartyId: partyId,
        })
        .expect(201);

      expect(prisma.risk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
          }),
        })
      );
    });

    it('should validate STATIC risk cannot have expiryDate', async () => {
      const partyId = '550e8400-e29b-41d4-a716-446655440010';
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.interestedParty.findUnique.mockResolvedValue({ id: partyId });

      await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
          riskNature: 'STATIC',
          expiryDate: '2024-12-31',
          interestedPartyId: partyId,
        })
        .expect(400);
    });

    it('should validate INSTANCE risk cannot have review dates', async () => {
      const partyId = '550e8400-e29b-41d4-a716-446655440010';
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.interestedParty.findUnique.mockResolvedValue({ id: partyId });

      await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
          riskNature: 'INSTANCE',
          lastReviewDate: '2024-01-01',
          nextReviewDate: '2024-12-31',
          interestedPartyId: partyId,
        })
        .expect(400);
    });

    it('should allow both assets and category to be linked', async () => {
      const partyId = '550e8400-e29b-41d4-a716-446655440010';
      const assetId1 = '550e8400-e29b-41d4-a716-446655440040';
      const assetId2 = '550e8400-e29b-41d4-a716-446655440041';
      const categoryId = '550e8400-e29b-41d4-a716-446655440050';
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.interestedParty.findUnique.mockResolvedValue({ id: partyId });
      prisma.risk.create.mockResolvedValue({
        id: 'risk-1',
        title: 'New Risk',
        assetCategoryId: categoryId,
        interestedPartyId: partyId,
      } as any);
      prisma.riskAsset.createMany.mockResolvedValue({ count: 2 } as any);

      await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
          assetIds: [assetId1, assetId2],
          assetCategoryId: categoryId,
          interestedPartyId: partyId,
        })
        .expect(201);
    });

    it('should return 500 on database error', async () => {
      const partyId = '550e8400-e29b-41d4-a716-446655440010';
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());
      prisma.interestedParty.findUnique.mockResolvedValue({ id: partyId });
      prisma.risk.create.mockRejectedValue(new Error('Database error'));

      await request(app)
        .post('/api/risks')
        .send({
          title: 'New Risk',
          interestedPartyId: partyId,
        })
        .expect(500);
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

    it('should recalculate score when CIA or likelihood changes', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        calculatedScore: 18,
        confidentialityScore: 3,
        integrityScore: 3,
        availabilityScore: 3,
        likelihood: 2,
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
      const updatedRisk = { ...existingRisk, calculatedScore: 24 };

      prisma.risk.findUnique
        .mockResolvedValueOnce(existingRisk)
        .mockResolvedValueOnce(updatedRisk);
      prisma.risk.update.mockResolvedValue(updatedRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put(`/api/risks/${riskId}`)
        .send({
          confidentialityScore: 4,
        })
        .expect(200);

      expect(prisma.risk.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            calculatedScore: expect.any(Number),
          }),
        })
      );
    });

    it('should recalculate mitigated score when mitigated CIA or likelihood changes', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        calculatedScore: 18,
        mitigatedConfidentialityScore: 3,
        mitigatedIntegrityScore: 3,
        mitigatedAvailabilityScore: 3,
        mitigatedLikelihood: 2,
        mitigatedScore: 18,
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
      const updatedRisk = { ...existingRisk, mitigatedScore: 24 };

      prisma.risk.findUnique
        .mockResolvedValueOnce(existingRisk)
        .mockResolvedValueOnce(updatedRisk);
      prisma.risk.update.mockResolvedValue(updatedRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put(`/api/risks/${riskId}`)
        .send({
          mitigatedConfidentialityScore: 4,
        })
        .expect(200);

      expect(prisma.risk.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mitigatedScore: expect.any(Number),
          }),
        })
      );
    });

    it('should prevent CONTRIBUTOR from editing other department risks', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        department: 'FINANCE',
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
      const contributorUser = mockUsers.contributor('OPERATIONS');

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.user.findUnique.mockResolvedValue(contributorUser);

      await request(app)
        .put(`/api/risks/${riskId}`)
        .send({
          title: 'Updated',
        })
        .expect(403);
    });

    it('should return 403 when STAFF tries to edit a risk', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        department: 'OPERATIONS',
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
      const staffUser = mockUsers.staff();

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.user.findUnique.mockResolvedValue(staffUser);

      await request(app)
        .put(`/api/risks/${riskId}`)
        .send({
          title: 'Updated',
        })
        .expect(403);

      expect(prisma.risk.update).not.toHaveBeenCalled();
    });

    it('should prevent CONTRIBUTOR from setting status to ACTIVE', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        department: 'OPERATIONS',
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
      const contributorUser = mockUsers.contributor('OPERATIONS');

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.user.findUnique.mockResolvedValue(contributorUser);

      await request(app)
        .put(`/api/risks/${riskId}`)
        .send({
          status: 'ACTIVE',
        })
        .expect(403);
    });

    it('should prevent CONTRIBUTOR from changing department field', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        department: 'OPERATIONS',
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
      const contributorUser = mockUsers.contributor('OPERATIONS');

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.user.findUnique.mockResolvedValue(contributorUser);

      await request(app)
        .put(`/api/risks/${riskId}`)
        .send({
          department: 'FINANCE',
        })
        .expect(403);

      expect(prisma.risk.update).not.toHaveBeenCalled();
    });

    it('should allow ADMIN to test as CONTRIBUTOR with testDepartment', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const operationsDeptId = '11111111-1111-1111-1111-111111111111';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        department: 'OPERATIONS',
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
      const updatedRisk = { ...existingRisk, title: 'Updated Risk' };
      const adminUser = mockUsers.admin();

      prisma.risk.findUnique
        .mockResolvedValueOnce(existingRisk)
        .mockResolvedValueOnce(updatedRisk);
      prisma.risk.update.mockResolvedValue(updatedRisk);
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.department.findUnique.mockResolvedValue({
        id: operationsDeptId,
        name: 'OPERATIONS',
      });

      await request(app)
        .put(`/api/risks/${riskId}?testDepartment=OPERATIONS`)
        .send({
          title: 'Updated Risk',
        })
        .expect(200);
    });

    it('should validate STATIC risk cannot have expiryDate on update', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        riskNature: 'STATIC',
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

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put(`/api/risks/${riskId}`)
        .send({
          expiryDate: '2024-12-31',
        })
        .expect(400);
    });

    it('should validate INSTANCE risk cannot have review dates on update', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        riskNature: 'INSTANCE',
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

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put(`/api/risks/${riskId}`)
        .send({
          lastReviewDate: '2024-01-01',
        })
        .expect(400);
    });

    it('should allow both assets and category to be linked on update', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
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
      const assetIds = ['550e8400-e29b-41d4-a716-446655440040'];
      const categoryId = '550e8400-e29b-41d4-a716-446655440050';

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.risk.update.mockResolvedValue({ ...existingRisk, assetCategoryId: categoryId } as any);
      prisma.riskAsset.deleteMany.mockResolvedValue({ count: 0 } as any);
      prisma.riskAsset.createMany.mockResolvedValue({ count: 1 } as any);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put(`/api/risks/${riskId}`)
        .send({
          assetIds,
          assetCategoryId: categoryId,
        })
        .expect(200);
    });

    it('should return 500 on database error', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
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

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.risk.update.mockRejectedValue(new Error('Database error'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .put(`/api/risks/${riskId}`)
        .send({
          title: 'Updated',
        })
        .expect(500);
    });
  });

  describe('PATCH /api/risks/:id/status', () => {
    it('should update risk status', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        status: 'DRAFT',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };
      const updatedRisk = { ...existingRisk, status: 'PROPOSED' };

      prisma.risk.findUnique
        .mockResolvedValueOnce(existingRisk)
        .mockResolvedValueOnce(updatedRisk);
      prisma.risk.update.mockResolvedValue(updatedRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .patch(`/api/risks/${riskId}/status`)
        .send({
          status: 'PROPOSED',
        })
        .expect(200);

      expect(response.body.status).toBe('PROPOSED');
    });

    it('should store rejection reason when status is REJECTED', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        status: 'PROPOSED',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };
      const updatedRisk = { ...existingRisk, status: 'REJECTED', rejectionReason: 'Not valid' };

      prisma.risk.findUnique
        .mockResolvedValueOnce(existingRisk)
        .mockResolvedValueOnce(updatedRisk);
      prisma.risk.update.mockResolvedValue(updatedRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .patch(`/api/risks/${riskId}/status`)
        .send({
          status: 'REJECTED',
          rejectionReason: 'Not valid',
        })
        .expect(200);

      expect(prisma.risk.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            rejectionReason: 'Not valid',
          }),
        })
      );
    });

    it('should return 403 for invalid status transition', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        status: 'DRAFT',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { validateStatusTransition } = require('../../services/riskService');
      validateStatusTransition.mockReturnValueOnce(false);

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .patch(`/api/risks/${riskId}/status`)
        .send({
          status: 'ACTIVE',
        })
        .expect(403);
    });

    it('should return 404 when risk not found', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440000';
      prisma.risk.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .patch(`/api/risks/${riskId}/status`)
        .send({
          status: 'PROPOSED',
        })
        .expect(404);
    });

    it('should return 500 on database error', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        status: 'DRAFT',
        owner: {
          id: '550e8400-e29b-41d4-a716-446655440030',
          displayName: 'Test Owner',
          email: 'owner@paythru.com',
        },
      };

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.risk.update.mockRejectedValue(new Error('Database error'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .patch(`/api/risks/${riskId}/status`)
        .send({
          status: 'PROPOSED',
        })
        .expect(500);
    });
  });

  describe('POST /api/risks/:id/merge', () => {
    it('should merge duplicate risk', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const targetRiskId = '550e8400-e29b-41d4-a716-446655440002';
      const existingRisk = {
        id: riskId,
        title: 'Duplicate Risk',
        status: 'PROPOSED',
      };
      const targetRisk = {
        id: targetRiskId,
        title: 'Target Risk',
        status: 'ACTIVE',
      };
      const mergedRisk = {
        ...existingRisk,
        status: 'REJECTED',
        rejectionReason: 'Merged as duplicate',
        mergedIntoRiskId: targetRiskId,
      };

      prisma.risk.findUnique
        .mockResolvedValueOnce(existingRisk)
        .mockResolvedValueOnce(targetRisk);
      prisma.risk.update.mockResolvedValue(mergedRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .post(`/api/risks/${riskId}/merge`)
        .send({
          targetRiskId,
        })
        .expect(200);

      expect(response.body.message).toBe('Risk merged successfully');
      expect(response.body.mergedRisk.status).toBe('REJECTED');
    });

    it('should return 400 when target risk is not ACTIVE', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const targetRiskId = '550e8400-e29b-41d4-a716-446655440002';
      const existingRisk = {
        id: riskId,
        title: 'Duplicate Risk',
        status: 'PROPOSED',
      };
      const targetRisk = {
        id: targetRiskId,
        title: 'Target Risk',
        status: 'DRAFT',
      };

      prisma.risk.findUnique
        .mockResolvedValueOnce(existingRisk)
        .mockResolvedValueOnce(targetRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/merge`)
        .send({
          targetRiskId,
        })
        .expect(400);
    });

    it('should return 404 when risk not found', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440000';
      const targetRiskId = '550e8400-e29b-41d4-a716-446655440002';
      prisma.risk.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/merge`)
        .send({
          targetRiskId,
        })
        .expect(404);
    });

    it('should return 404 when target risk not found', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const targetRiskId = '550e8400-e29b-41d4-a716-446655440000';
      const existingRisk = {
        id: riskId,
        title: 'Duplicate Risk',
        status: 'PROPOSED',
      };

      prisma.risk.findUnique
        .mockResolvedValueOnce(existingRisk)
        .mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/merge`)
        .send({
          targetRiskId,
        })
        .expect(404);
    });
  });

  describe('DELETE /api/risks/:id', () => {
    it('should delete risk and related records', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Risk to Delete',
      };

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.$transaction.mockResolvedValue(undefined);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/risks/${riskId}`)
        .expect(204);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should return 404 when risk not found', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440000';
      prisma.risk.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/risks/${riskId}`)
        .expect(404);
    });

    it('should return 500 on database error', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Risk to Delete',
      };

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.$transaction.mockRejectedValue(new Error('Database error'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .delete(`/api/risks/${riskId}`)
        .expect(500);
    });
  });

  describe('POST /api/risks/:id/controls', () => {
    it('should associate controls with risk', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        riskControls: [
          {
            control: {
              id: '550e8400-e29b-41d4-a716-446655440011',
              code: 'A.8.3',
              title: 'Control 1',
            },
          },
          {
            control: {
              id: '550e8400-e29b-41d4-a716-446655440012',
              code: 'A.5.9',
              title: 'Control 2',
            },
          },
        ],
      };
      const mockControls = [
        { id: '550e8400-e29b-41d4-a716-446655440011', code: 'A.8.3' },
        { id: '550e8400-e29b-41d4-a716-446655440012', code: 'A.5.9' },
      ];

      prisma.risk.findUnique
        .mockResolvedValueOnce({ id: riskId }) // First call: verify risk exists
        .mockResolvedValueOnce(existingRisk); // Second call: get risk with controls
      prisma.control.findMany.mockResolvedValue(mockControls);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .post(`/api/risks/${riskId}/controls`)
        .send({
          controlIds: ['550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440012'],
        })
        .expect(200);

      expect(response.body.id).toBe(riskId);
      expect(prisma.control.findMany).toHaveBeenCalled();
    });

    it('should remove duplicates from controlIds', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        riskControls: [],
      };
      const mockControls = [
        { id: '550e8400-e29b-41d4-a716-446655440011', code: 'A.8.3' },
      ];

      prisma.risk.findUnique
        .mockResolvedValueOnce({ id: riskId })
        .mockResolvedValueOnce(existingRisk);
      prisma.control.findMany.mockResolvedValue(mockControls);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/controls`)
        .send({
          controlIds: [
            '550e8400-e29b-41d4-a716-446655440011',
            '550e8400-e29b-41d4-a716-446655440011', // duplicate
          ],
        })
        .expect(200);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should return 400 when some controls not found', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const mockControls = [
        { id: '550e8400-e29b-41d4-a716-446655440011', code: 'A.8.3' },
      ];

      prisma.risk.findUnique.mockResolvedValue({ id: riskId });
      prisma.control.findMany.mockResolvedValue(mockControls);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/controls`)
        .send({
          controlIds: [
            '550e8400-e29b-41d4-a716-446655440011',
            '550e8400-e29b-41d4-a716-446655440099', // not found
          ],
        })
        .expect(400);
    });

    it('should return 404 when risk not found', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440000';
      prisma.risk.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/controls`)
        .send({
          controlIds: ['550e8400-e29b-41d4-a716-446655440011'],
        })
        .expect(404);
    });

    it('should return 400 for invalid controlIds format', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/controls`)
        .send({
          controlIds: 'not-an-array',
        })
        .expect(400);
    });

    it('should handle empty controlIds array', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const existingRisk = {
        id: riskId,
        title: 'Existing Risk',
        riskControls: [],
      };

      prisma.risk.findUnique
        .mockResolvedValueOnce({ id: riskId })
        .mockResolvedValueOnce(existingRisk);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/controls`)
        .send({
          controlIds: [],
        })
        .expect(200);

      expect(prisma.riskControl.deleteMany).toHaveBeenCalled();
    });
  });

  describe('POST /api/risks/suggest-controls', () => {
    it('should suggest controls based on risk text', async () => {
      const mockControls = [
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Test Control',
          embedding: [0.1, 0.2, 0.3],
        },
      ];

      prisma.control.findMany.mockResolvedValue(mockControls);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .post('/api/risks/suggest-controls')
        .send({
          title: 'Test Risk',
          description: 'Risk description',
          threatDescription: 'Threat description',
        })
        .expect(200);

      expect(response.body.suggestedControlIds).toBeDefined();
      expect(Array.isArray(response.body.suggestedControlIds)).toBe(true);
    });

    it('should return 400 when no text provided', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/risks/suggest-controls')
        .send({})
        .expect(400);
    });

    it('should handle supplier-related risks', async () => {
      const mockControls = [
        {
          id: 'control-1',
          code: '5.19',
          title: 'Supplier Control',
          embedding: [0.1, 0.2, 0.3],
        },
      ];

      prisma.control.findMany.mockResolvedValue(mockControls);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/risks/suggest-controls')
        .send({
          title: 'Supplier risk',
          description: 'Third-party vendor risk',
        })
        .expect(200);

      expect(prisma.control.findMany).toHaveBeenCalled();
    });

    it('should return 500 when embedding generation fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { generateEmbeddingRemote } = require('../../clients/aiServiceClient');
      generateEmbeddingRemote.mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/risks/suggest-controls')
        .send({
          title: 'Test Risk',
        })
        .expect(500);
    });
  });

  describe('POST /api/risks/import', () => {
    it('should import risks from CSV file', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { importRisksFromCSV } = require('../../services/riskImportService');
      importRisksFromCSV.mockResolvedValueOnce({
        success: 10,
        failed: 2,
        total: 12,
        errors: [],
      });
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .post('/api/risks/import')
        .attach('file', Buffer.from('csv,data'), 'risks.csv')
        .expect(200);

      expect(response.body.success).toBe(10);
      expect(response.body.failed).toBe(2);
    });

    it('should return 400 when no file provided', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/risks/import')
        .send({})
        .expect(400);
    });

    it('should return 500 on import error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { importRisksFromCSV } = require('../../services/riskImportService');
      importRisksFromCSV.mockRejectedValueOnce(new Error('Import failed'));
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      // Mock req.file to simulate multer attachment
      // The multer middleware is mocked to call next(), so we need to ensure the handler receives the file
      await request(app)
        .post('/api/risks/import')
        .attach('file', Buffer.from('csv,data'), 'risks.csv')
        .expect(500);
    });
  });

  describe('POST /api/risks/check-similarity', () => {
    it('should check similarity for new risk', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { checkSimilarityForNewRisk } = require('../../services/similarityService');
      checkSimilarityForNewRisk.mockResolvedValueOnce([
        {
          risk: { id: 'risk-1', title: 'Similar Risk' },
          score: 0.85,
          fields: ['title'],
        },
      ]);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .post('/api/risks/check-similarity')
        .send({
          title: 'Test Risk',
          description: 'Test description',
        })
        .expect(200);

      expect(response.body.similarRisks).toHaveLength(1);
      expect(response.body.similarRisks[0].similarityScore).toBe(0.85);
    });

    it('should exclude risk by excludeId', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { checkSimilarityForNewRisk } = require('../../services/similarityService');
      checkSimilarityForNewRisk.mockResolvedValueOnce([]);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/risks/check-similarity')
        .send({
          title: 'Test Risk',
          excludeId: '550e8400-e29b-41d4-a716-446655440001',
        })
        .expect(200);

      expect(checkSimilarityForNewRisk).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeId: '550e8400-e29b-41d4-a716-446655440001',
        }),
        5
      );
    });

    it('should return 400 when title is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post('/api/risks/check-similarity')
        .send({
          description: 'Test description',
        })
        .expect(400);
    });
  });

  describe('POST /api/risks/:id/similar', () => {
    it('should find similar risks for existing risk', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { findSimilarRisksForRisk } = require('../../services/similarityService');
      findSimilarRisksForRisk.mockResolvedValueOnce([
        {
          risk: { id: 'risk-2', title: 'Similar Risk' },
          score: 0.9,
          fields: ['title', 'description'],
        },
      ]);

      const response = await request(app)
        .post(`/api/risks/${riskId}/similar`)
        .expect(200);

      expect(response.body.similarRisks).toHaveLength(1);
      expect(findSimilarRisksForRisk).toHaveBeenCalledWith(riskId, 10);
    });

    it('should respect limit parameter', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { findSimilarRisksForRisk } = require('../../services/similarityService');
      findSimilarRisksForRisk.mockResolvedValueOnce([]);

      await request(app)
        .post(`/api/risks/${riskId}/similar?limit=5`)
        .expect(200);

      expect(findSimilarRisksForRisk).toHaveBeenCalledWith(riskId, 5);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app)
        .post('/api/risks/invalid-id/similar')
        .expect(400);
    });
  });

  describe('GET /api/risks/:id/suppliers', () => {
    it('should return suppliers linked to risk', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const mockLinks = [
        {
          supplier: {
            id: 'supplier-1',
            name: 'Test Supplier',
            supplierType: 'VENDOR',
            criticality: 'HIGH',
            status: 'ACTIVE',
          },
        },
      ];

      prisma.supplierRiskLink.findMany.mockResolvedValue(mockLinks);

      const response = await request(app)
        .get(`/api/risks/${riskId}/suppliers`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Test Supplier');
    });

    it('should return empty array when no suppliers linked', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      prisma.supplierRiskLink.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/risks/${riskId}/suppliers`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app)
        .get('/api/risks/invalid-id/suppliers')
        .expect(400);
    });
  });

  describe('POST /api/risks/:id/suppliers', () => {
    it('should link supplier to risk', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const supplierId = '550e8400-e29b-41d4-a716-446655440060';
      const existingRisk = {
        id: riskId,
        title: 'Test Risk',
        isSupplierRisk: false,
      };
      const existingSupplier = {
        id: supplierId,
        name: 'Test Supplier',
        supplierType: 'VENDOR',
        criticality: 'HIGH',
        status: 'ACTIVE',
      };
      const linkedSupplier = {
        id: supplierId,
        name: 'Test Supplier',
        supplierType: 'VENDOR',
        criticality: 'HIGH',
        status: 'ACTIVE',
      };

      prisma.risk.findUnique
        .mockResolvedValueOnce(existingRisk)
        .mockResolvedValueOnce({ ...existingRisk, isSupplierRisk: true });
      prisma.supplier.findUnique.mockResolvedValue(existingSupplier);
      prisma.supplierRiskLink.findUnique.mockResolvedValue(null);
      prisma.supplierRiskLink.create.mockResolvedValue({});
      prisma.supplier.findUnique.mockResolvedValue(linkedSupplier);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      const response = await request(app)
        .post(`/api/risks/${riskId}/suppliers`)
        .send({
          supplierId,
        })
        .expect(201);

      expect(response.body.name).toBe('Test Supplier');
    });

    it('should return 404 when risk not found', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440000';
      const supplierId = '550e8400-e29b-41d4-a716-446655440060';
      prisma.risk.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/suppliers`)
        .send({
          supplierId,
        })
        .expect(404);
    });

    it('should return 404 when supplier not found', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const supplierId = '550e8400-e29b-41d4-a716-446655440000';
      const existingRisk = {
        id: riskId,
        title: 'Test Risk',
      };

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.supplier.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/suppliers`)
        .send({
          supplierId,
        })
        .expect(404);
    });

    it('should return 400 when supplier already linked', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const supplierId = '550e8400-e29b-41d4-a716-446655440060';
      const existingRisk = {
        id: riskId,
        title: 'Test Risk',
      };
      const existingSupplier = {
        id: supplierId,
        name: 'Test Supplier',
      };
      const existingLink = {
        supplierId,
        riskId,
      };

      prisma.risk.findUnique.mockResolvedValue(existingRisk);
      prisma.supplier.findUnique.mockResolvedValue(existingSupplier);
      prisma.supplierRiskLink.findUnique.mockResolvedValue(existingLink);
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/suppliers`)
        .send({
          supplierId,
        })
        .expect(400);
    });

    it('should mark risk as supplier risk when linking', async () => {
      const riskId = '550e8400-e29b-41d4-a716-446655440001';
      const supplierId = '550e8400-e29b-41d4-a716-446655440060';
      const existingRisk = {
        id: riskId,
        title: 'Test Risk',
        isSupplierRisk: false,
      };
      const existingSupplier = {
        id: supplierId,
        name: 'Test Supplier',
        supplierType: 'VENDOR',
        criticality: 'HIGH',
        status: 'ACTIVE',
      };
      const linkedSupplier = {
        id: supplierId,
        name: 'Test Supplier',
        supplierType: 'VENDOR',
        criticality: 'HIGH',
        status: 'ACTIVE',
      };

      prisma.risk.findUnique
        .mockResolvedValueOnce(existingRisk)
        .mockResolvedValueOnce({ ...existingRisk, isSupplierRisk: true });
      prisma.supplier.findUnique.mockResolvedValue(existingSupplier);
      prisma.supplierRiskLink.findUnique.mockResolvedValue(null);
      prisma.supplierRiskLink.create.mockResolvedValue({});
      prisma.supplier.findUnique.mockResolvedValue(linkedSupplier);
      prisma.risk.update.mockResolvedValue({ ...existingRisk, isSupplierRisk: true });
      prisma.user.findUnique.mockResolvedValue(mockUsers.admin());

      await request(app)
        .post(`/api/risks/${riskId}/suppliers`)
        .send({
          supplierId,
        })
        .expect(201);

      expect(prisma.risk.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isSupplierRisk: true },
        })
      );
    });
  });
});

