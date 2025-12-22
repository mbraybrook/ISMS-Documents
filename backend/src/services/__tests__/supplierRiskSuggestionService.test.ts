/* eslint-disable @typescript-eslint/no-explicit-any */
import { findRelevantRisksForSupplier } from '../supplierRiskSuggestionService';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    supplier: {
      findUnique: jest.fn(),
    },
    risk: {
      findMany: jest.fn(),
    },
    supplierRiskLink: {
      findMany: jest.fn(),
    },
  },
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    llm: {
      maxEmbeddingTextLength: 1024,
    },
  },
}));

// Mock llmService
jest.mock('../llmService', () => ({
  findSimilarRisks: jest.fn(),
}));

// Import mocked modules
import { prisma } from '../../lib/prisma';
import { findSimilarRisks } from '../llmService';

const mockPrisma = prisma as any;
const mockFindSimilarRisks = findSimilarRisks as jest.MockedFunction<typeof findSimilarRisks>;

describe('supplierRiskSuggestionService', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('findRelevantRisksForSupplier', () => {
    const supplierId = 'supplier-1';
    const mockSupplier = {
      id: supplierId,
      name: 'Test Supplier',
      tradingName: 'Test Trading Name',
      supplierType: 'SERVICE_PROVIDER',
      serviceDescription: 'Provides cloud infrastructure services',
      riskRationale: 'High dependency on external provider',
      criticalityRationale: 'Critical for business operations',
    };

    const createMockRisk = (overrides?: any) => ({
      id: `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: 'Test Risk',
      threatDescription: 'Test threat description',
      description: 'Test description',
      embedding: [0.1, 0.2, 0.3],
      riskCategory: 'OPERATIONAL',
      calculatedScore: 50,
      status: 'ACTIVE',
      ownerUserId: 'user-1',
      owner: {
        id: 'user-1',
        displayName: 'Test User',
        email: 'test@paythru.com',
      },
      ...overrides,
    });

    it('should return empty array when supplier is not found (error handling)', async () => {
      // Arrange
      mockPrisma.supplier.findUnique.mockResolvedValue(null);

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SupplierRiskSuggestion] Error finding relevant risks'),
        expect.any(Error)
      );
      expect(mockPrisma.supplier.findUnique).toHaveBeenCalledWith({
        where: { id: supplierId },
        select: {
          id: true,
          name: true,
          tradingName: true,
          supplierType: true,
          serviceDescription: true,
          riskRationale: true,
          criticalityRationale: true,
        },
      });
    });

    it('should return empty array when supplier has insufficient data', async () => {
      // Arrange
      // Create supplier where all fields are null/empty/whitespace
      // This results in normalized text being empty string (length 0 < 10)
      const supplierWithMinimalData = {
        ...mockSupplier,
        serviceDescription: null,
        riskRationale: null,
        criticalityRationale: null,
        name: '   ', // Whitespace only - trims to empty
        tradingName: null,
        supplierType: null,
      };
      mockPrisma.supplier.findUnique.mockResolvedValue(supplierWithMinimalData);

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      // When all fields are null/empty/whitespace, no parts are added
      // Normalized text is empty string, which trimmed has length 0 < 10
      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SupplierRiskSuggestion] Insufficient supplier data')
      );
    });

    it('should return empty array when no risks are available', async () => {
      // Arrange
      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.risk.findMany.mockResolvedValue([]);

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toEqual([]);
      expect(mockPrisma.risk.findMany).toHaveBeenCalledWith({
        where: {
          archived: false,
        },
        select: {
          id: true,
          title: true,
          threatDescription: true,
          description: true,
          embedding: true,
          riskCategory: true,
          calculatedScore: true,
          status: true,
          ownerUserId: true,
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
        take: 100,
      });
    });

    it('should exclude already-linked risks', async () => {
      // Arrange
      const risk1 = createMockRisk({ id: 'risk-1' });
      const risk2 = createMockRisk({ id: 'risk-2' });
      const risk3 = createMockRisk({ id: 'risk-3' });

      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.risk.findMany.mockResolvedValue([risk1, risk2, risk3]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([
        { riskId: 'risk-1' },
        { riskId: 'risk-2' },
      ]);
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-3', score: 75, matchedFields: ['title'] },
      ]);

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].risk.id).toBe('risk-3');
      expect(mockFindSimilarRisks).toHaveBeenCalled();
      // Verify risk-1 and risk-2 were not passed to findSimilarRisks
      const callArgs = mockFindSimilarRisks.mock.calls[0];
      const candidateRisks = callArgs[1];
      expect(candidateRisks).not.toContainEqual(expect.objectContaining({ id: 'risk-1' }));
      expect(candidateRisks).not.toContainEqual(expect.objectContaining({ id: 'risk-2' }));
      expect(candidateRisks).toContainEqual(expect.objectContaining({ id: 'risk-3' }));
    });

    it('should return empty array when all risks are already linked', async () => {
      // Arrange
      const risk1 = createMockRisk({ id: 'risk-1' });
      const risk2 = createMockRisk({ id: 'risk-2' });

      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.risk.findMany.mockResolvedValue([risk1, risk2]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([
        { riskId: 'risk-1' },
        { riskId: 'risk-2' },
      ]);

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toEqual([]);
      expect(mockFindSimilarRisks).not.toHaveBeenCalled();
    });

    it('should filter results by minimum similarity threshold of 50', async () => {
      // Arrange
      const risk1 = createMockRisk({ id: 'risk-1' });
      const risk2 = createMockRisk({ id: 'risk-2' });
      const risk3 = createMockRisk({ id: 'risk-3' });

      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.risk.findMany.mockResolvedValue([risk1, risk2, risk3]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 75, matchedFields: ['title'] },
        { riskId: 'risk-2', score: 45, matchedFields: [] }, // Below threshold
        { riskId: 'risk-3', score: 60, matchedFields: ['title', 'description'] },
      ]);

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].risk.id).toBe('risk-1');
      expect(result[0].similarityScore).toBe(75);
      expect(result[1].risk.id).toBe('risk-3');
      expect(result[1].similarityScore).toBe(60);
      // risk-2 should be filtered out (score 45 < 50)
    });

    it('should respect limit parameter', async () => {
      // Arrange
      const risks = Array.from({ length: 20 }, (_, i) =>
        createMockRisk({ id: `risk-${i}` })
      );

      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.risk.findMany.mockResolvedValue(risks);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockResolvedValue(
        risks.map((risk, i) => ({
          riskId: risk.id,
          score: 80 - i, // Decreasing scores
          matchedFields: ['title'],
        }))
      );

      // Act
      const result = await findRelevantRisksForSupplier(supplierId, 5);

      // Assert
      expect(result).toHaveLength(5);
      expect(result[0].similarityScore).toBe(80);
      expect(result[4].similarityScore).toBe(76);
    });

    it('should return results with full risk data and metadata', async () => {
      // Arrange
      const risk = createMockRisk({
        id: 'risk-1',
        title: 'Data Breach Risk',
        riskCategory: 'SECURITY',
        calculatedScore: 75,
        status: 'ACTIVE',
      });

      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.risk.findMany.mockResolvedValue([risk]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockResolvedValue([
        {
          riskId: 'risk-1',
          score: 85,
          matchedFields: ['title', 'description'],
        },
      ]);

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        risk: expect.objectContaining({
          id: 'risk-1',
          title: 'Data Breach Risk',
          riskCategory: 'SECURITY',
          calculatedScore: 75,
          status: 'ACTIVE',
          owner: expect.objectContaining({
            id: 'user-1',
            displayName: 'Test User',
            email: 'test@paythru.com',
          }),
        }),
        similarityScore: 85,
        matchedFields: ['title', 'description'],
      });
    });

    it('should normalize supplier text correctly with all fields', async () => {
      // Arrange
      const supplierWithAllFields = {
        ...mockSupplier,
        name: 'Full Supplier Name',
        tradingName: 'Trading Name Inc',
        supplierType: 'SERVICE_PROVIDER',
        serviceDescription: 'Cloud hosting services',
        riskRationale: 'Single point of failure',
        criticalityRationale: 'Business critical operations',
      };
      const risk = createMockRisk();

      mockPrisma.supplier.findUnique.mockResolvedValue(supplierWithAllFields);
      mockPrisma.risk.findMany.mockResolvedValue([risk]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: risk.id, score: 70, matchedFields: ['title'] },
      ]);

      // Act
      await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(mockFindSimilarRisks).toHaveBeenCalled();
      const normalizedText = mockFindSimilarRisks.mock.calls[0][0];
      expect(normalizedText).toContain('service description: cloud hosting services');
      expect(normalizedText).toContain('risk rationale: single point of failure');
      expect(normalizedText).toContain('criticality rationale: business critical operations');
      expect(normalizedText).toContain('supplier name: full supplier name');
      expect(normalizedText).toContain('trading name: trading name inc');
      expect(normalizedText).toContain('supplier type: service_provider');
      expect(normalizedText).toBe(normalizedText.toLowerCase()); // Should be lowercased
    });

    it('should prioritize primary fields in normalized text', async () => {
      // Arrange
      const supplierWithPrimaryFields = {
        ...mockSupplier,
        name: 'Supplier',
        tradingName: null,
        supplierType: null,
        serviceDescription: 'Primary service description',
        riskRationale: 'Primary risk rationale',
        criticalityRationale: 'Primary criticality rationale',
      };
      const risk = createMockRisk();

      mockPrisma.supplier.findUnique.mockResolvedValue(supplierWithPrimaryFields);
      mockPrisma.risk.findMany.mockResolvedValue([risk]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: risk.id, score: 70, matchedFields: ['title'] },
      ]);

      // Act
      await findRelevantRisksForSupplier(supplierId);

      // Assert
      const normalizedText = mockFindSimilarRisks.mock.calls[0][0];
      // Primary fields should appear first (lowercase)
      const serviceDescIndex = normalizedText.indexOf('service description');
      const riskRationaleIndex = normalizedText.indexOf('risk rationale');
      const criticalityIndex = normalizedText.indexOf('criticality rationale');
      const supplierNameIndex = normalizedText.indexOf('supplier name');

      expect(serviceDescIndex).toBeLessThan(supplierNameIndex);
      expect(riskRationaleIndex).toBeLessThan(supplierNameIndex);
      expect(criticalityIndex).toBeLessThan(supplierNameIndex);
    });

    it('should handle null and empty fields in supplier data', async () => {
      // Arrange
      const supplierWithNulls = {
        ...mockSupplier,
        tradingName: null,
        supplierType: null,
        serviceDescription: 'Only service description',
        riskRationale: null,
        criticalityRationale: null,
      };
      const risk = createMockRisk();

      mockPrisma.supplier.findUnique.mockResolvedValue(supplierWithNulls);
      mockPrisma.risk.findMany.mockResolvedValue([risk]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: risk.id, score: 70, matchedFields: ['title'] },
      ]);

      // Act
      await findRelevantRisksForSupplier(supplierId);

      // Assert
      const normalizedText = mockFindSimilarRisks.mock.calls[0][0];
      expect(normalizedText).toContain('service description: only service description');
      expect(normalizedText).toContain('supplier name: test supplier');
      expect(normalizedText).not.toContain('trading name:');
      expect(normalizedText).not.toContain('supplier type:');
      expect(normalizedText).not.toContain('risk rationale:');
      expect(normalizedText).not.toContain('criticality rationale:');
    });

    it('should truncate normalized text if it exceeds maxEmbeddingTextLength', async () => {
      // Arrange
      const longText = 'A'.repeat(2000);
      const supplierWithLongText = {
        ...mockSupplier,
        serviceDescription: longText,
        riskRationale: longText,
        criticalityRationale: longText,
      };
      const risk = createMockRisk();

      mockPrisma.supplier.findUnique.mockResolvedValue(supplierWithLongText);
      mockPrisma.risk.findMany.mockResolvedValue([risk]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: risk.id, score: 70, matchedFields: ['title'] },
      ]);

      // Act
      await findRelevantRisksForSupplier(supplierId);

      // Assert
      const normalizedText = mockFindSimilarRisks.mock.calls[0][0];
      expect(normalizedText.length).toBeLessThanOrEqual(1024);
    });

    it('should handle risks with array embeddings', async () => {
      // Arrange
      const riskWithArrayEmbedding = createMockRisk({
        id: 'risk-1',
        embedding: [0.1, 0.2, 0.3] as any,
      });

      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.risk.findMany.mockResolvedValue([riskWithArrayEmbedding]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 70, matchedFields: ['title'] },
      ]);

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toHaveLength(1);
      expect(mockFindSimilarRisks).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({
            id: 'risk-1',
            embedding: [0.1, 0.2, 0.3],
          }),
        ])
      );
    });

    it('should handle risks with null embeddings', async () => {
      // Arrange
      const riskWithNullEmbedding = createMockRisk({
        id: 'risk-1',
        embedding: null,
      });

      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.risk.findMany.mockResolvedValue([riskWithNullEmbedding]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 70, matchedFields: ['title'] },
      ]);

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toHaveLength(1);
      expect(mockFindSimilarRisks).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({
            id: 'risk-1',
            embedding: null,
          }),
        ])
      );
    });

    it('should handle errors gracefully and return empty array', async () => {
      // Arrange
      mockPrisma.supplier.findUnique.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SupplierRiskSuggestion] Error finding relevant risks'),
        expect.any(Error)
      );
    });

    it('should handle errors in findSimilarRisks gracefully', async () => {
      // Arrange
      const risk = createMockRisk();

      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.risk.findMany.mockResolvedValue([risk]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockRejectedValue(new Error('LLM service error'));

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SupplierRiskSuggestion] Error finding relevant risks'),
        expect.any(Error)
      );
    });

    it('should handle empty similarity results', async () => {
      // Arrange
      const risk = createMockRisk();

      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.risk.findMany.mockResolvedValue([risk]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockResolvedValue([]);

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle risks that are not found in candidate risks after filtering', async () => {
      // Arrange
      const risk1 = createMockRisk({ id: 'risk-1' });
      const risk2 = createMockRisk({ id: 'risk-2' });

      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.risk.findMany.mockResolvedValue([risk1, risk2]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      // findSimilarRisks returns a riskId that doesn't exist in candidateRisks
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 75, matchedFields: ['title'] },
        { riskId: 'non-existent-risk', score: 80, matchedFields: ['title'] },
      ]);

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].risk.id).toBe('risk-1');
      // non-existent-risk should be filtered out
    });

    it('should use default limit of 15 when not specified', async () => {
      // Arrange
      const risks = Array.from({ length: 20 }, (_, i) =>
        createMockRisk({ id: `risk-${i}` })
      );

      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.risk.findMany.mockResolvedValue(risks);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockResolvedValue(
        risks.map((risk) => ({
          riskId: risk.id,
          score: 70,
          matchedFields: ['title'],
        }))
      );

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toHaveLength(15); // Default limit
    });

    it('should handle supplier with only name field (minimal valid data)', async () => {
      // Arrange
      const supplierWithOnlyName = {
        ...mockSupplier,
        name: 'Valid Supplier Name With Enough Characters',
        tradingName: null,
        supplierType: null,
        serviceDescription: null,
        riskRationale: null,
        criticalityRationale: null,
      };
      const risk = createMockRisk();

      mockPrisma.supplier.findUnique.mockResolvedValue(supplierWithOnlyName);
      mockPrisma.risk.findMany.mockResolvedValue([risk]);
      mockPrisma.supplierRiskLink.findMany.mockResolvedValue([]);
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: risk.id, score: 70, matchedFields: ['title'] },
      ]);

      // Act
      const result = await findRelevantRisksForSupplier(supplierId);

      // Assert
      expect(result).toHaveLength(1);
      const normalizedText = mockFindSimilarRisks.mock.calls[0][0];
      expect(normalizedText).toContain('supplier name: valid supplier name with enough characters');
    });
  });
});

