/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs';
import { importInterestedPartiesFromCSV } from '../interestedPartyImportService';
import { prisma } from '../../lib/prisma';

// Mock fs module
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
  },
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-123'),
}));

describe('interestedPartyImportService', () => {
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

  describe('importInterestedPartiesFromCSV', () => {
    const validCSVContent = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1
02/01/2023,Group B,Test Party 2,Requirement 2,No,How addressed 2,Source 2,Products 2,Obligations 2,Their obligations 2,Link 2`;

    const validCSVWithQuotes = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,"Group A","Test Party 1","Requirement 1, with comma",Yes,"How addressed 1",Source 1,Products 1,Obligations 1,Their obligations 1,Link 1`;

    const validCSVWithEscapedQuotes = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,"Group A","Test Party ""Quoted"" Name",Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1`;

    describe('when importing from file path', () => {
      it('should successfully import interested parties from CSV file', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVContent);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(2);
        expect(result.failed).toBe(0);
        expect(result.total).toBe(2);
        expect(result.errors).toHaveLength(0);
        expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/file.csv', 'utf-8');
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledTimes(2);
      });

      it('should handle CSV with quoted fields containing commas', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVWithQuotes);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(1);
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Test Party 1',
            group: 'Group A',
            requirements: 'Requirement 1, with comma',
          }),
        });
      });

      it('should handle CSV with escaped quotes', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVWithEscapedQuotes);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(1);
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Test Party "Quoted" Name',
          }),
        });
      });

      it('should skip existing interested parties', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVContent);
        mockPrisma.interestedParty.findMany.mockResolvedValue([
          { name: 'Test Party 1' },
        ]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(2); // Both counted as success (one skipped, one created)
        expect(result.total).toBe(2);
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledTimes(1);
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Test Party 2',
          }),
        });
      });

      it('should deduplicate parties with the same name', async () => {
        // Arrange
        const duplicateCSV = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1
02/01/2023,Group B,Test Party 1,Requirement 2,No,How addressed 2,Source 2,Products 2,Obligations 2,Their obligations 2,Link 2`;
        (fs.readFileSync as jest.Mock).mockReturnValue(duplicateCSV);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(1); // Only one unique party
        expect(result.success).toBe(1);
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledTimes(1);
        // Should use first occurrence's data
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Test Party 1',
            group: 'Group A',
            requirements: 'Requirement 1',
          }),
        });
      });

      it('should normalize party names (remove extra spaces)', async () => {
        // Arrange
        const csvWithSpaces = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,Group A,Test   Party   1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithSpaces);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Test Party 1', // Normalized
          }),
        });
      });

      it('should skip rows without interested party name', async () => {
        // Arrange
        const csvWithEmptyName = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1
02/01/2023,Group B,,Requirement 2,No,How addressed 2,Source 2,Products 2,Obligations 2,Their obligations 2,Link 2
03/01/2023,Group C,Test Party 2,Requirement 3,Yes,How addressed 3,Source 3,Products 3,Obligations 3,Their obligations 3,Link 3`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithEmptyName);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(2); // Only 2 valid parties
        expect(result.success).toBe(2);
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledTimes(2);
      });

      it('should skip rows where name becomes empty after normalization', async () => {
        // Arrange
        const csvWithWhitespaceOnlyName = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1
02/01/2023,Group B,   ,Requirement 2,No,How addressed 2,Source 2,Products 2,Obligations 2,Their obligations 2,Link 2
03/01/2023,Group C,Test Party 2,Requirement 3,Yes,How addressed 3,Source 3,Products 3,Obligations 3,Their obligations 3,Link 3`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithWhitespaceOnlyName);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(2); // Only 2 valid parties (whitespace-only name is skipped)
        expect(result.success).toBe(2);
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledTimes(2);
      });

      it('should handle date parsing in DD/MM/YYYY format', async () => {
        // Arrange
        const csvWithDate = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
15/03/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithDate);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            dateAdded: expect.any(Date),
          }),
        });
        const callArgs = mockPrisma.interestedParty.create.mock.calls[0][0].data;
        expect(callArgs.dateAdded.getFullYear()).toBe(2023);
        expect(callArgs.dateAdded.getMonth()).toBe(2); // 0-indexed, so 2 = March
        expect(callArgs.dateAdded.getDate()).toBe(15);
      });

      it('should handle date parsing in ISO format', async () => {
        // Arrange
        const csvWithISODate = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
2023-03-15,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithISODate);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            dateAdded: expect.any(Date),
          }),
        });
      });

      it('should handle invalid date strings gracefully', async () => {
        // Arrange
        const csvWithInvalidDate = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
invalid-date,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithInvalidDate);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            dateAdded: null,
          }),
        });
      });

      it('should parse Yes/No values correctly', async () => {
        // Arrange
        const csvWithYesNo = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1
02/01/2023,Group B,Test Party 2,Requirement 2,No,How addressed 2,Source 2,Products 2,Obligations 2,Their obligations 2,Link 2
03/01/2023,Group C,Test Party 3,Requirement 3,y,How addressed 3,Source 3,Products 3,Obligations 3,Their obligations 3,Link 3
04/01/2023,Group D,Test Party 4,Requirement 4,n,How addressed 4,Source 4,Products 4,Obligations 4,Their obligations 4,Link 4
05/01/2023,Group E,Test Party 5,Requirement 5,true,How addressed 5,Source 5,Products 5,Obligations 5,Their obligations 5,Link 5
06/01/2023,Group F,Test Party 6,Requirement 6,false,How addressed 6,Source 6,Products 6,Obligations 6,Their obligations 6,Link 6
07/01/2023,Group G,Test Party 7,Requirement 7,invalid,How addressed 7,Source 7,Products 7,Obligations 7,Their obligations 7,Link 7`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithYesNo);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(7);
        const calls = mockPrisma.interestedParty.create.mock.calls;
        expect(calls[0][0].data.addressedThroughISMS).toBe(true); // Yes
        expect(calls[1][0].data.addressedThroughISMS).toBe(false); // No
        expect(calls[2][0].data.addressedThroughISMS).toBe(true); // y
        expect(calls[3][0].data.addressedThroughISMS).toBe(false); // n
        expect(calls[4][0].data.addressedThroughISMS).toBe(true); // true
        expect(calls[5][0].data.addressedThroughISMS).toBe(false); // false
        expect(calls[6][0].data.addressedThroughISMS).toBeNull(); // invalid
      });

      it('should handle empty Yes/No values as null', async () => {
        // Arrange
        const csvWithEmptyYesNo = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,Group A,Test Party 1,Requirement 1,,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithEmptyYesNo);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            addressedThroughISMS: null,
          }),
        });
      });

      it('should handle empty string fields as null', async () => {
        // Arrange
        const csvWithEmptyFields = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
,,Test Party 1,,,,,,,`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithEmptyFields);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Test Party 1',
            group: null,
            dateAdded: null,
            requirements: null,
            addressedThroughISMS: null,
            howAddressedThroughISMS: null,
            sourceLink: null,
            keyProductsServices: null,
            ourObligations: null,
            theirObligations: null,
          }),
        });
      });

      it('should handle CSV with empty rows', async () => {
        // Arrange
        const csvWithEmptyRows = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links

01/01/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1

02/01/2023,Group B,Test Party 2,Requirement 2,No,How addressed 2,Source 2,Products 2,Obligations 2,Their obligations 2,Link 2
`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithEmptyRows);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(2);
        expect(result.success).toBe(2);
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledTimes(2);
      });

      it('should handle CSV with header not at first line', async () => {
        // Arrange
        const csvWithHeaderOffset = `Some random text
Another line
Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithHeaderOffset);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(1);
        expect(result.success).toBe(1);
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledTimes(1);
      });

      it('should throw error when CSV file cannot be read', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockImplementation(() => {
          throw new Error('File not found');
        });

        // Act & Assert
        await expect(importInterestedPartiesFromCSV('/path/to/nonexistent.csv')).rejects.toThrow(
          'Failed to import interested parties: File not found'
        );
      });

      it('should throw error when CSV has no header row', async () => {
        // Arrange
        const csvWithoutHeader = `01/01/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithoutHeader);

        // Act & Assert
        await expect(importInterestedPartiesFromCSV('/path/to/file.csv')).rejects.toThrow(
          'CSV file must have at least a header and one data row'
        );
      });

      it('should throw error when CSV has no data rows', async () => {
        // Arrange
        const csvOnlyHeader = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvOnlyHeader);

        // Act & Assert
        await expect(importInterestedPartiesFromCSV('/path/to/file.csv')).rejects.toThrow(
          'CSV file must have at least a header and one data row'
        );
      });

      it('should handle database errors when creating parties', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVContent);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create
          .mockRejectedValueOnce(new Error('Database constraint violation'))
          .mockResolvedValueOnce({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.success).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toContain('Failed to create interested party "Test Party 1"');
        expect(result.errors[0].error).toContain('Database constraint violation');
      });

      it('should handle database errors when fetching existing parties', async () => {
        // Arrange
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVContent);
        mockPrisma.interestedParty.findMany.mockRejectedValue(new Error('Database connection error'));

        // Act & Assert
        await expect(importInterestedPartiesFromCSV('/path/to/file.csv')).rejects.toThrow(
          'Failed to import interested parties: Database connection error'
        );
      });
    });

    describe('when importing from buffer', () => {
      it('should successfully import interested parties from CSV buffer', async () => {
        // Arrange
        const buffer = Buffer.from(validCSVContent, 'utf-8');
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV(buffer);

        // Assert
        expect(result.success).toBe(2);
        expect(result.failed).toBe(0);
        expect(result.total).toBe(2);
        expect(result.errors).toHaveLength(0);
        expect(fs.readFileSync).not.toHaveBeenCalled();
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledTimes(2);
      });

      it('should handle buffer with quoted fields', async () => {
        // Arrange
        const buffer = Buffer.from(validCSVWithQuotes, 'utf-8');
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV(buffer);

        // Assert
        expect(result.success).toBe(1);
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Test Party 1',
            requirements: 'Requirement 1, with comma',
          }),
        });
      });

      it('should handle empty buffer', async () => {
        // Arrange
        const buffer = Buffer.from('', 'utf-8');

        // Act & Assert
        await expect(importInterestedPartiesFromCSV(buffer)).rejects.toThrow(
          'CSV file must have at least a header and one data row'
        );
      });
    });

    describe('CSV parsing edge cases', () => {
      it('should handle CSV with Windows line endings (CRLF)', async () => {
        // Arrange
        const csvWithCRLF = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links\r\n01/01/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1\r\n`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithCRLF);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(1);
        expect(result.success).toBe(1);
      });

      it('should handle CSV with Unix line endings (LF)', async () => {
        // Arrange
        const csvWithLF = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links\n01/01/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1\n`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithLF);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(1);
        expect(result.success).toBe(1);
      });

      it('should handle CSV with trailing commas', async () => {
        // Arrange
        const csvWithTrailingCommas = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1,,`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithTrailingCommas);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(1);
        expect(result.success).toBe(1);
      });

      it('should handle CSV with missing columns', async () => {
        // Arrange
        const csvWithMissingColumns = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,Group A,Test Party 1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithMissingColumns);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        const result = await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(result.total).toBe(1);
        expect(result.success).toBe(1);
        // Missing columns should be null (after trimming empty strings)
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Test Party 1',
            group: 'Group A',
            requirements: null,
            addressedThroughISMS: null,
            howAddressedThroughISMS: null,
            sourceLink: null,
            keyProductsServices: null,
            ourObligations: null,
            theirObligations: null,
          }),
        });
      });
    });

    describe('data mapping and transformation', () => {
      it('should map all CSV fields correctly to database model', async () => {
        // Arrange
        const completeCSV = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
15/03/2023,Group A,Test Party 1,Requirement 1,Yes,How addressed 1,Source 1,Products 1,Obligations 1,Their obligations 1,Link 1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(completeCSV);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: {
            id: 'test-uuid-123',
            name: 'Test Party 1',
            group: 'Group A',
            description: 'Requirement 1', // requirements mapped to description
            dateAdded: expect.any(Date),
            requirements: 'Requirement 1',
            addressedThroughISMS: true,
            howAddressedThroughISMS: 'How addressed 1',
            sourceLink: 'Source 1',
            keyProductsServices: 'Products 1',
            ourObligations: 'Obligations 1',
            theirObligations: 'Their obligations 1',
            updatedAt: expect.any(Date),
          },
        });
      });

      it('should trim whitespace from string fields', async () => {
        // Arrange
        const csvWithWhitespace = `Date Added,Group,Interested party,Requirements,Will this be addressed through ISMS: Yes/No?,How the Requirements will be addressed through the ISMS,Source/Link to Supporting Information,Key products / services,Our obligations,Their obligations,Risk links
01/01/2023,  Group A  ,  Test Party 1  ,  Requirement 1  ,Yes,  How addressed 1  ,  Source 1  ,  Products 1  ,  Obligations 1  ,  Their obligations 1  ,Link 1`;
        (fs.readFileSync as jest.Mock).mockReturnValue(csvWithWhitespace);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        expect(mockPrisma.interestedParty.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Test Party 1', // Normalized and trimmed
            group: 'Group A', // Trimmed
            requirements: 'Requirement 1', // Trimmed
            howAddressedThroughISMS: 'How addressed 1', // Trimmed
            sourceLink: 'Source 1', // Trimmed
            keyProductsServices: 'Products 1', // Trimmed
            ourObligations: 'Obligations 1', // Trimmed
            theirObligations: 'Their obligations 1', // Trimmed
          }),
        });
      });

      it('should set updatedAt to current date', async () => {
        // Arrange
        const beforeDate = new Date();
        (fs.readFileSync as jest.Mock).mockReturnValue(validCSVContent);
        mockPrisma.interestedParty.findMany.mockResolvedValue([]);
        mockPrisma.interestedParty.create.mockResolvedValue({ id: 'test-uuid-123' });

        // Act
        await importInterestedPartiesFromCSV('/path/to/file.csv');

        // Assert
        const afterDate = new Date();
        const callArgs = mockPrisma.interestedParty.create.mock.calls[0][0].data;
        expect(callArgs.updatedAt).toBeInstanceOf(Date);
        expect(callArgs.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
        expect(callArgs.updatedAt.getTime()).toBeLessThanOrEqual(afterDate.getTime());
      });
    });
  });
});

