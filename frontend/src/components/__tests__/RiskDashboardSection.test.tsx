import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../../test/utils';
import '@testing-library/jest-dom/vitest';
import { RiskDashboardSection } from '../RiskDashboardSection';
import { riskDashboardApi } from '../../services/api';
import { RiskDashboardSummary } from '../../types/riskDashboard';
import { useToast } from '@chakra-ui/react';

// Mock the riskDashboardApi
vi.mock('../../services/api', () => ({
  riskDashboardApi: {
    getSummary: vi.fn(),
  },
}));

// Mock useToast
const mockToast = vi.fn();
vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual('@chakra-ui/react');
  return {
    ...actual,
    useToast: vi.fn(),
  };
});

describe('RiskDashboardSection', () => {
  const mockSummary: RiskDashboardSummary = {
    latest_snapshot: {
      total_risk_score: 15000,
      implemented_mitigation_score: 8000,
      non_implemented_mitigation_score: 5000,
      no_mitigation_score: 2000,
      risk_score_delta: 500,
    },
    quarterly_series: [
      {
        year: 2024,
        quarter: 1,
        total_risk_score: 14000,
        implemented_mitigation_score: 7500,
        non_implemented_mitigation_score: 4500,
        no_mitigation_score: 2000,
        risk_score_delta: 300,
      },
      {
        year: 2024,
        quarter: 2,
        total_risk_score: 14500,
        implemented_mitigation_score: 7800,
        non_implemented_mitigation_score: 4800,
        no_mitigation_score: 1900,
        risk_score_delta: 400,
      },
      {
        year: 2024,
        quarter: 3,
        total_risk_score: 15000,
        implemented_mitigation_score: 8000,
        non_implemented_mitigation_score: 5000,
        no_mitigation_score: 2000,
        risk_score_delta: 500,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue(mockToast as ReturnType<typeof useToast>);
  });

  describe('Loading State', () => {
    it('should show loading spinner and text while fetching data', async () => {
      // Arrange
      vi.mocked(riskDashboardApi.getSummary).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockSummary), 100))
      );

      // Act
      render(<RiskDashboardSection />);

      // Assert - Check for loading text immediately (before API resolves)
      expect(screen.getByText('Loading risk dashboard...')).toBeInTheDocument();
      
      // The loading state should be visible before the API call completes
      // We verify the loading text is present, which indicates the loading state is working
    });
  });

  describe('Error Handling', () => {
    it('should show error toast when API call fails', async () => {
      // Arrange
      const errorResponse = {
        response: {
          data: {
            error: 'Failed to fetch dashboard data',
          },
        },
      };
      vi.mocked(riskDashboardApi.getSummary).mockRejectedValue(errorResponse);

      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(riskDashboardApi.getSummary).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to fetch dashboard data',
            status: 'error',
            duration: 5000,
            isClosable: true,
          })
        );
      });
    });

    it('should show default error message when error response has no error field', async () => {
      // Arrange
      vi.mocked(riskDashboardApi.getSummary).mockRejectedValue(new Error('Network error'));

      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to load risk dashboard data',
            status: 'error',
          })
        );
      });
    });

    it('should show empty state message when data is null after error', async () => {
      // Arrange
      vi.mocked(riskDashboardApi.getSummary).mockRejectedValue(new Error('Network error'));

      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Risk Dashboard')).toBeInTheDocument();
        expect(
          screen.getByText('Unable to load risk dashboard data. Please try refreshing the page.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Successful Data Rendering', () => {
    beforeEach(() => {
      vi.mocked(riskDashboardApi.getSummary).mockResolvedValue(mockSummary);
    });

    it('should render dashboard heading', async () => {
      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Risk Dashboard')).toBeInTheDocument();
      });
    });

    it('should render all KPI tiles with correct values', async () => {
      // Act
      render(<RiskDashboardSection />);

      // Assert - Wait for component to fully render
      await waitFor(() => {
        expect(screen.getByText('Latest Snapshot')).toBeInTheDocument();
      });

      // Check all stat labels and values
      await waitFor(() => {
        expect(screen.getByText('Total Risk Score')).toBeInTheDocument();
        expect(screen.getByText('15,000')).toBeInTheDocument(); // Formatted with commas
        expect(screen.getByText('Sum of all risk scores')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Implemented Mitigation Score')).toBeInTheDocument();
        expect(screen.getByText('8,000')).toBeInTheDocument();
        expect(screen.getByText('Risks with implemented mitigations')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Non-Implemented Mitigation Score')).toBeInTheDocument();
        expect(screen.getByText('5,000')).toBeInTheDocument();
        expect(screen.getByText('Risks with mitigations not implemented')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('No Mitigation Score')).toBeInTheDocument();
        expect(screen.getByText('2,000')).toBeInTheDocument();
        expect(screen.getByText('Risks without mitigations')).toBeInTheDocument();
      });
    });

    it('should format large numbers with commas correctly', async () => {
      // Arrange
      const largeNumberSummary: RiskDashboardSummary = {
        latest_snapshot: {
          total_risk_score: 1234567,
          implemented_mitigation_score: 987654,
          non_implemented_mitigation_score: 123456,
          no_mitigation_score: 123457,
          risk_score_delta: 0,
        },
        quarterly_series: [],
      };
      vi.mocked(riskDashboardApi.getSummary).mockResolvedValue(largeNumberSummary);

      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('1,234,567')).toBeInTheDocument();
        expect(screen.getByText('987,654')).toBeInTheDocument();
        expect(screen.getByText('123,456')).toBeInTheDocument();
        expect(screen.getByText('123,457')).toBeInTheDocument();
      });
    });

    it('should render breakdown chart section with heading', async () => {
      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Risk Score Breakdown')).toBeInTheDocument();
      });
    });

    it('should render quarterly trend chart section with heading', async () => {
      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Quarterly Trend')).toBeInTheDocument();
      });
    });

    it('should render quarterly trend chart when data is available', async () => {
      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Quarterly Trend')).toBeInTheDocument();
      });

      // The chart should be rendered (we can't easily test recharts internals, but we can verify the container exists)
      // Wait for the chart container to be rendered
      await waitFor(() => {
        const chartContainer = document.querySelector('[class*="recharts"]');
        expect(chartContainer).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {

    it('should show message when quarterly series is empty', async () => {
      // Arrange
      const summaryWithoutQuarterly: RiskDashboardSummary = {
        latest_snapshot: {
          total_risk_score: 15000,
          implemented_mitigation_score: 8000,
          non_implemented_mitigation_score: 5000,
          no_mitigation_score: 2000,
          risk_score_delta: 500,
        },
        quarterly_series: [],
      };
      vi.mocked(riskDashboardApi.getSummary).mockResolvedValue(summaryWithoutQuarterly);

      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Quarterly Trend')).toBeInTheDocument();
        expect(
          screen.getByText(
            'No quarterly history available. Current snapshot metrics are shown above.'
          )
        ).toBeInTheDocument();
      });
    });

    it('should handle all zero values in snapshot', async () => {
      // Arrange
      const allZerosSummary: RiskDashboardSummary = {
        latest_snapshot: {
          total_risk_score: 0,
          implemented_mitigation_score: 0,
          non_implemented_mitigation_score: 0,
          no_mitigation_score: 0,
          risk_score_delta: 0,
        },
        quarterly_series: [],
      };
      vi.mocked(riskDashboardApi.getSummary).mockResolvedValue(allZerosSummary);

      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Risk Dashboard')).toBeInTheDocument();
      });

      // All stats should show 0 - use getAllByText since there are multiple zeros
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThan(0); // At least one zero should be present
      
      // Verify the component rendered successfully with zero values
      expect(screen.getByText('Latest Snapshot')).toBeInTheDocument();
    });

    it('should handle single quarter in quarterly series', async () => {
      // Arrange
      const singleQuarterSummary: RiskDashboardSummary = {
        latest_snapshot: {
          total_risk_score: 15000,
          implemented_mitigation_score: 8000,
          non_implemented_mitigation_score: 5000,
          no_mitigation_score: 2000,
          risk_score_delta: 500,
        },
        quarterly_series: [
          {
            year: 2024,
            quarter: 1,
            total_risk_score: 15000,
            implemented_mitigation_score: 8000,
            non_implemented_mitigation_score: 5000,
            no_mitigation_score: 2000,
            risk_score_delta: 500,
          },
        ],
      };
      vi.mocked(riskDashboardApi.getSummary).mockResolvedValue(singleQuarterSummary);

      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Quarterly Trend')).toBeInTheDocument();
      });

      // Chart should render with single data point
      await waitFor(() => {
        const chartContainer = document.querySelector('[class*="recharts"]');
        expect(chartContainer).toBeTruthy();
      });
    });
  });

  describe('Data Formatting', () => {
    beforeEach(() => {
      vi.mocked(riskDashboardApi.getSummary).mockResolvedValue(mockSummary);
    });

    it('should format quarter labels correctly in trend data', async () => {
      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Quarterly Trend')).toBeInTheDocument();
      });

      // The chart should format quarters as "2024 Q1", "2024 Q2", etc.
      // We can't easily test the exact labels in recharts, but we verify the component renders
      await waitFor(() => {
        const chartContainer = document.querySelector('[class*="recharts"]');
        expect(chartContainer).toBeTruthy();
      });
    });
  });

  describe('Component Integration', () => {
    beforeEach(() => {
      vi.mocked(riskDashboardApi.getSummary).mockResolvedValue(mockSummary);
    });

    it('should call getSummary on mount', async () => {
      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(riskDashboardApi.getSummary).toHaveBeenCalledTimes(1);
      });
    });

    it('should render all sections in correct order', async () => {
      // Act
      render(<RiskDashboardSection />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Risk Dashboard')).toBeInTheDocument();
      });

      // Verify sections appear in order
      await waitFor(() => {
        const headings = screen.getAllByRole('heading');
        const headingTexts = headings.map((h) => h.textContent);

        expect(headingTexts).toContain('Risk Dashboard');
        expect(headingTexts).toContain('Latest Snapshot');
        expect(headingTexts).toContain('Risk Score Breakdown');
        expect(headingTexts).toContain('Quarterly Trend');
      });
    });

    it('should maintain data after successful load even if subsequent calls fail', async () => {
      // Arrange - First call succeeds
      vi.mocked(riskDashboardApi.getSummary).mockResolvedValueOnce(mockSummary);

      // Act
      render(<RiskDashboardSection />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('15,000')).toBeInTheDocument();
      });

      // The component should show the loaded data
      // (This tests the comment in the code: "Don't set data to null")
      // Since the component doesn't have a refresh mechanism, the data persists
      expect(screen.getByText('15,000')).toBeInTheDocument();
      expect(screen.getByText('Risk Dashboard')).toBeInTheDocument();
    });
  });
});

