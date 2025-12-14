/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs';
import { importLegislationFromCSV } from '../legislationImportService';
import { prisma } from '../../lib/prisma';

// Mock fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    legislation: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    risk: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-123'),
}));

describe('legislationImportService', () => {
  let mockPrisma: any;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = prisma as any;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('importLegislationFromCSV', () => {
    const validCSVContent = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,GDPR,General Data Protection Regulation,High,Encryption and access controls,risk-1
02/01/2023,Party B,ISO 27001,Information Security Management,Medium,Documentation and controls,risk-3`;

    const validCSVWithQuotes = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,"Party A","GDPR, EU Regulation","Description with, comma",High,"How compliance, with comma",risk-1`;

    const validCSVWithEscapedQuotes = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,"GDPR ""EU"" Regulation",Description,High,How compliance,risk-1`;

    describe('when importing from file path', () => {
      it('should successfully import legislation from CSV file', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVContent);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(2);
        expect(result.failed).toBe(0);
        expect(result.total).toBe(2);
        expect(result.errors).toHaveLength(0);
        expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/file.csv', 'utf-8');
        expect(mockPrisma.legislation.create).toHaveBeenCalledTimes(2);
      });

      it('should handle CSV with quoted fields containing commas', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVWithQuotes);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(1);
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            actRegulationRequirement: 'GDPR, EU Regulation',
            description: 'Description with, comma',
            howComplianceAchieved: 'How compliance, with comma',
          }),
        });
      });

      it('should handle CSV with escaped quotes', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVWithEscapedQuotes);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(1);
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            actRegulationRequirement: 'GDPR "EU" Regulation',
          }),
        });
      });

      it('should skip existing legislation by act/regulation/requirement name', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVContent);
        mockPrisma.legislation.findMany.mockResolvedValue([
          { actRegulationRequirement: 'GDPR' },
        ]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(2); // Both counted as success (one skipped, one created)
        expect(result.total).toBe(2);
        expect(mockPrisma.legislation.create).toHaveBeenCalledTimes(1);
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            actRegulationRequirement: 'ISO 27001',
          }),
        });
      });

      it('should skip rows without act/regulation/requirement name', async () => {
        // Arrange
        const csvWithEmptyName = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,GDPR,Description 1,High,How compliance 1,risk-1
02/01/2023,Party B,,Description 2,Medium,How compliance 2,risk-2
03/01/2023,Party C,ISO 27001,Description 3,Low,How compliance 3,risk-3`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithEmptyName);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        // Rows without act/regulation/requirement are filtered out in parseCSVFromContent
        // so they don't count toward total, success, or failed
        expect(result.total).toBe(2); // Only 2 valid legislation entries (empty one is filtered out)
        expect(result.success).toBe(2);
        expect(result.failed).toBe(0); // Empty row is filtered, not counted as failed
        expect(result.errors).toHaveLength(0);
        expect(mockPrisma.legislation.create).toHaveBeenCalledTimes(2);
      });

      it('should skip rows where act/regulation/requirement name is only whitespace', async () => {
        // Arrange
        const csvWithWhitespaceOnlyName = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,GDPR,Description 1,High,How compliance 1,risk-1
02/01/2023,Party B,   ,Description 2,Medium,How compliance 2,risk-2
03/01/2023,Party C,ISO 27001,Description 3,Low,How compliance 3,risk-3`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithWhitespaceOnlyName);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        // Rows with whitespace-only act/regulation/requirement are filtered out in parseCSVFromContent
        expect(result.total).toBe(2); // Only 2 valid legislation entries (whitespace-only one is filtered out)
        expect(result.success).toBe(2);
        expect(result.failed).toBe(0); // Whitespace-only row is filtered, not counted as failed
        expect(result.errors).toHaveLength(0);
        expect(mockPrisma.legislation.create).toHaveBeenCalledTimes(2);
      });

      it('should handle date parsing in DD/MM/YYYY format', async () => {
        // Arrange
        const csvWithDate = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
15/03/2023,Party A,GDPR,Description,High,How compliance,risk-1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithDate);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const _result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            dateAdded: expect.any(Date),
          }),
        });
        const callArgs = mockPrisma.legislation.create.mock.calls[0][0].data;
        expect(callArgs.dateAdded.getFullYear()).toBe(2023);
        expect(callArgs.dateAdded.getMonth()).toBe(2); // 0-indexed, so 2 = March
        expect(callArgs.dateAdded.getDate()).toBe(15);
      });

      it('should handle date parsing in ISO format', async () => {
        // Arrange
        const csvWithISODate = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
2023-03-15,Party A,GDPR,Description,High,How compliance,risk-1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithISODate);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const _result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            dateAdded: expect.any(Date),
          }),
        });
      });

      it('should handle invalid date strings gracefully', async () => {
        // Arrange
        const csvWithInvalidDate = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
invalid-date,Party A,GDPR,Description,High,How compliance,risk-1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithInvalidDate);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const _result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            dateAdded: null,
          }),
        });
      });

      it('should handle empty date strings as null', async () => {
        // Arrange
        const csvWithEmptyDate = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
,Party A,GDPR,Description,High,How compliance,risk-1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithEmptyDate);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const _result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            dateAdded: null,
          }),
        });
      });

      it('should parse risk links correctly', async () => {
        // Arrange
        // Risk links must be quoted if they contain commas, otherwise they'll be split into separate columns
        const csvWithRiskLinks = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,GDPR,Description,High,How compliance,"risk-1,risk-2,risk-3"`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithRiskLinks);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst
          .mockResolvedValueOnce({ id: 'risk-1' })
          .mockResolvedValueOnce({ id: 'risk-2' })
          .mockResolvedValueOnce({ id: 'risk-3' });
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(1);
        expect(mockPrisma.risk.findFirst).toHaveBeenCalledTimes(3);
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            risks: {
              create: [
                { riskId: 'risk-1' },
                { riskId: 'risk-2' },
                { riskId: 'risk-3' },
              ],
            },
          }),
        });
      });

      it('should handle risk links with non-existent risk IDs', async () => {
        // Arrange
        // Risk links must be quoted if they contain commas
        const csvWithInvalidRiskLinks = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,GDPR,Description,High,How compliance,"non-existent-risk-1,non-existent-risk-2"`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithInvalidRiskLinks);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(1);
        expect(mockPrisma.risk.findFirst).toHaveBeenCalledTimes(2);
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            risks: undefined, // No risks created since none were found
          }),
        });
      });

      it('should handle empty risk links string', async () => {
        // Arrange
        const csvWithEmptyRiskLinks = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,GDPR,Description,High,How compliance,`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithEmptyRiskLinks);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(1);
        expect(mockPrisma.risk.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            risks: undefined,
          }),
        });
      });

      it('should handle risk links with extra whitespace', async () => {
        // Arrange
        // Risk links must be quoted if they contain commas
        const csvWithWhitespaceRiskLinks = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,GDPR,Description,High,How compliance," risk-1 , risk-2 , risk-3 "`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithWhitespaceRiskLinks);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst
          .mockResolvedValueOnce({ id: 'risk-1' })
          .mockResolvedValueOnce({ id: 'risk-2' })
          .mockResolvedValueOnce({ id: 'risk-3' });
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(1);
        expect(mockPrisma.risk.findFirst).toHaveBeenCalledTimes(3);
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            risks: {
              create: [
                { riskId: 'risk-1' },
                { riskId: 'risk-2' },
                { riskId: 'risk-3' },
              ],
            },
          }),
        });
      });

      it('should handle empty string fields as null', async () => {
        // Arrange
        const csvWithEmptyFields = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
,,GDPR,,,,`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithEmptyFields);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const _result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            actRegulationRequirement: 'GDPR',
            dateAdded: null,
            interestedParty: null,
            description: null,
            riskOfNonCompliance: null,
            howComplianceAchieved: null,
          }),
        });
      });

      it('should trim whitespace from string fields', async () => {
        // Arrange
        const csvWithWhitespace = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,  Party A  ,  GDPR  ,  Description  ,  High  ,  How compliance  ,`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithWhitespace);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            actRegulationRequirement: 'GDPR', // Trimmed
            interestedParty: 'Party A', // Trimmed
            description: 'Description', // Trimmed
            riskOfNonCompliance: 'High', // Trimmed
            howComplianceAchieved: 'How compliance', // Trimmed
          }),
        });
      });

      it('should handle CSV with empty rows', async () => {
        // Arrange
        const csvWithEmptyRows = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links

01/01/2023,Party A,GDPR,Description 1,High,How compliance 1,risk-1

02/01/2023,Party B,ISO 27001,Description 2,Medium,How compliance 2,risk-2
`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithEmptyRows);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(2);
        expect(result.success).toBe(2);
        expect(mockPrisma.legislation.create).toHaveBeenCalledTimes(2);
      });

      it('should handle CSV with header not at first line', async () => {
        // Arrange
        const csvWithHeaderOffset = `Some random text
Another line
Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,GDPR,Description,High,How compliance,risk-1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithHeaderOffset);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(1);
        expect(result.success).toBe(1);
        expect(mockPrisma.legislation.create).toHaveBeenCalledTimes(1);
      });

      it('should throw error when CSV file cannot be read', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockImplementation(() => {
          throw new Error('File not found');
        });

        // Act & Assert
        await expect(importLegislationFromCSV('/path/to/nonexistent.csv')).rejects.toThrow(
          'Failed to import legislation: File not found'
        );
      });

      it('should throw error when CSV has no header row', async () => {
        // Arrange
        const csvWithoutHeader = `01/01/2023,Party A,GDPR,Description,High,How compliance,risk-1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithoutHeader);

        // Act & Assert
        await expect(importLegislationFromCSV('/path/to/file.csv')).rejects.toThrow(
          'CSV file must have at least a header and one data row'
        );
      });

      it('should throw error when CSV has no data rows', async () => {
        // Arrange
        const csvOnlyHeader = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvOnlyHeader);

        // Act & Assert
        await expect(importLegislationFromCSV('/path/to/file.csv')).rejects.toThrow(
          'CSV file must have at least a header and one data row'
        );
      });

      it('should handle database errors when creating legislation', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVContent);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create
          .mockRejectedValueOnce(new Error('Database constraint violation'))
          .mockResolvedValueOnce({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toContain('Failed to create legislation "GDPR"');
        expect(result.errors[0].error).toContain('Database constraint violation');
      });

      it('should handle database errors when fetching existing legislation', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVContent);
        mockPrisma.legislation.findMany.mockRejectedValue(new Error('Database connection error'));

        // Act & Assert
        await expect(importLegislationFromCSV('/path/to/file.csv')).rejects.toThrow(
          'Failed to import legislation: Database connection error'
        );
      });

      it('should set updatedAt to current date', async () => {
        // Arrange
        const beforeDate = new Date();
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVContent);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        const afterDate = new Date();
        const callArgs = mockPrisma.legislation.create.mock.calls[0][0].data;
        expect(callArgs.updatedAt).toBeInstanceOf(Date);
        expect(callArgs.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
        expect(callArgs.updatedAt.getTime()).toBeLessThanOrEqual(afterDate.getTime());
      });

      it('should use randomUUID for id generation', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVContent);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            id: 'test-uuid-123',
          }),
        });
      });
    });

    describe('when importing from buffer', () => {
      it('should successfully import legislation from CSV buffer', async () => {
        // Arrange
        const buffer = Buffer.from(validCSVContent, 'utf-8');
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV(buffer);

        // Assert
        expect(result.success).toBe(2);
        expect(result.failed).toBe(0);
        expect(result.total).toBe(2);
        expect(result.errors).toHaveLength(0);
        expect(fs.readFileSync).not.toHaveBeenCalled();
        expect(mockPrisma.legislation.create).toHaveBeenCalledTimes(2);
      });

      it('should handle buffer with quoted fields', async () => {
        // Arrange
        const buffer = Buffer.from(validCSVWithQuotes, 'utf-8');
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV(buffer);

        // Assert
        expect(result.success).toBe(1);
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            actRegulationRequirement: 'GDPR, EU Regulation',
            description: 'Description with, comma',
          }),
        });
      });

      it('should handle empty buffer', async () => {
        // Arrange
        const buffer = Buffer.from('', 'utf-8');

        // Act & Assert
        await expect(importLegislationFromCSV(buffer)).rejects.toThrow(
          'CSV file must have at least a header and one data row'
        );
      });
    });

    describe('CSV parsing edge cases', () => {
      it('should handle CSV with Windows line endings (CRLF)', async () => {
        // Arrange
        const csvWithCRLF = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links\r\n01/01/2023,Party A,GDPR,Description,High,How compliance,risk-1\r\n`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithCRLF);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(1);
        expect(result.success).toBe(1);
      });

      it('should handle CSV with Unix line endings (LF)', async () => {
        // Arrange
        const csvWithLF = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links\n01/01/2023,Party A,GDPR,Description,High,How compliance,risk-1\n`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithLF);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(1);
        expect(result.success).toBe(1);
      });

      it('should handle CSV with trailing commas', async () => {
        // Arrange
        const csvWithTrailingCommas = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,GDPR,Description,High,How compliance,risk-1,,`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithTrailingCommas);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(1);
        expect(result.success).toBe(1);
      });

      it('should handle CSV with missing columns', async () => {
        // Arrange
        const csvWithMissingColumns = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,GDPR`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithMissingColumns);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(1);
        expect(result.success).toBe(1);
        // Missing columns should be null (after trimming empty strings)
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            actRegulationRequirement: 'GDPR',
            interestedParty: 'Party A',
            description: null,
            riskOfNonCompliance: null,
            howComplianceAchieved: null,
          }),
        });
      });

      it('should handle CSV with rows that have all empty values', async () => {
        // Arrange
        const csvWithEmptyRow = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,GDPR,Description,High,How compliance,risk-1
,,,,
02/01/2023,Party B,ISO 27001,Description,Medium,How compliance,risk-2`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithEmptyRow);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue(null);
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(2); // Empty row is skipped
        expect(result.success).toBe(2);
        expect(mockPrisma.legislation.create).toHaveBeenCalledTimes(2);
      });
    });

    describe('data mapping and transformation', () => {
      it('should map all CSV fields correctly to database model', async () => {
        // Arrange
        const completeCSV = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
15/03/2023,Party A,GDPR,General Data Protection Regulation,High,Encryption and access controls,"risk-1"`;
        (fs.readFileSync as jest.Mock).mockReturnValue(completeCSV);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst.mockResolvedValue({ id: 'risk-1' });
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: {
            id: 'test-uuid-123',
            dateAdded: expect.any(Date),
            interestedParty: 'Party A',
            actRegulationRequirement: 'GDPR',
            description: 'General Data Protection Regulation',
            riskOfNonCompliance: 'High',
            howComplianceAchieved: 'Encryption and access controls',
            updatedAt: expect.any(Date),
            risks: {
              create: [{ riskId: 'risk-1' }],
            },
          },
        });
      });

      it('should handle partial risk links (some found, some not)', async () => {
        // Arrange
        // Risk links must be quoted if they contain commas
        const csvWithPartialRiskLinks = `Date Added,Interested party,Act / Regulation / Requirement,Description,Risk of non-compliance,How compliance is achieved,Risk Links
01/01/2023,Party A,GDPR,Description,High,How compliance,"risk-1,non-existent,risk-2"`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithPartialRiskLinks);
        mockPrisma.legislation.findMany.mockResolvedValue([]);
        mockPrisma.risk.findFirst
          .mockResolvedValueOnce({ id: 'risk-1' })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'risk-2' });
        mockPrisma.legislation.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importLegislationFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(1);
        expect(mockPrisma.risk.findFirst).toHaveBeenCalledTimes(3);
        expect(mockPrisma.legislation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            risks: {
              create: [
                { riskId: 'risk-1' },
                { riskId: 'risk-2' },
              ],
            },
          }),
        });
      });
    });
  });
});

