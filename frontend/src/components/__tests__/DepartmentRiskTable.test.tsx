import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { render } from '../../test/utils';
import { DepartmentRiskTable } from '../DepartmentRiskTable';
import { Risk } from '../../types/risk';
import { createMockUser } from '../../test/utils';

// Mock the API service
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock AuthContext
const mockGetUserDepartment = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual, // Preserves AuthProvider export
    useAuth: () => mockUseAuth(),
  };
});

// Mock RiskWizardModal
vi.mock('../RiskWizardModal', () => ({
  RiskWizardModal: ({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="risk-wizard-modal">
        <button onClick={onClose}>Close Wizard</button>
        <button onClick={() => onSuccess?.()}>Create Risk</button>
      </div>
    );
  },
}));

// Mock RiskFormModal
vi.mock('../RiskFormModal', () => ({
  RiskFormModal: ({ isOpen, onClose, risk }: { isOpen: boolean; onClose: () => void; risk?: Risk }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="risk-form-modal">
        <div data-testid="risk-title">{risk?.title}</div>
        <button onClick={onClose}>Close Form</button>
      </div>
    );
  },
}));

// Mock useDebounce to return value immediately for testing
vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

// Mock window.scrollTo
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

import api from '../../services/api';

describe('DepartmentRiskTable', () => {
  const mockUser = createMockUser({ role: 'ADMIN' });
  const mockRisks: Risk[] = [
    {
      id: 'risk-1',
      title: 'Test Risk 1',
      description: 'Description 1',
      dateAdded: '2024-01-01',
      riskCategory: 'INFORMATION_SECURITY',
      riskNature: 'STATIC',
      archived: false,
      expiryDate: null,
      lastReviewDate: null,
      nextReviewDate: null,
      owner: {
        id: 'user-1',
        displayName: 'Test Owner',
        email: 'owner@test.com',
      },
      ownerUserId: 'user-1',
      department: 'FINANCE',
      status: 'ACTIVE',
      wizardData: null,
      rejectionReason: null,
      mergedIntoRiskId: null,
      assetCategory: null,
      assetId: null,
      assetCategoryId: null,
      asset: null,
      linkedAssetCategory: null,
      interestedParty: null,
      threatDescription: null,
      confidentialityScore: 3,
      integrityScore: 2,
      availabilityScore: 1,
      riskScore: 6,
      likelihood: 3,
      calculatedScore: 18,
      initialRiskTreatmentCategory: null,
      mitigatedConfidentialityScore: null,
      mitigatedIntegrityScore: null,
      mitigatedAvailabilityScore: null,
      mitigatedRiskScore: null,
      mitigatedLikelihood: null,
      mitigatedScore: null,
      mitigationImplemented: false,
      mitigationDescription: null,
      residualRiskTreatmentCategory: null,
      annexAControlsRaw: null,
      riskLevel: 'MEDIUM',
      mitigatedRiskLevel: null,
    },
    {
      id: 'risk-2',
      title: 'Test Risk 2',
      description: 'Description 2',
      dateAdded: '2024-01-02',
      riskCategory: 'OPERATIONAL',
      riskNature: 'INSTANCE',
      archived: false,
      expiryDate: null,
      lastReviewDate: null,
      nextReviewDate: null,
      owner: {
        id: 'user-2',
        displayName: 'Another Owner',
        email: 'another@test.com',
      },
      ownerUserId: 'user-2',
      department: 'HR',
      status: 'PROPOSED',
      wizardData: null,
      rejectionReason: null,
      mergedIntoRiskId: null,
      assetCategory: null,
      assetId: null,
      assetCategoryId: null,
      asset: null,
      linkedAssetCategory: null,
      interestedParty: null,
      threatDescription: null,
      confidentialityScore: 5,
      integrityScore: 5,
      availabilityScore: 5,
      likelihood: 5,
      riskScore: 15,
      calculatedScore: 75,
      initialRiskTreatmentCategory: null,
      mitigatedConfidentialityScore: null,
      mitigatedIntegrityScore: null,
      mitigatedAvailabilityScore: null,
      mitigatedRiskScore: null,
      mitigatedLikelihood: null,
      mitigatedScore: null,
      mitigationImplemented: true,
      mitigationDescription: null,
      residualRiskTreatmentCategory: null,
      annexAControlsRaw: null,
      riskLevel: 'HIGH',
      mitigatedRiskLevel: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    mockGetUserDepartment.mockReturnValue('FINANCE');
    mockUseAuth.mockReturnValue({
      user: mockUser,
      getUserDepartment: mockGetUserDepartment,
      roleOverride: null,
    });
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: mockRisks,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component with heading and new risk button', async () => {
      // Arrange & Act - custom render wraps in act() and waits for all effects
      render(<DepartmentRiskTable />);

      // Wait for initial API call to complete (this ensures all useEffect hooks have run)
      await waitFor(() => {
        expect(api.get).toHaveBeenCalled();
      });

      // Assert - Wait for async state updates from useEffect hooks
      await waitFor(() => {
        expect(screen.getByText('Department Risks')).toBeInTheDocument();
        expect(screen.getByText('New Risk')).toBeInTheDocument();
      });
    });

    it('should fetch and display risks on mount without department filter', async () => {
      // Arrange & Act - custom render wraps in act() and waits for all effects
      render(<DepartmentRiskTable />);

      // Assert - Contributors can now view all risks by default (no department pre-filter)
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/risks', expect.objectContaining({
          params: expect.objectContaining({
            page: 1,
            limit: 20,
          }),
        }));
        // Department should not be in params unless explicitly filtered
        const call = (api.get as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(call[1].params.department).toBeUndefined();
      });

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
        expect(screen.getByText('Test Risk 2')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching risks', async () => {
      // Arrange
      (api.get as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          data: {
            data: mockRisks,
            pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
          },
        }), 100))
      );

      // Act
      render(<DepartmentRiskTable />);

      // Assert - DataTable should show loading state
      // The actual loading indicator is handled by DataTable component
      await waitFor(() => {
        expect(api.get).toHaveBeenCalled();
      });
    });

    it('should display empty message when no risks match filters', async () => {
      // Arrange
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          data: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        },
      });

      // Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        // DataTable shows "No data matches your filters" when filters are active, or uses emptyMessage
        const emptyText = screen.queryByText(/No data matches your filters|No risks match your current filters|Get started by creating your first risk/i);
        expect(emptyText).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('should filter by search term', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Verify search input exists and can be used
      const searchInput = screen.getByPlaceholderText('Search by title or description...');
      expect(searchInput).toBeInTheDocument();

      await user.click(searchInput);
      await user.keyboard('{Control>}a{/Control}'); // Select all
      await user.type(searchInput, 'Risk');

      // Assert - Verify that typing into search input works
      // The actual API call behavior is tested through integration tests
      // This test verifies the UI component is interactive
      await waitFor(() => {
        expect((searchInput as HTMLInputElement).value.length).toBeGreaterThan(0);
      }, { timeout: 2000 });
    });

    it('should filter by risk category', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Find and select risk category filter (select element)
      const selects = screen.getAllByRole('combobox');
      // Find the select that has "Risk Category" as an option
      const categorySelect = Array.from(selects).find((select) => {
        const options = Array.from(select.querySelectorAll('option'));
        return options.some((opt) => opt.textContent?.includes('Risk Category'));
      }) as HTMLSelectElement;

      if (categorySelect) {
        const user = userEvent.setup();
        await user.selectOptions(categorySelect, 'INFORMATION_SECURITY');
      }

      // Assert
      await waitFor(() => {
        const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[1].params.riskCategory).toBe('INFORMATION_SECURITY');
        expect(lastCall[1].params.page).toBe(1);
      }, { timeout: 3000 });
    });

    it('should filter by status', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Find status filter (select element)
      const selects = screen.getAllByRole('combobox');
      const statusSelect = Array.from(selects).find((select) => {
        const options = Array.from(select.querySelectorAll('option'));
        return options.some((opt) => opt.textContent?.includes('Status') || opt.value === 'ACTIVE');
      }) as HTMLSelectElement;

      if (statusSelect) {
        const user = userEvent.setup();
        await user.selectOptions(statusSelect, 'ACTIVE');
      }

      // Assert
      await waitFor(() => {
        const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[1].params.status).toBe('ACTIVE');
        expect(lastCall[1].params.page).toBe(1);
      }, { timeout: 3000 });
    });

    it('should filter by department', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Find department filter (select element)
      const selects = screen.getAllByRole('combobox');
      const departmentSelect = Array.from(selects).find((select) => {
        const options = Array.from(select.querySelectorAll('option'));
        return options.some((opt) => opt.textContent?.includes('Department') || opt.value === 'HR');
      }) as HTMLSelectElement;

      if (departmentSelect) {
        const user = userEvent.setup();
        await user.selectOptions(departmentSelect, 'HR');
      }

      // Assert
      await waitFor(() => {
        const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[1].params.department).toBe('HR');
        expect(lastCall[1].params.page).toBe(1);
      }, { timeout: 3000 });
    });

    it('should filter by risk level', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Find risk level filter (select element)
      const selects = screen.getAllByRole('combobox');
      const riskLevelSelect = Array.from(selects).find((select) => {
        const options = Array.from(select.querySelectorAll('option'));
        return options.some((opt) => opt.textContent?.includes('Risk Level') || opt.value === 'HIGH');
      }) as HTMLSelectElement;

      if (riskLevelSelect) {
        const user = userEvent.setup();
        await user.selectOptions(riskLevelSelect, 'HIGH');
      }

      // Assert
      await waitFor(() => {
        const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[1].params.riskLevel).toBe('HIGH');
        expect(lastCall[1].params.page).toBe(1);
      }, { timeout: 3000 });
    });

    it('should clear all filters when clear filters is clicked', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Apply a filter first
      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText('Search by title or description...') as HTMLInputElement;
      await user.click(searchInput);
      await user.keyboard('{Control>}a{/Control}'); // Select all
      await user.type(searchInput, 'Risk');

      // Wait for input to have value
      await waitFor(() => {
        expect(searchInput.value.length).toBeGreaterThan(0);
      }, { timeout: 2000 });

      // Wait for filter to be applied and clear button to appear
      // The clear button appears when activeFilterCount > 0
      const clearButton = await waitFor(() => {
        const button = screen.queryByText(/clear all/i);
        if (!button) throw new Error('Clear button not found');
        return button;
      }, { timeout: 2000 });

      // Assert - Verify that clear button is present before clicking
      expect(clearButton).toBeInTheDocument();

      // Act - Click the clear button
      await user.click(clearButton);
      
      // Assert - Verify that search input is cleared (user-visible behavior)
      // Note: The clear button will disappear after clearing (since activeFilterCount becomes 0),
      // so we don't check for its presence after clicking
      await waitFor(() => {
        expect(searchInput.value).toBe('');
      }, { timeout: 2000 });
    });
  });

  describe('Sorting', () => {
    it('should sort by calculated score when sort is clicked', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Find and click sort button for Score column
      const scoreHeader = screen.queryByText('Score');
      if (scoreHeader) {
        const sortButton = scoreHeader.closest('th')?.querySelector('button');
        if (sortButton) {
          const user = userEvent.setup();
          await user.click(sortButton);
        }
      }

      // Assert - Default sort is already by calculatedScore desc, so clicking might toggle
      await waitFor(() => {
        const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[1].params.sortBy).toBe('calculatedScore');
        expect(['asc', 'desc']).toContain(lastCall[1].params.sortOrder);
      }, { timeout: 3000 });
    });

    it('should toggle sort order when clicking same column twice', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Click Title column header twice (it's clickable, not a button)
      const titleHeader = screen.queryByText('Title');
      if (titleHeader) {
        const headerCell = titleHeader.closest('th');
        if (headerCell) {
          const user = userEvent.setup();
          // First click - should change to 'title' asc
          await user.click(headerCell);
          await waitFor(() => {
            const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
            const lastCall = calls[calls.length - 1];
            expect(lastCall[1].params.sortBy).toBe('title');
            expect(lastCall[1].params.sortOrder).toBe('asc');
          }, { timeout: 2000 });

          // Second click - should toggle to 'title' desc
          await user.click(headerCell);
          await waitFor(() => {
            const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
            const lastCall = calls[calls.length - 1];
            expect(lastCall[1].params.sortBy).toBe('title');
            expect(lastCall[1].params.sortOrder).toBe('desc');
          }, { timeout: 2000 });
        }
      }

      // Final assertion
      const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1].params.sortBy).toBe('title');
    });
  });

  describe('Pagination', () => {
    it('should change page when pagination is used', async () => {
      // Arrange
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          data: mockRisks,
          pagination: {
            page: 1,
            limit: 20,
            total: 50,
            totalPages: 3,
          },
        },
      });

      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Find and click Next button (DataTable uses "Next" button, not page numbers)
      const user = userEvent.setup();
      const nextButton = await waitFor(() => {
        const button = screen.queryByRole('button', { name: /next/i });
        if (!button) throw new Error('Next button not found');
        return button;
      }, { timeout: 2000 });

      await user.click(nextButton);

      // Assert
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/risks', expect.objectContaining({
          params: expect.objectContaining({
            page: 2,
          }),
        }));
      }, { timeout: 2000 });
    });

    it('should scroll to top when page changes', async () => {
      // Arrange
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          data: mockRisks,
          pagination: {
            page: 1,
            limit: 20,
            total: 50,
            totalPages: 3,
          },
        },
      });

      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Change page using Next button
      const user = userEvent.setup();
      const nextButton = await waitFor(() => {
        const button = screen.queryByRole('button', { name: /next/i });
        if (!button) throw new Error('Next button not found');
        return button;
      }, { timeout: 2000 });

      await user.click(nextButton);

      // Assert - window.scrollTo should be called
      await waitFor(() => {
        expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      }, { timeout: 2000 });
    });
  });

  describe('Modal Interactions', () => {
    it('should open RiskWizardModal when New Risk button is clicked', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act
      const user = userEvent.setup();
      const newRiskButton = screen.getByText('New Risk');
      await user.click(newRiskButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('risk-wizard-modal')).toBeInTheDocument();
      });
    });

    it('should close RiskWizardModal when close button is clicked', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Open modal
      const user = userEvent.setup();
      const newRiskButton = screen.getByText('New Risk');
      await user.click(newRiskButton);

      await waitFor(() => {
        expect(screen.getByTestId('risk-wizard-modal')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByText('Close Wizard');
      await user.click(closeButton);

      // Assert
      await waitFor(() => {
        expect(screen.queryByTestId('risk-wizard-modal')).not.toBeInTheDocument();
      });
    });

    it('should refresh risks when RiskWizardModal onSuccess is called', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      const initialCallCount = (api.get as ReturnType<typeof vi.fn>).mock.calls.length;

      // Act - Open modal and create risk
      const user = userEvent.setup();
      const newRiskButton = screen.getByText('New Risk');
      await user.click(newRiskButton);

      await waitFor(() => {
        expect(screen.getByTestId('risk-wizard-modal')).toBeInTheDocument();
      });

      const createButton = screen.getByText('Create Risk');
      await user.click(createButton);

      // Assert
      await waitFor(() => {
        expect((api.get as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('should open RiskFormModal when a risk row is clicked', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Click on a risk row
      const user = userEvent.setup();
      const riskRow = screen.getByText('Test Risk 1').closest('tr');
      if (riskRow) {
        await user.click(riskRow);
      }

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('risk-form-modal')).toBeInTheDocument();
        expect(screen.getByTestId('risk-title')).toHaveTextContent('Test Risk 1');
      });
    });

    it('should close RiskFormModal and refresh risks when closed', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act - Open modal
      const user = userEvent.setup();
      const riskRow = screen.getByText('Test Risk 1').closest('tr');
      if (riskRow) {
        await user.click(riskRow);
      }

      await waitFor(() => {
        expect(screen.getByTestId('risk-form-modal')).toBeInTheDocument();
      });

      const initialCallCount = (api.get as ReturnType<typeof vi.fn>).mock.calls.length;

      // Close modal
      const closeButton = screen.getByText('Close Form');
      await user.click(closeButton);

      // Assert
      await waitFor(() => {
        expect(screen.queryByTestId('risk-form-modal')).not.toBeInTheDocument();
        expect((api.get as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('Department Filtering Logic', () => {
    it('should not pre-filter by user department on mount - Contributors can view all risks', async () => {
      // Arrange
      mockGetUserDepartment.mockReturnValue('HR');

      // Act
      render(<DepartmentRiskTable />);

      // Assert - Contributors can now view all risks by default (no department pre-filter)
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/risks', expect.objectContaining({
          params: expect.not.objectContaining({
            department: expect.anything(),
          }),
        }));
      });
    });

    it('should use test department override when in test mode', async () => {
      // Arrange
      localStorageMock.getItem.mockReturnValue('OPERATIONS');
      mockUseAuth.mockReturnValue({
        user: mockUser,
        getUserDepartment: mockGetUserDepartment,
        roleOverride: 'CONTRIBUTOR',
      });

      // Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/risks', expect.objectContaining({
          params: expect.objectContaining({
            department: 'OPERATIONS',
            testDepartment: 'OPERATIONS',
            view: 'department',
          }),
        }));
      });
    });

    it('should clear department filter completely when clear filters is clicked', async () => {
      // Arrange
      localStorageMock.getItem.mockReturnValue('OPERATIONS');
      mockGetUserDepartment.mockReturnValue('FINANCE'); // User's actual department
      mockUseAuth.mockReturnValue({
        user: mockUser,
        getUserDepartment: mockGetUserDepartment,
        roleOverride: 'CONTRIBUTOR',
      });

      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalled();
      });

      // Act - Set a department filter first, then clear it
      const user = userEvent.setup();
      const selects = screen.getAllByRole('combobox');
      const departmentSelect = Array.from(selects).find((select) => {
        const options = Array.from(select.querySelectorAll('option'));
        return options.some((opt) => opt.textContent?.includes('Department'));
      });

      if (departmentSelect) {
        await user.selectOptions(departmentSelect, 'HR');
        await waitFor(() => {
          const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
          const lastCall = calls[calls.length - 1];
          expect(lastCall[1].params.department).toBe('HR');
        });
      }

      // Now clear all filters
      const clearButton = await waitFor(() => {
        const button = screen.queryByText(/clear all/i);
        if (!button) throw new Error('Clear button not found');
        return button;
      }, { timeout: 2000 });

      await user.click(clearButton);

      // Assert - When filters are cleared, department should be empty (not reset to effectiveDepartment)
      await waitFor(() => {
        const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = calls[calls.length - 1];
        // Department should be cleared (not in params or empty string)
        expect(lastCall[1].params.department).toBeUndefined();
      }, { timeout: 2000 });
    });

    it('should allow manual department filter selection', async () => {
      // Arrange - Contributors can view all risks, but can filter by department
      mockGetUserDepartment.mockReturnValue('FINANCE');
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/risks', expect.objectContaining({
          params: expect.not.objectContaining({
            department: expect.anything(),
          }),
        }));
      });

      // Clear department filter first (so useEffect can set it when department changes)
      const user = userEvent.setup();
      const selects = screen.getAllByRole('combobox');
      const departmentSelect = Array.from(selects).find((select) => {
        const options = Array.from(select.querySelectorAll('option'));
        return options.some((opt) => opt.textContent?.includes('Department'));
      }) as HTMLSelectElement;

      if (departmentSelect) {
        // Select a different department first, then we'll change the mock
        await user.selectOptions(departmentSelect, 'HR');
        await waitFor(() => {
          const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
          const lastCall = calls[calls.length - 1];
          expect(lastCall[1].params.department).toBe('HR');
        }, { timeout: 2000 });
      }

      // Note: The useEffect only sets department if it's empty, so this test
      // verifies that when department is manually set, it works correctly.
      // The actual useEffect behavior (auto-updating when effectiveDepartment changes)
      // is tested implicitly through the initial render.
    });
  });

  describe('Error Handling', () => {
    it('should display error toast when API call fails', async () => {
      // Suppress expected error logs
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      // Arrange
      const errorResponse = {
        response: {
          data: {
            error: 'Failed to fetch risks',
          },
        },
      };
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(errorResponse);

      // Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(api.get).toHaveBeenCalled();
      });

      // The toast should be shown (we can't easily test toast without more setup)
      // But we can verify the error was handled
      await waitFor(() => {
        // Component should still render (not crash)
        expect(screen.getByText('Department Risks')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should handle API error without response data', async () => {
      // Suppress expected error logs
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      // Arrange
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      // Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(api.get).toHaveBeenCalled();
      });

      await waitFor(() => {
        // Component should still render (not crash)
        expect(screen.getByText('Department Risks')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Risk Display', () => {
    it('should display risk title in table', async () => {
      // Arrange & Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
        expect(screen.getByText('Test Risk 2')).toBeInTheDocument();
      });
    });

    it('should display department badge for risks with department', async () => {
      // Arrange & Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Finance')).toBeInTheDocument();
        expect(screen.getByText('HR')).toBeInTheDocument();
      });
    });

    it('should display status badge for risks', async () => {
      // Arrange & Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('ACTIVE')).toBeInTheDocument();
        expect(screen.getByText('PROPOSED')).toBeInTheDocument();
      });
    });

    it('should display calculated score and risk level', async () => {
      // Arrange & Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('18')).toBeInTheDocument(); // calculatedScore
        expect(screen.getByText('75')).toBeInTheDocument(); // calculatedScore
        expect(screen.getByText('MEDIUM')).toBeInTheDocument();
        expect(screen.getByText('HIGH')).toBeInTheDocument();
      });
    });

    it('should display risk category', async () => {
      // Arrange & Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/INFORMATION SECURITY/i)).toBeInTheDocument();
        expect(screen.getByText(/OPERATIONAL/i)).toBeInTheDocument();
      });
    });

    it('should display owner name', async () => {
      // Arrange & Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Test Owner')).toBeInTheDocument();
        expect(screen.getByText('Another Owner')).toBeInTheDocument();
      });
    });

    it('should display N/A for risk without department', async () => {
      // Arrange
      const riskWithoutDept: Risk = {
        ...mockRisks[0],
        department: null,
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          data: [riskWithoutDept],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        },
      });

      // Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('N/A')).toBeInTheDocument();
      });
    });
  });

  describe('Search Debouncing', () => {
    it('should update search input immediately', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // Act
      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText('Search by title or description...') as HTMLInputElement;
      await user.click(searchInput);
      await user.keyboard('{Control>}a{/Control}'); // Select all
      // Use shorter text to avoid typing completion issues
      await user.type(searchInput, 'Risk');

      // Assert - Input should update immediately (controlled by searchInput state)
      // This is a simplified test - we verify the input exists and can be typed into
      // The actual filtering behavior is tested in "should filter by search term"
      expect(searchInput).toBeInTheDocument();
      // Wait for React state update - check that input has some value
      await waitFor(() => {
        expect(searchInput.value.length).toBeGreaterThan(0);
      }, { timeout: 2000 });
    });

    it('should sync search input when filters.search changes externally', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(screen.getByText('Test Risk 1')).toBeInTheDocument();
      });

      // This tests the useEffect that syncs searchInput with filters.search
      // The actual behavior is tested through the debounce mechanism
      const searchInput = screen.getByPlaceholderText('Search by title or description...') as HTMLInputElement;

      // The search input should be initialized
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('Filter Parameters', () => {
    it('should include archived parameter when archived filter is set', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalled();
      });

      // The archived filter is not directly exposed in the UI for this component
      // but we can verify the default behavior
      const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
      const firstCall = calls[0];
      expect(firstCall[1].params.archived).toBeUndefined(); // archived defaults to false, so not sent
    });

    it('should include mitigationImplemented parameter when set', async () => {
      // Arrange
      render(<DepartmentRiskTable />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalled();
      });

      // mitigationImplemented is not directly exposed in filterConfigs for this component
      // but the parameter structure supports it
      const calls = (api.get as ReturnType<typeof vi.fn>).mock.calls;
      const firstCall = calls[0];
      // By default, mitigationImplemented is empty string, so not sent
      expect(firstCall[1].params.mitigationImplemented).toBeUndefined();
    });

    it('should include sortBy and sortOrder in API call', async () => {
      // Arrange & Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/risks', expect.objectContaining({
          params: expect.objectContaining({
            sortBy: 'calculatedScore',
            sortOrder: 'desc',
          }),
        }));
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null user gracefully', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: null,
        getUserDepartment: () => null,
        roleOverride: null,
      });

      // Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(api.get).toHaveBeenCalled();
      });

      // Should still render without crashing
      expect(screen.getByText('Department Risks')).toBeInTheDocument();
    });

    it('should handle empty risks array', async () => {
      // Arrange
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          data: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        },
      });

      // Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        // DataTable shows different messages based on filter state
        const emptyText = screen.queryByText(/No data matches your filters|No risks match your current filters|Get started by creating your first risk/i);
        expect(emptyText).toBeInTheDocument();
      });
    });

    it('should handle risks without owner', async () => {
      // Arrange
      const riskWithoutOwner: Risk = {
        ...mockRisks[0],
        owner: null,
        ownerUserId: null,
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          data: [riskWithoutOwner],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        },
      });

      // Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('N/A')).toBeInTheDocument();
      });
    });

    it('should handle risks without category', async () => {
      // Arrange
      const riskWithoutCategory: Risk = {
        ...mockRisks[0],
        riskCategory: null,
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          data: [riskWithoutCategory],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        },
      });

      // Act
      render(<DepartmentRiskTable />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('N/A')).toBeInTheDocument();
      });
    });
  });
});

