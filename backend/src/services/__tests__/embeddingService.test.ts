/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  computeAndStoreEmbedding,
  backfillRiskEmbeddings,
  computeAndStoreControlEmbedding,
  backfillControlEmbeddings,
} from '../embeddingService';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    risk: {
      update: jest.fn(),
    },
    control: {
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

// Mock llmService
jest.mock('../llmService', () => ({
  generateEmbedding: jest.fn(),
  normalizeRiskText: jest.fn(),
}));

// Mock ConcurrencyLimiter
jest.mock('../../utils/concurrencyLimiter', () => ({
  ConcurrencyLimiter: jest.fn(),
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    llm: {
      maxEmbeddingTextLength: 1024,
    },
  },
}));

// Import mocked modules
import { prisma } from '../../lib/prisma';
import { generateEmbedding, normalizeRiskText } from '../llmService';
import { ConcurrencyLimiter } from '../../utils/concurrencyLimiter';

const mockPrisma = prisma as any;
const mockGenerateEmbedding = generateEmbedding as jest.MockedFunction<typeof generateEmbedding>;
const mockNormalizeRiskText = normalizeRiskText as jest.MockedFunction<typeof normalizeRiskText>;
const MockConcurrencyLimiter = ConcurrencyLimiter as jest.MockedClass<typeof ConcurrencyLimiter>;

describe('embeddingService', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console methods during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('computeAndStoreEmbedding', () => {
    const riskId = 'risk-123';
    const title = 'Test Risk';
    const threatDescription = 'Test threat';
    const description = 'Test description';
    const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
    const normalizedText = 'normalized text';

    it('should compute and store embedding successfully when embedding is generated', async () => {
      // Arrange
      mockNormalizeRiskText.mockReturnValue(normalizedText);
      mockGenerateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.risk.update.mockResolvedValue({ id: riskId, embedding: mockEmbedding });

      // Act
      const result = await computeAndStoreEmbedding(riskId, title, threatDescription, description);

      // Assert
      expect(mockNormalizeRiskText).toHaveBeenCalledWith(title, threatDescription, description);
      expect(mockGenerateEmbedding).toHaveBeenCalledWith(normalizedText);
      expect(mockPrisma.risk.update).toHaveBeenCalledWith({
        where: { id: riskId },
        data: { embedding: mockEmbedding },
      });
      expect(result).toEqual(mockEmbedding);
    });

    it('should return null when embedding generation fails', async () => {
      // Arrange
      mockNormalizeRiskText.mockReturnValue(normalizedText);
      mockGenerateEmbedding.mockResolvedValue(null);

      // Act
      const result = await computeAndStoreEmbedding(riskId, title, threatDescription, description);

      // Assert
      expect(mockGenerateEmbedding).toHaveBeenCalledWith(normalizedText);
      expect(mockPrisma.risk.update).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to generate embedding for risk ${riskId}`),
      );
      expect(result).toBeNull();
    });

    it('should handle null threatDescription and description', async () => {
      // Arrange
      mockNormalizeRiskText.mockReturnValue(normalizedText);
      mockGenerateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.risk.update.mockResolvedValue({ id: riskId, embedding: mockEmbedding });

      // Act
      const result = await computeAndStoreEmbedding(riskId, title, null, null);

      // Assert
      expect(mockNormalizeRiskText).toHaveBeenCalledWith(title, null, null);
      expect(result).toEqual(mockEmbedding);
    });

    it('should return null and log error when database update fails', async () => {
      // Arrange
      const dbError = new Error('Database error');
      mockNormalizeRiskText.mockReturnValue(normalizedText);
      mockGenerateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.risk.update.mockRejectedValue(dbError);

      // Act
      const result = await computeAndStoreEmbedding(riskId, title, threatDescription, description);

      // Assert
      expect(mockGenerateEmbedding).toHaveBeenCalledWith(normalizedText);
      expect(mockPrisma.risk.update).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Error computing/storing embedding for risk ${riskId}`),
        dbError.message,
      );
      expect(result).toBeNull();
    });

    it('should return null and log error when embedding generation throws', async () => {
      // Arrange
      const embeddingError = new Error('Embedding generation failed');
      mockNormalizeRiskText.mockReturnValue(normalizedText);
      mockGenerateEmbedding.mockRejectedValue(embeddingError);

      // Act
      const result = await computeAndStoreEmbedding(riskId, title, threatDescription, description);

      // Assert
      expect(mockGenerateEmbedding).toHaveBeenCalledWith(normalizedText);
      expect(mockPrisma.risk.update).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Error computing/storing embedding for risk ${riskId}`),
        embeddingError.message,
      );
      expect(result).toBeNull();
    });
  });

  describe('backfillRiskEmbeddings', () => {
    let mockLimiter: {
      execute: jest.Mock;
    };

    beforeEach(() => {
      mockLimiter = {
        execute: jest.fn(async (fn) => {
          return await fn();
        }),
      };
      MockConcurrencyLimiter.mockImplementation(() => mockLimiter as any);
    });

    it('should process risks in batches and return statistics', async () => {
      // Arrange
      const risks = [
        { id: 'risk-1', title: 'Risk 1', threatDescription: 'Threat 1', description: 'Desc 1' },
        { id: 'risk-2', title: 'Risk 2', threatDescription: 'Threat 2', description: 'Desc 2' },
      ];
      const mockEmbedding = [0.1, 0.2, 0.3];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(risks)
        .mockResolvedValueOnce([]);
      mockNormalizeRiskText.mockReturnValue('normalized');
      mockGenerateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.risk.update.mockResolvedValue({});

      // Act
      const result = await backfillRiskEmbeddings(2, 1, false);

      // Assert
      expect(result).toEqual({ processed: 2, succeeded: 2, failed: 0 });
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(mockLimiter.execute).toHaveBeenCalledTimes(2);
      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(2);
    });

    it('should handle dry run mode without storing embeddings', async () => {
      // Arrange
      const risks = [
        { id: 'risk-1', title: 'Risk 1', threatDescription: 'Threat 1', description: 'Desc 1' },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(risks)
        .mockResolvedValueOnce([]);

      // Act
      const result = await backfillRiskEmbeddings(2, 1, true);

      // Assert
      expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
      expect(mockPrisma.risk.update).not.toHaveBeenCalled();
    });

    it('should return zero statistics when no risks need backfilling', async () => {
      // Arrange
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      // Act
      const result = await backfillRiskEmbeddings(10, 2, false);

      // Assert
      expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
      expect(mockLimiter.execute).not.toHaveBeenCalled();
    });

    it('should handle multiple batches correctly', async () => {
      // Arrange
      const batch1 = [
        { id: 'risk-1', title: 'Risk 1', threatDescription: 'Threat 1', description: 'Desc 1' },
        { id: 'risk-2', title: 'Risk 2', threatDescription: 'Threat 2', description: 'Desc 2' },
      ];
      const batch2 = [
        { id: 'risk-3', title: 'Risk 3', threatDescription: 'Threat 3', description: 'Desc 3' },
      ];
      const mockEmbedding = [0.1, 0.2, 0.3];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);
      mockNormalizeRiskText.mockReturnValue('normalized');
      mockGenerateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.risk.update.mockResolvedValue({});

      // Act
      const result = await backfillRiskEmbeddings(2, 1, false);

      // Assert
      expect(result).toEqual({ processed: 3, succeeded: 3, failed: 0 });
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(3);
      expect(mockLimiter.execute).toHaveBeenCalledTimes(3);
    });

    it('should count failures when embedding generation fails', async () => {
      // Arrange
      const risks = [
        { id: 'risk-1', title: 'Risk 1', threatDescription: 'Threat 1', description: 'Desc 1' },
        { id: 'risk-2', title: 'Risk 2', threatDescription: 'Threat 2', description: 'Desc 2' },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(risks)
        .mockResolvedValueOnce([]);
      mockNormalizeRiskText.mockReturnValue('normalized');
      mockGenerateEmbedding
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce([0.1, 0.2, 0.3]);
      mockPrisma.risk.update.mockResolvedValue({});

      // Act
      const result = await backfillRiskEmbeddings(2, 1, false);

      // Assert
      expect(result).toEqual({ processed: 2, succeeded: 1, failed: 1 });
    });

    it('should handle errors during processing and continue', async () => {
      // Arrange
      const risks = [
        { id: 'risk-1', title: 'Risk 1', threatDescription: 'Threat 1', description: 'Desc 1' },
        { id: 'risk-2', title: 'Risk 2', threatDescription: 'Threat 2', description: 'Desc 2' },
      ];
      const processingError = new Error('Processing error');

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(risks)
        .mockResolvedValueOnce([]);
      mockNormalizeRiskText.mockReturnValue('normalized');
      mockGenerateEmbedding
        .mockRejectedValueOnce(processingError)
        .mockResolvedValueOnce([0.1, 0.2, 0.3]);
      mockPrisma.risk.update.mockResolvedValue({});

      // Act
      const result = await backfillRiskEmbeddings(2, 1, false);

      // Assert
      expect(result).toEqual({ processed: 2, succeeded: 1, failed: 1 });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error computing/storing embedding for risk risk-1'),
        processingError.message,
      );
    });

    it('should use correct batch size and offset in queries', async () => {
      // Arrange
      const risks = [{ id: 'risk-1', title: 'Risk 1', threatDescription: 'Threat 1', description: 'Desc 1' }];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(risks)
        .mockResolvedValueOnce([]);
      mockNormalizeRiskText.mockReturnValue('normalized');
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockPrisma.risk.update.mockResolvedValue({});

      // Act
      await backfillRiskEmbeddings(5, 2, false);

      // Assert
      // $queryRaw is called with template string array, check first call
      const firstCall = mockPrisma.$queryRaw.mock.calls[0];
      expect(firstCall[0]).toEqual(expect.arrayContaining([expect.stringContaining('LIMIT')]));
      expect(firstCall[1]).toBe(5); // batchSize
      expect(firstCall[2]).toBe(0); // offset
    });

    it('should respect concurrency limit', async () => {
      // Arrange
      const risks = [
        { id: 'risk-1', title: 'Risk 1', threatDescription: 'Threat 1', description: 'Desc 1' },
        { id: 'risk-2', title: 'Risk 2', threatDescription: 'Threat 2', description: 'Desc 2' },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(risks)
        .mockResolvedValueOnce([]);
      mockNormalizeRiskText.mockReturnValue('normalized');
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockPrisma.risk.update.mockResolvedValue({});

      // Act
      await backfillRiskEmbeddings(2, 3, false);

      // Assert
      expect(MockConcurrencyLimiter).toHaveBeenCalledWith(3);
    });

  });

  describe('computeAndStoreControlEmbedding', () => {
    const controlId = 'control-123';
    const code = 'A.8.3';
    const title = 'Test Control';
    const description = 'Test description';
    const purpose = 'Test purpose';
    const guidance = 'Test guidance';
    const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

    it('should compute and store embedding successfully when embedding is generated', async () => {
      // Arrange
      mockGenerateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.control.update.mockResolvedValue({ id: controlId, embedding: mockEmbedding });

      // Act
      const result = await computeAndStoreControlEmbedding(
        controlId,
        code,
        title,
        description,
        purpose,
        guidance,
      );

      // Assert
      expect(mockGenerateEmbedding).toHaveBeenCalled();
      expect(mockPrisma.control.update).toHaveBeenCalledWith({
        where: { id: controlId },
        data: { embedding: mockEmbedding },
      });
      expect(result).toEqual(mockEmbedding);
    });

    it('should return null when embedding generation fails', async () => {
      // Arrange
      mockGenerateEmbedding.mockResolvedValue(null);

      // Act
      const result = await computeAndStoreControlEmbedding(
        controlId,
        code,
        title,
        description,
        purpose,
        guidance,
      );

      // Assert
      expect(mockGenerateEmbedding).toHaveBeenCalled();
      expect(mockPrisma.control.update).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to generate embedding for control ${controlId}`),
      );
      expect(result).toBeNull();
    });

    it('should handle null optional fields', async () => {
      // Arrange
      mockGenerateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.control.update.mockResolvedValue({ id: controlId, embedding: mockEmbedding });

      // Act
      const result = await computeAndStoreControlEmbedding(
        controlId,
        code,
        title,
        null,
        null,
        null,
      );

      // Assert
      expect(mockGenerateEmbedding).toHaveBeenCalled();
      expect(result).toEqual(mockEmbedding);
    });

    it('should return null and log error when database update fails', async () => {
      // Arrange
      const dbError = new Error('Database error');
      mockGenerateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.control.update.mockRejectedValue(dbError);

      // Act
      const result = await computeAndStoreControlEmbedding(
        controlId,
        code,
        title,
        description,
        purpose,
        guidance,
      );

      // Assert
      expect(mockGenerateEmbedding).toHaveBeenCalled();
      expect(mockPrisma.control.update).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Error computing/storing embedding for control ${controlId}`),
        dbError.message,
      );
      expect(result).toBeNull();
    });

    it('should return null and log error when embedding generation throws', async () => {
      // Arrange
      const embeddingError = new Error('Embedding generation failed');
      mockGenerateEmbedding.mockRejectedValue(embeddingError);

      // Act
      const result = await computeAndStoreControlEmbedding(
        controlId,
        code,
        title,
        description,
        purpose,
        guidance,
      );

      // Assert
      expect(mockGenerateEmbedding).toHaveBeenCalled();
      expect(mockPrisma.control.update).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Error computing/storing embedding for control ${controlId}`),
        embeddingError.message,
      );
      expect(result).toBeNull();
    });
  });

  describe('backfillControlEmbeddings', () => {
    let mockLimiter: {
      execute: jest.Mock;
    };

    beforeEach(() => {
      mockLimiter = {
        execute: jest.fn(async (fn) => {
          return await fn();
        }),
      };
      MockConcurrencyLimiter.mockImplementation(() => mockLimiter as any);
    });

    it('should process controls in batches using cursor-based pagination', async () => {
      // Arrange
      const controls = [
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Control 1',
          description: 'Desc 1',
          purpose: 'Purpose 1',
          guidance: 'Guidance 1',
        },
        {
          id: 'control-2',
          code: 'A.8.4',
          title: 'Control 2',
          description: 'Desc 2',
          purpose: 'Purpose 2',
          guidance: 'Guidance 2',
        },
      ];
      const mockEmbedding = [0.1, 0.2, 0.3];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(controls)
        .mockResolvedValueOnce([]);
      mockGenerateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.control.update.mockResolvedValue({});

      // Act
      const result = await backfillControlEmbeddings(2, 1, false);

      // Assert
      expect(result).toEqual({ processed: 2, succeeded: 2, failed: 0 });
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(mockLimiter.execute).toHaveBeenCalledTimes(2);
      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(2);
    });

    it('should use cursor-based pagination with lastId', async () => {
      // Arrange
      const batch1 = [
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Control 1',
          description: 'Desc 1',
          purpose: 'Purpose 1',
          guidance: 'Guidance 1',
        },
      ];
      const batch2 = [
        {
          id: 'control-2',
          code: 'A.8.4',
          title: 'Control 2',
          description: 'Desc 2',
          purpose: 'Purpose 2',
          guidance: 'Guidance 2',
        },
      ];
      const mockEmbedding = [0.1, 0.2, 0.3];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);
      mockGenerateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.control.update.mockResolvedValue({});

      // Act
      const result = await backfillControlEmbeddings(1, 1, false);

      // Assert
      expect(result).toEqual({ processed: 2, succeeded: 2, failed: 0 });
      // First call should not have WHERE id > condition
      const firstCall = mockPrisma.$queryRaw.mock.calls[0];
      expect(firstCall[0]).toEqual(expect.arrayContaining([expect.stringContaining('WHERE embedding IS NULL')]));
      expect(firstCall[0]).not.toEqual(expect.arrayContaining([expect.stringContaining('id >')]));
      // Second call should have WHERE id > control-1 (lastId from first batch)
      const secondCall = mockPrisma.$queryRaw.mock.calls[1];
      expect(secondCall[0]).toEqual(expect.arrayContaining([expect.stringContaining('WHERE embedding IS NULL AND id >')]));
      // The lastId should be the last control ID from the first batch
      expect(secondCall[1]).toBe('control-1'); // lastId from first batch (batch1 has only one item)
    });

    it('should handle dry run mode without storing embeddings', async () => {
      // Arrange
      const controls = [
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Control 1',
          description: 'Desc 1',
          purpose: 'Purpose 1',
          guidance: 'Guidance 1',
        },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(controls)
        .mockResolvedValueOnce([]);

      // Act
      const result = await backfillControlEmbeddings(2, 1, true);

      // Assert
      expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
      expect(mockPrisma.control.update).not.toHaveBeenCalled();
    });

    it('should return zero statistics when no controls need backfilling', async () => {
      // Arrange
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      // Act
      const result = await backfillControlEmbeddings(10, 2, false);

      // Assert
      expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
      expect(mockLimiter.execute).not.toHaveBeenCalled();
    });

    it('should handle multiple batches correctly', async () => {
      // Arrange
      const batch1 = [
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Control 1',
          description: 'Desc 1',
          purpose: 'Purpose 1',
          guidance: 'Guidance 1',
        },
        {
          id: 'control-2',
          code: 'A.8.4',
          title: 'Control 2',
          description: 'Desc 2',
          purpose: 'Purpose 2',
          guidance: 'Guidance 2',
        },
      ];
      const batch2 = [
        {
          id: 'control-3',
          code: 'A.8.5',
          title: 'Control 3',
          description: 'Desc 3',
          purpose: 'Purpose 3',
          guidance: 'Guidance 3',
        },
      ];
      const mockEmbedding = [0.1, 0.2, 0.3];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);
      mockGenerateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.control.update.mockResolvedValue({});

      // Act
      const result = await backfillControlEmbeddings(2, 1, false);

      // Assert
      expect(result).toEqual({ processed: 3, succeeded: 3, failed: 0 });
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(3);
      expect(mockLimiter.execute).toHaveBeenCalledTimes(3);
    });

    it('should count failures when embedding generation fails', async () => {
      // Arrange
      const controls = [
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Control 1',
          description: 'Desc 1',
          purpose: 'Purpose 1',
          guidance: 'Guidance 1',
        },
        {
          id: 'control-2',
          code: 'A.8.4',
          title: 'Control 2',
          description: 'Desc 2',
          purpose: 'Purpose 2',
          guidance: 'Guidance 2',
        },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(controls)
        .mockResolvedValueOnce([]);
      mockGenerateEmbedding
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce([0.1, 0.2, 0.3]);
      mockPrisma.control.update.mockResolvedValue({});

      // Act
      const result = await backfillControlEmbeddings(2, 1, false);

      // Assert
      expect(result).toEqual({ processed: 2, succeeded: 1, failed: 1 });
    });

    it('should handle errors during processing and continue', async () => {
      // Arrange
      const controls = [
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Control 1',
          description: 'Desc 1',
          purpose: 'Purpose 1',
          guidance: 'Guidance 1',
        },
        {
          id: 'control-2',
          code: 'A.8.4',
          title: 'Control 2',
          description: 'Desc 2',
          purpose: 'Purpose 2',
          guidance: 'Guidance 2',
        },
      ];
      const processingError = new Error('Processing error');

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(controls)
        .mockResolvedValueOnce([]);
      mockGenerateEmbedding
        .mockRejectedValueOnce(processingError)
        .mockResolvedValueOnce([0.1, 0.2, 0.3]);
      mockPrisma.control.update.mockResolvedValue({});

      // Act
      const result = await backfillControlEmbeddings(2, 1, false);

      // Assert
      expect(result).toEqual({ processed: 2, succeeded: 1, failed: 1 });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error computing/storing embedding for control control-1'),
        processingError.message,
      );
    });

    it('should respect concurrency limit', async () => {
      // Arrange
      const controls = [
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Control 1',
          description: 'Desc 1',
          purpose: 'Purpose 1',
          guidance: 'Guidance 1',
        },
        {
          id: 'control-2',
          code: 'A.8.4',
          title: 'Control 2',
          description: 'Desc 2',
          purpose: 'Purpose 2',
          guidance: 'Guidance 2',
        },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(controls)
        .mockResolvedValueOnce([]);
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockPrisma.control.update.mockResolvedValue({});

      // Act
      await backfillControlEmbeddings(2, 3, false);

      // Assert
      expect(MockConcurrencyLimiter).toHaveBeenCalledWith(3);
    });

    it('should use correct batch size in queries', async () => {
      // Arrange
      const controls = [
        {
          id: 'control-1',
          code: 'A.8.3',
          title: 'Control 1',
          description: 'Desc 1',
          purpose: 'Purpose 1',
          guidance: 'Guidance 1',
        },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(controls)
        .mockResolvedValueOnce([]);
      mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockPrisma.control.update.mockResolvedValue({});

      // Act
      await backfillControlEmbeddings(5, 2, false);

      // Assert
      // $queryRaw is called with template string array, check first call
      const firstCall = mockPrisma.$queryRaw.mock.calls[0];
      expect(firstCall[0]).toEqual(expect.arrayContaining([expect.stringContaining('LIMIT')]));
      expect(firstCall[1]).toBe(5); // batchSize
    });


    it('should truncate control text when it exceeds max length', async () => {
      // Arrange
      const controlId = 'control-123';
      const code = 'A.8.3';
      const title = 'Test Control';
      // Create text that exceeds maxEmbeddingTextLength (1024)
      const longText = 'x'.repeat(2000);
      const mockEmbedding = [0.1, 0.2, 0.3];

      mockGenerateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.control.update.mockResolvedValue({ id: controlId, embedding: mockEmbedding });

      // Act
      const result = await computeAndStoreControlEmbedding(
        controlId,
        code,
        title,
        longText, // description
        longText, // purpose
        longText, // guidance
      );

      // Assert
      expect(mockGenerateEmbedding).toHaveBeenCalled();
      // The text should be truncated to maxEmbeddingTextLength (1024)
      const callArg = mockGenerateEmbedding.mock.calls[0][0];
      expect(callArg.length).toBeLessThanOrEqual(1024);
      expect(result).toEqual(mockEmbedding);
    });
  });
});

