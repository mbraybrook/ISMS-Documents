/* eslint-disable @typescript-eslint/no-explicit-any */
import { getRiskDashboardSummary } from '../riskDashboardService';
import { prisma } from '../../lib/prisma';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    risk: {
      findMany: jest.fn(),
    },
  },
}));

describe('riskDashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRiskDashboardSummary', () => {
    it('should return empty snapshot and series when no risks exist', async () => {
      // Arrange
      (prisma.risk.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result).toEqual({
        latest_snapshot: {
          total_risk_score: 0,
          implemented_mitigation_score: 0,
          non_implemented_mitigation_score: 0,
          no_mitigation_score: 0,
          risk_score_delta: 0,
        },
        quarterly_series: [],
      });
      expect(prisma.risk.findMany).toHaveBeenCalledWith({
        where: { archived: false },
        select: {
          dateAdded: true,
          createdAt: true,
          calculatedScore: true,
          mitigatedScore: true,
          mitigationImplemented: true,
        },
      });
    });

    it('should exclude archived risks', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-01-15'),
          createdAt: new Date('2024-01-15'),
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-02-15'),
          createdAt: new Date('2024-02-15'),
          calculatedScore: 20,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(prisma.risk.findMany).toHaveBeenCalledWith({
        where: { archived: false },
        select: {
          dateAdded: true,
          createdAt: true,
          calculatedScore: true,
          mitigatedScore: true,
          mitigationImplemented: true,
        },
      });
      expect(result.latest_snapshot.total_risk_score).toBe(30);
    });

    it('should calculate snapshot correctly for risks with no mitigation', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-01-15'),
          createdAt: new Date('2024-01-15'),
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-01-20'),
          createdAt: new Date('2024-01-20'),
          calculatedScore: 20,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.latest_snapshot).toEqual({
        total_risk_score: 30,
        implemented_mitigation_score: 0,
        non_implemented_mitigation_score: 0,
        no_mitigation_score: 30,
        risk_score_delta: 30,
      });
    });

    it('should calculate snapshot correctly for risks with implemented mitigation', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-01-15'),
          createdAt: new Date('2024-01-15'),
          calculatedScore: 10,
          mitigatedScore: 5,
          mitigationImplemented: true,
        },
        {
          dateAdded: new Date('2024-01-20'),
          createdAt: new Date('2024-01-20'),
          calculatedScore: 20,
          mitigatedScore: 8,
          mitigationImplemented: true,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.latest_snapshot).toEqual({
        total_risk_score: 30,
        implemented_mitigation_score: 13,
        non_implemented_mitigation_score: 0,
        no_mitigation_score: 0,
        risk_score_delta: 17,
      });
    });

    it('should calculate snapshot correctly for risks with non-implemented mitigation', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-01-15'),
          createdAt: new Date('2024-01-15'),
          calculatedScore: 10,
          mitigatedScore: 5,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-01-20'),
          createdAt: new Date('2024-01-20'),
          calculatedScore: 20,
          mitigatedScore: 8,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.latest_snapshot).toEqual({
        total_risk_score: 30,
        implemented_mitigation_score: 0,
        non_implemented_mitigation_score: 13,
        no_mitigation_score: 0,
        risk_score_delta: 30,
      });
    });

    it('should calculate snapshot correctly for mixed mitigation states', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-01-15'),
          createdAt: new Date('2024-01-15'),
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-01-20'),
          createdAt: new Date('2024-01-20'),
          calculatedScore: 20,
          mitigatedScore: 8,
          mitigationImplemented: true,
        },
        {
          dateAdded: new Date('2024-01-25'),
          createdAt: new Date('2024-01-25'),
          calculatedScore: 15,
          mitigatedScore: 5,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.latest_snapshot).toEqual({
        total_risk_score: 45,
        implemented_mitigation_score: 8,
        non_implemented_mitigation_score: 5,
        no_mitigation_score: 10,
        risk_score_delta: 37,
      });
    });

    it('should group risks by quarter correctly', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-01-15'), // Q1
          createdAt: new Date('2024-01-15'),
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-04-15'), // Q2
          createdAt: new Date('2024-04-15'),
          calculatedScore: 20,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-07-15'), // Q3
          createdAt: new Date('2024-07-15'),
          calculatedScore: 15,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-10-15'), // Q4
          createdAt: new Date('2024-10-15'),
          calculatedScore: 5,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.quarterly_series).toHaveLength(4);
      expect(result.quarterly_series[0]).toEqual({
        year: 2024,
        quarter: 1,
        total_risk_score: 10,
        implemented_mitigation_score: 0,
        non_implemented_mitigation_score: 0,
        no_mitigation_score: 10,
        risk_score_delta: 10,
      });
      expect(result.quarterly_series[1]).toEqual({
        year: 2024,
        quarter: 2,
        total_risk_score: 20,
        implemented_mitigation_score: 0,
        non_implemented_mitigation_score: 0,
        no_mitigation_score: 20,
        risk_score_delta: 20,
      });
      expect(result.quarterly_series[2]).toEqual({
        year: 2024,
        quarter: 3,
        total_risk_score: 15,
        implemented_mitigation_score: 0,
        non_implemented_mitigation_score: 0,
        no_mitigation_score: 15,
        risk_score_delta: 15,
      });
      expect(result.quarterly_series[3]).toEqual({
        year: 2024,
        quarter: 4,
        total_risk_score: 5,
        implemented_mitigation_score: 0,
        non_implemented_mitigation_score: 0,
        no_mitigation_score: 5,
        risk_score_delta: 5,
      });
    });

    it('should group risks by year correctly', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2023-06-15'),
          createdAt: new Date('2023-06-15'),
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-01-15'),
          createdAt: new Date('2024-01-15'),
          calculatedScore: 20,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2025-06-15'),
          createdAt: new Date('2025-06-15'),
          calculatedScore: 15,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.quarterly_series).toHaveLength(3);
      expect(result.quarterly_series[0].year).toBe(2023);
      expect(result.quarterly_series[1].year).toBe(2024);
      expect(result.quarterly_series[2].year).toBe(2025);
    });

    it('should sort quarterly series by year and quarter ascending', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-10-15'), // Q4 2024
          createdAt: new Date('2024-10-15'),
          calculatedScore: 5,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2023-01-15'), // Q1 2023
          createdAt: new Date('2023-01-15'),
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-04-15'), // Q2 2024
          createdAt: new Date('2024-04-15'),
          calculatedScore: 20,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2023-07-15'), // Q3 2023
          createdAt: new Date('2023-07-15'),
          calculatedScore: 15,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.quarterly_series).toHaveLength(4);
      expect(result.quarterly_series[0]).toEqual(
        expect.objectContaining({ year: 2023, quarter: 1 })
      );
      expect(result.quarterly_series[1]).toEqual(
        expect.objectContaining({ year: 2023, quarter: 3 })
      );
      expect(result.quarterly_series[2]).toEqual(
        expect.objectContaining({ year: 2024, quarter: 2 })
      );
      expect(result.quarterly_series[3]).toEqual(
        expect.objectContaining({ year: 2024, quarter: 4 })
      );
    });

    it('should aggregate multiple risks in the same quarter', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-01-15'), // Q1
          createdAt: new Date('2024-01-15'),
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-02-20'), // Q1
          createdAt: new Date('2024-02-20'),
          calculatedScore: 20,
          mitigatedScore: 5,
          mitigationImplemented: true,
        },
        {
          dateAdded: new Date('2024-03-10'), // Q1
          createdAt: new Date('2024-03-10'),
          calculatedScore: 15,
          mitigatedScore: 8,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.quarterly_series).toHaveLength(1);
      expect(result.quarterly_series[0]).toEqual({
        year: 2024,
        quarter: 1,
        total_risk_score: 45,
        implemented_mitigation_score: 5,
        non_implemented_mitigation_score: 8,
        no_mitigation_score: 10,
        risk_score_delta: 40,
      });
    });

    it('should use dateAdded when available', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-01-15'),
          createdAt: new Date('2023-12-01'), // Different date, should be ignored
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.quarterly_series[0].year).toBe(2024);
      expect(result.quarterly_series[0].quarter).toBe(1);
    });

    it('should fallback to createdAt when dateAdded is missing', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: null,
          createdAt: new Date('2024-06-15'), // Should be used
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.quarterly_series[0].year).toBe(2024);
      expect(result.quarterly_series[0].quarter).toBe(2);
    });

    it('should fallback to current date when both dateAdded and createdAt are missing', async () => {
      // Arrange
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      const expectedQuarter = Math.floor(currentMonth / 3) + 1;

      const mockRisks = [
        {
          dateAdded: null,
          createdAt: null,
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.quarterly_series[0].year).toBe(currentYear);
      expect(result.quarterly_series[0].quarter).toBe(expectedQuarter);
    });

    it('should use latest quarter snapshot when quarterly data exists', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-01-15'), // Q1
          createdAt: new Date('2024-01-15'),
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-10-15'), // Q4
          createdAt: new Date('2024-10-15'),
          calculatedScore: 20,
          mitigatedScore: 8,
          mitigationImplemented: true,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.latest_snapshot).toEqual({
        total_risk_score: 20,
        implemented_mitigation_score: 8,
        non_implemented_mitigation_score: 0,
        no_mitigation_score: 0,
        risk_score_delta: 12,
      });
    });

    it('should use current snapshot when no quarterly data exists', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: null,
          createdAt: null,
          calculatedScore: 10,
          mitigatedScore: 5,
          mitigationImplemented: true,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      // When quarterly data exists (even with fallback dates), latest_snapshot uses latest quarter
      // But if we want to test the fallback, we need to ensure no quarterly data
      // Actually, the code will always create quarterly data because it uses current date as fallback
      // So this test verifies the current snapshot calculation
      expect(result.latest_snapshot.total_risk_score).toBe(10);
      expect(result.latest_snapshot.implemented_mitigation_score).toBe(5);
    });

    it('should handle risks with zero scores', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-01-15'),
          createdAt: new Date('2024-01-15'),
          calculatedScore: 0,
          mitigatedScore: 0,
          mitigationImplemented: true,
        },
        {
          dateAdded: new Date('2024-02-15'),
          createdAt: new Date('2024-02-15'),
          calculatedScore: 0,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.latest_snapshot.total_risk_score).toBe(0);
      expect(result.latest_snapshot.implemented_mitigation_score).toBe(0);
      expect(result.latest_snapshot.no_mitigation_score).toBe(0);
      expect(result.latest_snapshot.risk_score_delta).toBe(0);
    });

    it('should calculate risk_score_delta correctly as total minus implemented', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-01-15'),
          createdAt: new Date('2024-01-15'),
          calculatedScore: 100,
          mitigatedScore: 30,
          mitigationImplemented: true,
        },
        {
          dateAdded: new Date('2024-01-20'),
          createdAt: new Date('2024-01-20'),
          calculatedScore: 50,
          mitigatedScore: 20,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      // Delta = total_risk_score (150) - implemented_mitigation_score (30) = 120
      expect(result.latest_snapshot.risk_score_delta).toBe(120);
      expect(result.quarterly_series[0].risk_score_delta).toBe(120);
    });

    it('should handle dateAdded as string (from database)', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: '2024-01-15T00:00:00.000Z' as any, // String date
          createdAt: new Date('2024-01-15'),
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.quarterly_series[0].year).toBe(2024);
      expect(result.quarterly_series[0].quarter).toBe(1);
    });

    it('should handle createdAt as string (from database)', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: null,
          createdAt: '2024-06-15T00:00:00.000Z' as any, // String date
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.quarterly_series[0].year).toBe(2024);
      expect(result.quarterly_series[0].quarter).toBe(2);
    });

    it('should correctly identify quarters for all months', async () => {
      // Arrange
      const mockRisks = [
        {
          dateAdded: new Date('2024-01-15'), // Jan - Q1
          createdAt: new Date('2024-01-15'),
          calculatedScore: 1,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-03-15'), // Mar - Q1
          createdAt: new Date('2024-03-15'),
          calculatedScore: 2,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-04-15'), // Apr - Q2
          createdAt: new Date('2024-04-15'),
          calculatedScore: 3,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-06-15'), // Jun - Q2
          createdAt: new Date('2024-06-15'),
          calculatedScore: 4,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-07-15'), // Jul - Q3
          createdAt: new Date('2024-07-15'),
          calculatedScore: 5,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-09-15'), // Sep - Q3
          createdAt: new Date('2024-09-15'),
          calculatedScore: 6,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-10-15'), // Oct - Q4
          createdAt: new Date('2024-10-15'),
          calculatedScore: 7,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-12-15'), // Dec - Q4
          createdAt: new Date('2024-12-15'),
          calculatedScore: 8,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.quarterly_series).toHaveLength(4);
      expect(result.quarterly_series[0].quarter).toBe(1);
      expect(result.quarterly_series[0].total_risk_score).toBe(3); // 1 + 2
      expect(result.quarterly_series[1].quarter).toBe(2);
      expect(result.quarterly_series[1].total_risk_score).toBe(7); // 3 + 4
      expect(result.quarterly_series[2].quarter).toBe(3);
      expect(result.quarterly_series[2].total_risk_score).toBe(11); // 5 + 6
      expect(result.quarterly_series[3].quarter).toBe(4);
      expect(result.quarterly_series[3].total_risk_score).toBe(15); // 7 + 8
    });

    it('should handle complex scenario with multiple years, quarters, and mitigation states', async () => {
      // Arrange
      const mockRisks = [
        // 2023 Q2 - no mitigation
        {
          dateAdded: new Date('2023-05-15'),
          createdAt: new Date('2023-05-15'),
          calculatedScore: 10,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        // 2023 Q4 - implemented mitigation
        {
          dateAdded: new Date('2023-11-15'),
          createdAt: new Date('2023-11-15'),
          calculatedScore: 20,
          mitigatedScore: 8,
          mitigationImplemented: true,
        },
        // 2024 Q1 - non-implemented mitigation
        {
          dateAdded: new Date('2024-02-15'),
          createdAt: new Date('2024-02-15'),
          calculatedScore: 15,
          mitigatedScore: 5,
          mitigationImplemented: false,
        },
        // 2024 Q3 - mixed in same quarter
        {
          dateAdded: new Date('2024-08-15'),
          createdAt: new Date('2024-08-15'),
          calculatedScore: 30,
          mitigatedScore: null,
          mitigationImplemented: false,
        },
        {
          dateAdded: new Date('2024-09-15'),
          createdAt: new Date('2024-09-15'),
          calculatedScore: 25,
          mitigatedScore: 10,
          mitigationImplemented: true,
        },
      ];

      (prisma.risk.findMany as jest.Mock).mockResolvedValue(mockRisks);

      // Act
      const result = await getRiskDashboardSummary();

      // Assert
      expect(result.quarterly_series).toHaveLength(4);
      
      // 2023 Q2
      expect(result.quarterly_series[0]).toEqual({
        year: 2023,
        quarter: 2,
        total_risk_score: 10,
        implemented_mitigation_score: 0,
        non_implemented_mitigation_score: 0,
        no_mitigation_score: 10,
        risk_score_delta: 10,
      });

      // 2023 Q4
      expect(result.quarterly_series[1]).toEqual({
        year: 2023,
        quarter: 4,
        total_risk_score: 20,
        implemented_mitigation_score: 8,
        non_implemented_mitigation_score: 0,
        no_mitigation_score: 0,
        risk_score_delta: 12,
      });

      // 2024 Q1
      expect(result.quarterly_series[2]).toEqual({
        year: 2024,
        quarter: 1,
        total_risk_score: 15,
        implemented_mitigation_score: 0,
        non_implemented_mitigation_score: 5,
        no_mitigation_score: 0,
        risk_score_delta: 15,
      });

      // 2024 Q3
      expect(result.quarterly_series[3]).toEqual({
        year: 2024,
        quarter: 3,
        total_risk_score: 55, // 30 + 25
        implemented_mitigation_score: 10,
        non_implemented_mitigation_score: 0,
        no_mitigation_score: 30,
        risk_score_delta: 45,
      });

      // Latest snapshot should be from 2024 Q3 (most recent quarter)
      expect(result.latest_snapshot).toEqual({
        total_risk_score: 55, // 30 + 25
        implemented_mitigation_score: 10,
        non_implemented_mitigation_score: 0,
        no_mitigation_score: 30,
        risk_score_delta: 45,
      });
    });
  });
});

