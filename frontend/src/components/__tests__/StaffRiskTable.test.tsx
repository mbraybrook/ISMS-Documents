import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { StaffRiskTable } from '../StaffRiskTable';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Department } from '../../types/risk';

// Mock API
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual, // Preserves AuthProvider export
    useAuth: vi.fn(),
  };
});

type MockAuthContext = {
  user: { role: string; email: string } | null;
  isAuthenticated: boolean;
  loading: boolean;
  getEffectiveRole: () => 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR' | null;
  getUserDepartment: () => Department | null;
  roleOverride: 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR' | null;
  departmentOverride: Department | null;
  setRoleOverride: (role: 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR' | null) => void;
  setDepartmentOverride: (department: Department | null) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

describe('StaffRiskTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { role: 'STAFF', email: 'staff@test.com' },
      isAuthenticated: true,
      loading: false,
      getEffectiveRole: () => 'STAFF',
      getUserDepartment: () => null,
      roleOverride: null,
      departmentOverride: null,
      setRoleOverride: vi.fn(),
      setDepartmentOverride: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
    } as MockAuthContext);
  });

  it('should render read-only risk table for Staff users', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'risk-1',
            title: 'Test Risk',
            calculatedScore: 18,
            riskLevel: 'MEDIUM',
            status: 'ACTIVE',
            department: 'OPERATIONS',
            dateAdded: '2024-01-01',
            riskCategory: 'INFORMATION_SECURITY',
            owner: { displayName: 'Test Owner' },
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      },
    });

    render(<StaffRiskTable />);

    await waitFor(() => {
      expect(screen.getByText('Risk Register')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Test Risk')).toBeInTheDocument();
    });

    // Should not have "New Risk" button
    expect(screen.queryByText('New Risk')).not.toBeInTheDocument();
  });

  it('should display risk data in table columns', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'risk-1',
            title: 'Test Risk',
            calculatedScore: 18,
            riskLevel: 'MEDIUM',
            status: 'ACTIVE',
            department: 'OPERATIONS',
            dateAdded: '2024-01-01',
            riskCategory: 'INFORMATION_SECURITY',
            owner: { displayName: 'Test Owner' },
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      },
    });

    render(<StaffRiskTable />);

    await waitFor(() => {
      expect(screen.getByText('Test Risk')).toBeInTheDocument();
      // Find Operations in a badge (table cell), not in the filter dropdown
      const operationsBadge = screen.getAllByText('Operations').find(
        (el) => el.closest('td') !== null
      );
      expect(operationsBadge).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('Test Owner')).toBeInTheDocument();
    });
  });

  it('should allow filtering risks', async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockResolvedValue({
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

    render(<StaffRiskTable />);

    await waitFor(() => {
      expect(screen.getByText('Risk Register')).toBeInTheDocument();
    });

    // Check that filters are available (search input should be present)
    const searchInput = screen.getByPlaceholderText(/search by title or description/i);
    expect(searchInput).toBeInTheDocument();

    // Type in search
    await user.type(searchInput, 'test query');

    // Wait for debounced search to trigger API call
    await waitFor(
      () => {
        expect(api.get).toHaveBeenCalledWith(
          '/api/risks',
          expect.objectContaining({
            params: expect.objectContaining({
              search: 'test query',
            }),
          })
        );
      },
      { timeout: 2000 }
    );
  });

  it('should fetch all risks without department filter', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
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

    render(<StaffRiskTable />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/api/risks',
        expect.objectContaining({
          params: expect.not.objectContaining({
            department: expect.anything(),
          }),
        })
      );
    });
  });

  it('should handle empty risk list', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
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

    render(<StaffRiskTable />);

    await waitFor(() => {
      expect(screen.getByText('No risks found.')).toBeInTheDocument();
    });
  });
});
