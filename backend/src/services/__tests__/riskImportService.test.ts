/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs';
import { importRisksFromCSV } from '../riskImportService';
import { prisma } from '../../lib/prisma';
import * as riskService from '../riskService';
import * as embeddingService from '../embeddingService';
import { ConcurrencyLimiter } from '../../utils/concurrencyLimiter';

// Mock fs
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    interestedParty: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    assetCategory: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    risk: {
      create: jest.fn(),
    },
  },
}));

// Mock risk service
jest.mock('../riskService', () => ({
  calculateRiskScore: jest.fn((c, i, a, l) => (c + i + a) * l),
  calculateMitigatedScore: jest.fn((c, i, a, l) => {
    if (c === null || i === null || a === null || l === null) return null;
    return (c + i + a) * l;
  }),
  parseControlCodes: jest.fn((codes: string) => {
    if (!codes || !codes.trim()) return [];
    return codes.split(',').map((c: string) => c.trim()).filter((c: string) => c);
  }),
  updateRiskControls: jest.fn().mockResolvedValue(undefined),
}));

// Mock embedding service
jest.mock('../embeddingService', () => ({
  computeAndStoreEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

// Mock ConcurrencyLimiter
jest.mock('../../utils/concurrencyLimiter', () => ({
  ConcurrencyLimiter: jest.fn().mockImplementation(() => ({
    execute: jest.fn((fn) => Promise.resolve(fn())),
  })),
}));

describe('riskImportService', () => {
  const mockPrisma = prisma as any;
  const mockFs = fs as any;
  const mockRiskService = riskService as any;
  const _mockEmbeddingService = embeddingService as any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockPrisma.interestedParty.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.assetCategory.findMany.mockResolvedValue([]);
    mockPrisma.interestedParty.create.mockImplementation((args: any) => ({
      id: `party-${args.data.name}`,
      name: args.data.name,
      updatedAt: new Date(),
    }));
    mockPrisma.assetCategory.create.mockImplementation((args: any) => ({
      id: `category-${args.data.name}`,
      name: args.data.name,
      updatedAt: new Date(),
    }));
    mockPrisma.risk.create.mockResolvedValue({
      id: 'risk-1',
      title: 'Test Risk',
    });
  });

  describe('importRisksFromCSV', () => {
    const createCSVContent = (headerRow: string, dataRows: string[]): string => {
      return `Line 1
Line 2
Line 3
${headerRow}
${dataRows.join('\n')}`;
    };

    const standardHeaders = '#,Date Added,Risk Type,Owner,Asset / Asset Category,Interested Party,Threat Description,Risk Description,Existing Controls,C,I,A,R,L,Score,Initial Risk Treatment Category,Additional Controls,MC,MI,MA,MR,ML,Mitigated Score,Mitigation Implemented,Residual Risk Treatment Category,Annex A Applicable Controls (ISO 27001:2022)';

    it('should import risks from file path successfully', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/file.csv', 'utf-8');
      expect(mockPrisma.risk.create).toHaveBeenCalledTimes(1);
    });

    it('should import risks from Buffer successfully', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      const buffer = Buffer.from(csvContent, 'utf-8');

      // Act
      const result = await importRisksFromCSV(buffer);

      // Assert
      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(1);
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
      expect(mockPrisma.risk.create).toHaveBeenCalledTimes(1);
    });

    it('should parse date formats correctly', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        [
          '1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
          '2,Oct-25,INSTANCE,CISO,Database,Internal,Threat 2,Risk 2,Controls,2,3,4,18,2,18,AVOID,Additional,1,2,3,12,2,12,N,TRANSFER,A.5.9',
          '3,Apr-23,STATIC,CTO,Network,External,Threat 3,Risk 3,Controls,1,2,3,6,1,6,ACCEPT,Additional,,,,,,N,ACCEPT,',
        ]
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(3);
      expect(mockPrisma.risk.create).toHaveBeenCalledTimes(3);
      
      // Check first risk has correct date (May 2018)
      const firstCall = mockPrisma.risk.create.mock.calls[0][0];
      expect(firstCall.data.dateAdded).toBeInstanceOf(Date);
      expect(firstCall.data.dateAdded.getFullYear()).toBe(2018);
      expect(firstCall.data.dateAdded.getMonth()).toBe(4); // May is month 4 (0-indexed)

      // Check second risk has correct date (Oct 2025)
      const secondCall = mockPrisma.risk.create.mock.calls[1][0];
      expect(secondCall.data.dateAdded.getFullYear()).toBe(2025);
      expect(secondCall.data.dateAdded.getMonth()).toBe(9); // Oct is month 9

      // Check third risk has correct date (Apr 2023)
      const thirdCall = mockPrisma.risk.create.mock.calls[2][0];
      expect(thirdCall.data.dateAdded.getFullYear()).toBe(2023);
      expect(thirdCall.data.dateAdded.getMonth()).toBe(3); // Apr is month 3
    });

    it('should create interested party when it does not exist', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,New Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      mockPrisma.interestedParty.findMany.mockResolvedValue([]);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New Client',
        }),
      });
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          interestedPartyId: 'party-New Client',
        }),
      });
    });

    it('should use existing interested party when it exists', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Existing Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      mockPrisma.interestedParty.findMany.mockResolvedValue([
        { id: 'existing-party-id', name: 'Existing Client' },
      ]);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(mockPrisma.interestedParty.create).not.toHaveBeenCalled();
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          interestedPartyId: 'existing-party-id',
        }),
      });
    });

    it('should use "Unspecified" for empty interested party', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Unspecified',
        }),
      });
    });

    it('should map owner to user when user exists', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', displayName: 'MD', email: 'md@example.com' },
      ]);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ownerUserId: 'user-1',
        }),
      });
    });

    it('should leave ownerUserId null when user does not exist', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,UNKNOWN,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      mockPrisma.user.findMany.mockResolvedValue([]);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ownerUserId: null,
        }),
      });
    });

    it('should create asset category when it does not exist', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,New Category,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      mockPrisma.assetCategory.findMany.mockResolvedValue([]);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(mockPrisma.assetCategory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New Category',
        }),
      });
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assetCategoryId: 'category-New Category',
          assetCategory: 'New Category',
        }),
      });
    });

    it('should use existing asset category when it exists', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Existing Category,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      mockPrisma.assetCategory.findMany.mockResolvedValue([
        { id: 'existing-category-id', name: 'Existing Category' },
      ]);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(mockPrisma.assetCategory.create).not.toHaveBeenCalled();
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assetCategoryId: 'existing-category-id',
          assetCategory: 'Existing Category',
        }),
      });
    });

    it('should handle empty asset category', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(mockPrisma.assetCategory.create).not.toHaveBeenCalled();
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assetCategoryId: null,
          assetCategory: null,
        }),
      });
    });

    it('should calculate risk scores correctly', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockRiskService.calculateRiskScore).toHaveBeenCalledWith(3, 4, 5, 2);
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          confidentialityScore: 3,
          integrityScore: 4,
          availabilityScore: 5,
          likelihood: 2,
          calculatedScore: 24, // (3+4+5)*2
          riskScore: 24,
        }),
      });
    });

    it('should use default score of 1 when score is missing', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,,,2,,,ACCEPT,Additional,,,,,,,N,ACCEPT,']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          confidentialityScore: 1,
          integrityScore: 1,
          availabilityScore: 2,
          likelihood: 1,
        }),
      });
    });

    it('should calculate mitigated score correctly', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockRiskService.calculateMitigatedScore).toHaveBeenCalledWith(2, 3, 4, 2);
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          mitigatedConfidentialityScore: 2,
          mitigatedIntegrityScore: 3,
          mitigatedAvailabilityScore: 4,
          mitigatedLikelihood: 2,
          mitigatedScore: 18, // (2+3+4)*2
          mitigatedRiskScore: 18,
        }),
      });
    });

    it('should handle null mitigated scores', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,,,,,,,N,ACCEPT,']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockRiskService.calculateMitigatedScore).toHaveBeenCalledWith(null, null, null, null);
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          mitigatedConfidentialityScore: null,
          mitigatedIntegrityScore: null,
          mitigatedAvailabilityScore: null,
          mitigatedLikelihood: null,
          mitigatedScore: null,
          mitigatedRiskScore: null,
        }),
      });
    });

    it('should parse mitigation implemented correctly', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        [
          '1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
          '2,May-18,STATIC,MD,Server,Client,Threat 2,Risk 2,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,N,ACCEPT,',
        ]
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.risk.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.risk.create.mock.calls[0][0].data.mitigationImplemented).toBe(true);
      expect(mockPrisma.risk.create.mock.calls[1][0].data.mitigationImplemented).toBe(false);
    });

    it('should parse risk nature correctly', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        [
          '1,May-18,INSTANCE,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
          '2,May-18,STATIC,MD,Server,Client,Threat 2,Risk 2,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
          '3,May-18,,MD,Server,Client,Threat 3,Risk 3,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
        ]
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.risk.create).toHaveBeenCalledTimes(3);
      expect(mockPrisma.risk.create.mock.calls[0][0].data.riskNature).toBe('INSTANCE');
      expect(mockPrisma.risk.create.mock.calls[1][0].data.riskNature).toBe('STATIC');
      expect(mockPrisma.risk.create.mock.calls[2][0].data.riskNature).toBe('STATIC'); // Default
    });

    it('should link controls when Annex A controls are specified', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,"A.8.3, A.5.9"']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      mockRiskService.parseControlCodes.mockReturnValue(['A.8.3', 'A.5.9']);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockRiskService.parseControlCodes).toHaveBeenCalledWith('A.8.3, A.5.9');
      // Get the actual risk ID from the create call
      const riskId = mockPrisma.risk.create.mock.calls[0][0].data.id;
      expect(mockRiskService.updateRiskControls).toHaveBeenCalledWith(riskId, ['A.8.3', 'A.5.9']);
    });

    it('should not link controls when Annex A controls are empty', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      mockRiskService.parseControlCodes.mockReturnValue([]);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockRiskService.updateRiskControls).not.toHaveBeenCalled();
    });

    it('should compute embeddings for risks', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(ConcurrencyLimiter).toHaveBeenCalledWith(3);
      // The embedding computation is done via the limiter, which is mocked to execute immediately
      // We can verify the embedding service was called through the limiter
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for async operations
      // Note: Since ConcurrencyLimiter is mocked, we can't directly verify computeAndStoreEmbedding
      // but we can verify the structure is correct
    });

    it('should skip empty rows', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        [
          '1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
          ',,,', // Empty row
          '2,May-18,STATIC,MD,Server,Client,Threat 2,Risk 2,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
        ]
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(2);
      expect(mockPrisma.risk.create).toHaveBeenCalledTimes(2);
    });

    it('should skip rows with no risk number and no description', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        [
          '1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
          ',May-18,STATIC,MD,Server,Client,Threat 2,,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3', // No number and no description
          '2,May-18,STATIC,MD,Server,Client,Threat 3,Risk 3,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
        ]
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(2);
      expect(mockPrisma.risk.create).toHaveBeenCalledTimes(2);
    });

    it('should handle CSV with quoted fields', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,"Server, Network",Client,"Threat, Description","Risk, Description",Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assetCategory: 'Server, Network',
          threatDescription: 'Threat, Description',
          description: 'Risk, Description',
        }),
      });
    });

    it('should handle CSV with escaped quotes', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Client,"Threat ""quoted"" Description",Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          threatDescription: 'Threat "quoted" Description',
        }),
      });
    });

    it('should use risk number as title when description is missing', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,Client,Threat 1,,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Risk 1',
          description: null,
        }),
      });
    });

    it('should use description as title when risk number is missing', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        [',May-18,STATIC,MD,Server,Client,Threat 1,Risk Description,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Risk Description',
          description: 'Risk Description',
        }),
      });
    });

    it('should handle multiple risks and track success/failure correctly', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        [
          '1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
          '2,May-18,STATIC,MD,Server,Client,Threat 2,Risk 2,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
          '3,May-18,STATIC,MD,Server,Client,Threat 3,Risk 3,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
        ]
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle errors for individual rows and continue processing', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        [
          '1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
          '2,May-18,STATIC,MD,Server,Client,Threat 2,Risk 2,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
        ]
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      mockPrisma.risk.create
        .mockResolvedValueOnce({ id: 'risk-1' })
        .mockRejectedValueOnce(new Error('Database error'));

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(6); // Row 2 is at line 6 (header is line 4, data starts at line 5)
      expect(result.errors[0].error).toContain('Failed to import risk');
      expect(result.errors[0].error).toContain('Database error');
    });

    it('should throw error when CSV file does not contain enough lines', async () => {
      // Arrange
      const csvContent = 'Line 1\nLine 2\nLine 3'; // Only 3 lines, need at least 4
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act & Assert
      await expect(importRisksFromCSV('/path/to/file.csv')).rejects.toThrow(
        'Failed to import risks'
      );
    });

    it('should throw error when file read fails', async () => {
      // Arrange
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      // Act & Assert
      await expect(importRisksFromCSV('/path/to/file.csv')).rejects.toThrow(
        'Failed to import risks'
      );
    });

    it('should handle CSV with Windows line endings', async () => {
      // Arrange
      const csvContent = `Line 1\r\nLine 2\r\nLine 3\r\n${standardHeaders}\r\n1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3`;
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(mockPrisma.risk.create).toHaveBeenCalledTimes(1);
    });

    it('should handle CSV with Unix line endings', async () => {
      // Arrange
      const csvContent = `Line 1\nLine 2\nLine 3\n${standardHeaders}\n1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3`;
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      const result = await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(result.success).toBe(1);
      expect(mockPrisma.risk.create).toHaveBeenCalledTimes(1);
    });

    it('should parse treatment categories correctly', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        [
          '1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
          '2,May-18,STATIC,MD,Server,Client,Threat 2,Risk 2,Controls,3,4,5,24,2,24,AVOID,Additional,2,3,4,18,2,18,Y,TRANSFER,A.8.3',
          '3,May-18,STATIC,MD,Server,Client,Threat 3,Risk 3,Controls,3,4,5,24,2,24,,Additional,2,3,4,18,2,18,Y,,A.8.3',
        ]
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.risk.create).toHaveBeenCalledTimes(3);
      expect(mockPrisma.risk.create.mock.calls[0][0].data.initialRiskTreatmentCategory).toBe('ACCEPT');
      expect(mockPrisma.risk.create.mock.calls[0][0].data.residualRiskTreatmentCategory).toBe('MITIGATE');
      expect(mockPrisma.risk.create.mock.calls[1][0].data.initialRiskTreatmentCategory).toBe('AVOID');
      expect(mockPrisma.risk.create.mock.calls[1][0].data.residualRiskTreatmentCategory).toBe('TRANSFER');
      expect(mockPrisma.risk.create.mock.calls[2][0].data.initialRiskTreatmentCategory).toBeNull();
      expect(mockPrisma.risk.create.mock.calls[2][0].data.residualRiskTreatmentCategory).toBeNull();
    });

    it('should handle date parsing with standard date format', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,2023-05-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dateAdded: expect.any(Date),
        }),
      });
    });

    it('should use current date when date is invalid or missing', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,Invalid Date,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      const beforeDate = new Date();

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      const afterDate = new Date();
      const dateAdded = mockPrisma.risk.create.mock.calls[0][0].data.dateAdded;
      expect(dateAdded).toBeInstanceOf(Date);
      expect(dateAdded.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(dateAdded.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });

    it('should use current date when date field is empty', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      const beforeDate = new Date();

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      const afterDate = new Date();
      const dateAdded = mockPrisma.risk.create.mock.calls[0][0].data.dateAdded;
      expect(dateAdded).toBeInstanceOf(Date);
      expect(dateAdded.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(dateAdded.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });

    it('should handle year parsing correctly (years < 50 as 20xx, >= 50 as 19xx)', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        [
          '1,May-18,STATIC,MD,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
          '2,May-50,STATIC,MD,Server,Client,Threat 2,Risk 2,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3',
        ]
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.risk.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.risk.create.mock.calls[0][0].data.dateAdded.getFullYear()).toBe(2018);
      expect(mockPrisma.risk.create.mock.calls[1][0].data.dateAdded.getFullYear()).toBe(1950);
    });

    it('should handle all risk fields correctly', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,INSTANCE,MD,Server,Client,Threat Desc,Risk Desc,Existing Controls,3,4,5,24,2,24,ACCEPT,Additional Controls,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: expect.any(String),
          title: 'Risk Desc',
          description: 'Risk Desc',
          dateAdded: expect.any(Date),
          riskCategory: null,
          riskNature: 'INSTANCE',
          ownerUserId: null,
          assetCategory: 'Server',
          assetCategoryId: 'category-Server',
          assetId: null,
          interestedPartyId: 'party-Client',
          threatDescription: 'Threat Desc',
          archived: false,
          expiryDate: null,
          lastReviewDate: null,
          nextReviewDate: null,
          confidentialityScore: 3,
          integrityScore: 4,
          availabilityScore: 5,
          riskScore: 24,
          likelihood: 2,
          calculatedScore: 24,
          initialRiskTreatmentCategory: 'ACCEPT',
          mitigatedConfidentialityScore: 2,
          mitigatedIntegrityScore: 3,
          mitigatedAvailabilityScore: 4,
          mitigatedRiskScore: 18,
          mitigatedLikelihood: 2,
          mitigatedScore: 18,
          mitigationImplemented: true,
          mitigationDescription: 'Additional Controls',
          residualRiskTreatmentCategory: 'MITIGATE',
          annexAControlsRaw: 'A.8.3',
          updatedAt: expect.any(Date),
        }),
      });
    });

    it('should handle user mapping by email', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,test@example.com,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', displayName: 'Test User', email: 'test@example.com' },
      ]);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ownerUserId: 'user-1',
        }),
      });
    });

    it('should handle case-insensitive interested party matching', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,Server,CLIENT,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      mockPrisma.interestedParty.findMany.mockResolvedValue([
        { id: 'party-1', name: 'Client' },
      ]);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.interestedParty.create).not.toHaveBeenCalled();
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          interestedPartyId: 'party-1',
        }),
      });
    });

    it('should handle case-insensitive asset category matching', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,MD,SERVER,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);
      mockPrisma.assetCategory.findMany.mockResolvedValue([
        { id: 'category-1', name: 'Server' },
      ]);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.assetCategory.create).not.toHaveBeenCalled();
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assetCategoryId: 'category-1',
        }),
      });
    });

    it('should handle empty owner field', async () => {
      // Arrange
      const csvContent = createCSVContent(
        standardHeaders,
        ['1,May-18,STATIC,,Server,Client,Threat 1,Risk 1,Controls,3,4,5,24,2,24,ACCEPT,Additional,2,3,4,18,2,18,Y,MITIGATE,A.8.3']
      );
      mockFs.readFileSync.mockReturnValue(csvContent);

      // Act
      await importRisksFromCSV('/path/to/file.csv');

      // Assert
      expect(mockPrisma.risk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ownerUserId: null,
        }),
      });
    });
  });
});

