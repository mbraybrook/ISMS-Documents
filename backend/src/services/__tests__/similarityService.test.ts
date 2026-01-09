/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  findSimilarRisksForRisk,
  checkSimilarityForNewRisk,
} from '../similarityService';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    risk: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    llm: {
      similarityThreshold: 70,
    },
  },
}));

// Mock llmService
jest.mock('../llmService', () => ({
  findSimilarRisks: jest.fn(),
  calculateSimilarityScoreChat: jest.fn(),
  normalizeRiskText: jest.fn((title, threat, desc) => {
    const parts = [title, threat, desc].filter(Boolean).join(' ');
    return parts.toLowerCase();
  }),
}));

// Mock embeddingService
jest.mock('../embeddingService', () => ({
  computeAndStoreEmbedding: jest.fn(),
}));

// Import mocked modules
import { prisma } from '../../lib/prisma';
import { config as _config } from '../../config';
import {
  findSimilarRisks,
  calculateSimilarityScoreChat,
  normalizeRiskText,
} from '../llmService';
import { computeAndStoreEmbedding } from '../embeddingService';

const mockPrisma = prisma as any;
const mockFindSimilarRisks = findSimilarRisks as jest.MockedFunction<typeof findSimilarRisks>;
const mockCalculateSimilarityScoreChat = calculateSimilarityScoreChat as jest.MockedFunction<
  typeof calculateSimilarityScoreChat
>;
const mockNormalizeRiskText = normalizeRiskText as jest.MockedFunction<typeof normalizeRiskText>;
const mockComputeAndStoreEmbedding = computeAndStoreEmbedding as jest.MockedFunction<
  typeof computeAndStoreEmbedding
>;

describe('similarityService', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('findSimilarRisksForRisk', () => {
    const riskId = 'risk-1';
    const mockRisk = {
      id: riskId,
      title: 'Test Risk',
      threatDescription: 'Test threat',
      description: 'Test description',
      embedding: [0.1, 0.2, 0.3],
    };

    const createMockRisk = (overrides?: any) => ({
      id: `risk-${Date.now()}`,
      title: 'Other Risk',
      threatDescription: 'Other threat',
      description: 'Other description',
      embedding: [0.4, 0.5, 0.6],
      riskCategory: 'OPERATIONAL',
      calculatedScore: 50,
      ownerUserId: 'user-1',
      owner: {
        id: 'user-1',
        displayName: 'Test User',
        email: 'test@paythru.com',
      },
      assetCategory: null,
      asset: null,
      interestedParty: null,
      ...overrides,
    });

    it('should return empty array when risk is not found', async () => {
      // Arrange
      mockPrisma.risk.findUnique.mockResolvedValue(null);

      // Act
      const result = await findSimilarRisksForRisk(riskId);

      // Assert
      expect(result).toEqual([]);
      expect(mockPrisma.risk.findUnique).toHaveBeenCalledWith({
        where: { id: riskId },
        select: {
          id: true,
          title: true,
          threatDescription: true,
          description: true,
          embedding: true,
        },
      });
    });

    it('should compute and store embedding when risk has no embedding', async () => {
      // Arrange
      const riskWithoutEmbedding = {
        ...mockRisk,
        embedding: null,
      };
      const computedEmbedding = [0.7, 0.8, 0.9];
      mockPrisma.risk.findUnique.mockResolvedValue(riskWithoutEmbedding);
      mockPrisma.risk.findMany.mockResolvedValue([]);
      mockComputeAndStoreEmbedding.mockResolvedValue(computedEmbedding);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([]);

      // Act
      await findSimilarRisksForRisk(riskId);

      // Assert
      expect(mockComputeAndStoreEmbedding).toHaveBeenCalledWith(
        riskId,
        mockRisk.title,
        mockRisk.threatDescription,
        mockRisk.description,
      );
    });

    it('should use existing embedding when risk has embedding', async () => {
      // Arrange
      mockPrisma.risk.findUnique.mockResolvedValue(mockRisk);
      mockPrisma.risk.findMany.mockResolvedValue([]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([]);

      // Act
      await findSimilarRisksForRisk(riskId);

      // Assert
      expect(mockComputeAndStoreEmbedding).not.toHaveBeenCalled();
    });

    it('should return empty array when no other risks exist', async () => {
      // Arrange
      mockPrisma.risk.findUnique.mockResolvedValue(mockRisk);
      mockPrisma.risk.findMany.mockResolvedValue([]);

      // Act
      const result = await findSimilarRisksForRisk(riskId);

      // Assert
      expect(result).toEqual([]);
      expect(mockFindSimilarRisks).not.toHaveBeenCalled();
    });

    it('should find similar risks and filter by threshold', async () => {
      // Arrange
      const otherRisk1 = createMockRisk({ id: 'risk-2', title: 'Similar Risk' });
      const otherRisk2 = createMockRisk({ id: 'risk-3', title: 'Different Risk' });
      mockPrisma.risk.findUnique.mockResolvedValue(mockRisk);
      mockPrisma.risk.findMany.mockResolvedValue([otherRisk1, otherRisk2]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-2', score: 85, matchedFields: ['title'] },
        { riskId: 'risk-3', score: 50, matchedFields: [] }, // Below threshold
      ]);

      // Act
      const result = await findSimilarRisksForRisk(riskId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].risk.id).toBe('risk-2');
      expect(result[0].score).toBe(85);
      expect(result[0].fields).toEqual(['title']);
    });

    it('should respect limit parameter', async () => {
      // Arrange
      const otherRisks = Array.from({ length: 15 }, (_, i) =>
        createMockRisk({ id: `risk-${i + 2}` }),
      );
      mockPrisma.risk.findUnique.mockResolvedValue(mockRisk);
      mockPrisma.risk.findMany.mockResolvedValue(otherRisks);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue(
        otherRisks.map((r, i) => ({
          riskId: r.id,
          score: 80 - i,
          matchedFields: ['title'],
        })),
      );

      // Act
      const result = await findSimilarRisksForRisk(riskId, 5);

      // Assert
      expect(result).toHaveLength(5);
    });

    it('should transform AssetCategory to category for frontend compatibility', async () => {
      // Arrange
      const otherRisk = createMockRisk({
        id: 'risk-2',
        asset: {
          id: 'asset-1',
          nameSerialNo: 'Asset 1',
          model: 'Model 1',
          AssetCategory: {
            id: 'cat-1',
            name: 'Category 1',
          },
        },
      });
      mockPrisma.risk.findUnique.mockResolvedValue(mockRisk);
      mockPrisma.risk.findMany.mockResolvedValue([otherRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-2', score: 85, matchedFields: ['title'] },
      ]);

      // Act
      const result = await findSimilarRisksForRisk(riskId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].risk.asset).toBeDefined();
      expect(result[0].risk.asset?.category).toEqual({
        id: 'cat-1',
        name: 'Category 1',
      });
      expect(result[0].risk.asset).not.toHaveProperty('AssetCategory');
    });

    it('should handle risk with null asset', async () => {
      // Arrange
      const otherRisk = createMockRisk({
        id: 'risk-2',
        asset: null,
      });
      mockPrisma.risk.findUnique.mockResolvedValue(mockRisk);
      mockPrisma.risk.findMany.mockResolvedValue([otherRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-2', score: 85, matchedFields: ['title'] },
      ]);

      // Act
      const result = await findSimilarRisksForRisk(riskId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].risk.asset).toBeNull();
    });

    it('should exclude current risk from results', async () => {
      // Arrange
      mockPrisma.risk.findUnique.mockResolvedValue(mockRisk);
      mockPrisma.risk.findMany.mockResolvedValue([]);
      mockNormalizeRiskText.mockReturnValue('normalized text');

      // Act
      await findSimilarRisksForRisk(riskId);

      // Assert
      // Archived filter was removed to include archived risks in duplicate detection
      expect(mockPrisma.risk.findMany).toHaveBeenCalledWith({
        where: {
          id: { not: riskId },
        },
        select: expect.any(Object),
      });
    });

    it('should handle errors gracefully and return empty array', async () => {
      // Arrange
      mockPrisma.risk.findUnique.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await findSimilarRisksForRisk(riskId);

      // Assert
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error finding similar risks:',
        expect.any(Error),
      );
    });

    it('should filter out results where fullRisk is not found', async () => {
      // Arrange
      const otherRisk = createMockRisk({ id: 'risk-2' });
      mockPrisma.risk.findUnique.mockResolvedValue(mockRisk);
      mockPrisma.risk.findMany.mockResolvedValue([otherRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      // Return result for risk that doesn't exist in allRisks
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'non-existent-risk', score: 85, matchedFields: ['title'] },
        { riskId: 'risk-2', score: 80, matchedFields: ['title'] },
      ]);

      // Act
      const result = await findSimilarRisksForRisk(riskId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].risk.id).toBe('risk-2');
    });
  });

  describe('checkSimilarityForNewRisk', () => {
    const createMockRisk = (overrides?: any) => ({
      id: `risk-${Date.now()}`,
      title: 'Existing Risk',
      threatDescription: 'Existing threat',
      description: 'Existing description',
      embedding: [0.1, 0.2, 0.3],
      riskCategory: 'OPERATIONAL',
      calculatedScore: 50,
      ownerUserId: 'user-1',
      owner: {
        id: 'user-1',
        displayName: 'Test User',
        email: 'test@paythru.com',
      },
      assetCategory: null,
      asset: null,
      interestedParty: null,
      ...overrides,
    });

    it('should return empty array when title is too short', async () => {
      // Arrange
      const riskData = { title: 'AB' }; // Less than 3 characters

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toEqual([]);
      expect(mockPrisma.risk.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array when title is empty', async () => {
      // Arrange
      const riskData = { title: '' };

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toEqual([]);
      expect(mockPrisma.risk.findMany).not.toHaveBeenCalled();
    });

    it('should return exact title matches with score 95', async () => {
      // Arrange
      const riskData = { title: 'Exact Match Risk' };
      const existingRisk = createMockRisk({
        id: 'risk-1',
        title: 'Exact Match Risk',
      });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(95);
      expect(result[0].fields).toEqual(['title']);
      expect(result[0].risk.id).toBe('risk-1');
      expect(mockFindSimilarRisks).not.toHaveBeenCalled();
    });

    it('should respect limit for exact matches', async () => {
      // Arrange
      const riskData = { title: 'Exact Match Risk' };
      const existingRisks = Array.from({ length: 10 }, (_, i) =>
        createMockRisk({
          id: `risk-${i + 1}`,
          title: 'Exact Match Risk',
        }),
      );
      mockPrisma.risk.findMany.mockResolvedValue(existingRisks);

      // Act
      const result = await checkSimilarityForNewRisk(riskData, 3);

      // Assert
      expect(result).toHaveLength(3);
    });

    it('should use findSimilarRisks when no exact matches found', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      const existingRisk = createMockRisk({
        id: 'risk-1',
        title: 'Different Title',
      });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 85, matchedFields: ['title'] },
      ]);

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(mockFindSimilarRisks).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(85);
    });

    it('should filter results by similarity threshold', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      const existingRisk1 = createMockRisk({ id: 'risk-1' });
      const existingRisk2 = createMockRisk({ id: 'risk-2' });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk1, existingRisk2]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 85, matchedFields: ['title'] },
        { riskId: 'risk-2', score: 50, matchedFields: [] }, // Below threshold
      ]);

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].risk.id).toBe('risk-1');
    });

    it('should use chat fallback for borderline scores (65-85)', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title', threatDescription: 'Threat', description: 'Desc' };
      const existingRisk = createMockRisk({
        id: 'risk-1',
        title: 'Similar Risk',
        threatDescription: 'Similar threat',
        description: 'Similar desc',
      });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 75, matchedFields: ['title'] }, // Borderline
      ]);
      mockCalculateSimilarityScoreChat.mockResolvedValue({
        score: 88,
        matchedFields: ['title', 'threatDescription'],
      });

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(mockCalculateSimilarityScoreChat).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(88);
      expect(result[0].fields).toEqual(['title']); // Fields remain from original result, only score is updated
    });

    it('should handle chat fallback errors gracefully', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      const existingRisk = createMockRisk({ id: 'risk-1' });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 75, matchedFields: ['title'] },
      ]);
      mockCalculateSimilarityScoreChat.mockRejectedValue(new Error('Chat API error'));

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(75); // Original score kept
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Similarity] Chat fallback failed'),
        expect.any(String),
      );
    });

    it('should limit chat fallback calls to maxChatCalls (10)', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      const existingRisks = Array.from({ length: 15 }, (_, i) =>
        createMockRisk({ id: `risk-${i + 1}` }),
      );
      mockPrisma.risk.findMany.mockResolvedValue(existingRisks);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue(
        existingRisks.map((r) => ({
          riskId: r.id,
          score: 75, // All borderline
          matchedFields: ['title'],
        })),
      );
      mockCalculateSimilarityScoreChat.mockResolvedValue({
        score: 88,
        matchedFields: ['title'],
      });

      // Act
      const _result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(mockCalculateSimilarityScoreChat).toHaveBeenCalledTimes(10);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Similarity] Chat fallback cap reached'),
      );
    });

    it('should exclude risk when excludeId is provided', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title', excludeId: 'risk-1' };
      const existingRisk = createMockRisk({ id: 'risk-2' });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-2', score: 85, matchedFields: ['title'] },
      ]);

      // Act
      await checkSimilarityForNewRisk(riskData);

      // Assert
      // Archived filter was removed to include archived risks in duplicate detection
      expect(mockPrisma.risk.findMany).toHaveBeenCalledWith({
        where: {
          id: { not: 'risk-1' },
        },
        select: expect.any(Object),
        take: 100,
      });
    });

    it('should not exclude risk when excludeId is not provided', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      const existingRisk = createMockRisk({ id: 'risk-1' });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 85, matchedFields: ['title'] },
      ]);

      // Act
      await checkSimilarityForNewRisk(riskData);

      // Assert
      // Archived filter was removed to include archived risks in duplicate detection
      expect(mockPrisma.risk.findMany).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object),
        take: 100,
      });
    });

    it('should return empty array when no risks exist', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      mockPrisma.risk.findMany.mockResolvedValue([]);

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toEqual([]);
      expect(mockFindSimilarRisks).not.toHaveBeenCalled();
    });

    it('should respect limit parameter', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      const existingRisks = Array.from({ length: 10 }, (_, i) =>
        createMockRisk({ id: `risk-${i + 1}` }),
      );
      mockPrisma.risk.findMany.mockResolvedValue(existingRisks);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue(
        existingRisks.map((r) => ({
          riskId: r.id,
          score: 85,
          matchedFields: ['title'],
        })),
      );

      // Act
      const result = await checkSimilarityForNewRisk(riskData, 3);

      // Assert
      expect(result).toHaveLength(3);
    });

    it('should transform AssetCategory to category for exact matches', async () => {
      // Arrange
      const riskData = { title: 'Exact Match Risk' };
      const existingRisk = createMockRisk({
        id: 'risk-1',
        title: 'Exact Match Risk',
        asset: {
          id: 'asset-1',
          nameSerialNo: 'Asset 1',
          model: 'Model 1',
          AssetCategory: {
            id: 'cat-1',
            name: 'Category 1',
          },
        },
      });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].risk.asset?.category).toEqual({
        id: 'cat-1',
        name: 'Category 1',
      });
      expect(result[0].risk.asset).not.toHaveProperty('AssetCategory');
    });

    it('should transform AssetCategory to category for similarity matches', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      const existingRisk = createMockRisk({
        id: 'risk-1',
        asset: {
          id: 'asset-1',
          nameSerialNo: 'Asset 1',
          model: 'Model 1',
          AssetCategory: {
            id: 'cat-1',
            name: 'Category 1',
          },
        },
      });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 85, matchedFields: ['title'] },
      ]);

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].risk.asset?.category).toEqual({
        id: 'cat-1',
        name: 'Category 1',
      });
      expect(result[0].risk.asset).not.toHaveProperty('AssetCategory');
    });

    it('should handle risk with null asset', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      const existingRisk = createMockRisk({
        id: 'risk-1',
        asset: null,
      });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 85, matchedFields: ['title'] },
      ]);

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].risk.asset).toBeNull();
    });

    it('should sort results by score descending after chat fallback', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      const existingRisk1 = createMockRisk({ id: 'risk-1' });
      const existingRisk2 = createMockRisk({ id: 'risk-2' });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk1, existingRisk2]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 75, matchedFields: ['title'] }, // Borderline
        { riskId: 'risk-2', score: 90, matchedFields: ['title'] }, // Above borderline
      ]);
      mockCalculateSimilarityScoreChat.mockResolvedValue({
        score: 88,
        matchedFields: ['title'],
      });

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    });

    it('should handle errors gracefully and return empty array', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      mockPrisma.risk.findMany.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error checking similarity for new risk:',
        expect.any(Error),
      );
    });

    it('should filter out results where fullRisk is not found', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      const existingRisk = createMockRisk({ id: 'risk-1' });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      // Return result for risk that doesn't exist in allRisks
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'non-existent-risk', score: 85, matchedFields: ['title'] },
        { riskId: 'risk-1', score: 80, matchedFields: ['title'] },
      ]);

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].risk.id).toBe('risk-1');
    });

    it('should handle case-insensitive exact title matching', async () => {
      // Arrange
      const riskData = { title: 'Exact Match Risk' };
      const existingRisk = createMockRisk({
        id: 'risk-1',
        title: 'EXACT MATCH RISK', // Different case
      });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(95);
    });

    it('should handle exact matches with whitespace differences', async () => {
      // Arrange
      const riskData = { title: '  Exact Match Risk  ' };
      const existingRisk = createMockRisk({
        id: 'risk-1',
        title: 'Exact Match Risk',
      });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(95);
    });

    it('should not use chat fallback for scores below 65', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      const existingRisk = createMockRisk({ id: 'risk-1' });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 60, matchedFields: ['title'] }, // Below borderline
      ]);

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(mockCalculateSimilarityScoreChat).not.toHaveBeenCalled();
      expect(result).toHaveLength(0); // Below threshold
    });

    it('should not use chat fallback for scores above 85', async () => {
      // Arrange
      const riskData = { title: 'New Risk Title' };
      const existingRisk = createMockRisk({ id: 'risk-1' });
      mockPrisma.risk.findMany.mockResolvedValue([existingRisk]);
      mockNormalizeRiskText.mockReturnValue('normalized text');
      mockFindSimilarRisks.mockResolvedValue([
        { riskId: 'risk-1', score: 90, matchedFields: ['title'] }, // Above borderline
      ]);

      // Act
      const result = await checkSimilarityForNewRisk(riskData);

      // Assert
      expect(mockCalculateSimilarityScoreChat).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(90);
    });
  });
});

