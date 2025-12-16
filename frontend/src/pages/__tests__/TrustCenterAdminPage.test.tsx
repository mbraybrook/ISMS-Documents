import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { TrustCenterAdminPage } from '../TrustCenterAdminPage';
import { trustApi } from '../../services/trustApi';
import { useAuth } from '../../contexts/AuthContext';

// Mock dependencies
vi.mock('../../services/trustApi', () => ({
  trustApi: {
    getPendingRequests: vi.fn(),
    getDocumentSettings: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    approveUser: vi.fn(),
    denyUser: vi.fn(),
    getAllUsers: vi.fn(),
    getUserDetails: vi.fn(),
    revokeUserAccess: vi.fn(),
    restoreUserAccess: vi.fn(),
    updateDocumentSettings: vi.fn(),
    deleteDocumentSettings: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

describe('TrustCenterAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'test-user-id',
        email: 'admin@paythru.com',
        displayName: 'Test Admin',
        role: 'ADMIN' as const,
      },
      login: vi.fn(),
      logout: vi.fn(),
      loading: false,
      isAuthenticated: true,
      roleOverride: null,
      setRoleOverride: vi.fn(),
      getEffectiveRole: vi.fn(() => 'ADMIN' as const),
      departmentOverride: null,
      setDepartmentOverride: vi.fn(),
      getUserDepartment: vi.fn(() => null),
    } as ReturnType<typeof useAuth>);

    vi.mocked(trustApi.getPendingRequests).mockResolvedValue([]);
    vi.mocked(trustApi.getDocumentSettings).mockResolvedValue([]);
    vi.mocked(trustApi.getSettings).mockResolvedValue({ watermarkPrefix: 'Paythru Confidential' });
    vi.mocked(trustApi.getAllUsers).mockResolvedValue([]);
  });

  it('should render Trust Center Administration heading', async () => {
    render(<TrustCenterAdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Trust Center Administration')).toBeInTheDocument();
    });
  });

  it('should render all tabs', async () => {
    render(<TrustCenterAdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Trust Center Administration')).toBeInTheDocument();
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Use getAllByText for "User Management" since it appears both as tab and heading
    const userManagementTabs = screen.getAllByText('User Management');
    expect(userManagementTabs.length).toBeGreaterThan(0);
    expect(screen.getByText('Document Management')).toBeInTheDocument();
    expect(screen.getByText('Pending Requests')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should load users when User Management tab is selected', async () => {
    const mockUsers = [
      {
        id: 'user1',
        email: 'user1@example.com',
        companyName: 'Company 1',
        isApproved: true,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'user2',
        email: 'user2@example.com',
        companyName: 'Company 2',
        isApproved: false,
        isActive: true,
        createdAt: '2024-01-02T00:00:00Z',
      },
    ];

    vi.mocked(trustApi.getAllUsers).mockResolvedValue(mockUsers);

    render(<TrustCenterAdminPage />);

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Click on User Management tab (use getByRole to find the tab button)
    const user = userEvent.setup();
    const userManagementTab = screen.getByRole('tab', { name: 'User Management' });
    await user.click(userManagementTab);

    await waitFor(() => {
      expect(trustApi.getAllUsers).toHaveBeenCalled();
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      expect(screen.getByText('user2@example.com')).toBeInTheDocument();
    });
  });

  it('should display user details when View Details is clicked', async () => {
    const mockUsers = [
      {
        id: 'user1',
        email: 'user1@example.com',
        companyName: 'Company 1',
        isApproved: true,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockUserDetails = {
      id: 'user1',
      email: 'user1@example.com',
      companyName: 'Company 1',
      isApproved: true,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      termsAcceptedAt: '2024-01-03T00:00:00Z',
      lastLoginDate: '2024-01-10T00:00:00Z',
      totalDownloads: 5,
      approvalDate: '2024-01-05T00:00:00Z',
      approvedBy: 'admin@paythru.com',
    };

    vi.mocked(trustApi.getAllUsers).mockResolvedValue(mockUsers);
    vi.mocked(trustApi.getUserDetails).mockResolvedValue(mockUserDetails);

    render(<TrustCenterAdminPage />);

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Click on User Management tab (use getByRole to find the tab button)
    const user = userEvent.setup();
    const userManagementTab = screen.getByRole('tab', { name: 'User Management' });
    await user.click(userManagementTab);

    // Wait for users to load and table to render
    await waitFor(() => {
      expect(trustApi.getAllUsers).toHaveBeenCalled();
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    // Wait for View Details button to be available (might be multiple, get the first one)
    await waitFor(() => {
      const buttons = screen.getAllByText('View Details');
      expect(buttons.length).toBeGreaterThan(0);
    });
    
    const viewDetailsButtons = screen.getAllByText('View Details');
    expect(viewDetailsButtons.length).toBeGreaterThan(0);
    await user.click(viewDetailsButtons[0]);

    // Wait for getUserDetails to be called
    await waitFor(() => {
      expect(trustApi.getUserDetails).toHaveBeenCalledWith('user1');
    }, { timeout: 2000 });

    // Wait for modal to appear - check for modal header
    await waitFor(() => {
      expect(screen.getByText('User Details')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait for modal content - look for "Basic Information" heading which appears after loading
    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify details are displayed in the modal
    // Note: both email and company appear multiple times (table + modal), so use getAllByText
    const emailElements = screen.getAllByText('user1@example.com');
    expect(emailElements.length).toBeGreaterThanOrEqual(1);
    const companyElements = screen.getAllByText('Company 1');
    expect(companyElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should revoke user access when Revoke Access is clicked', async () => {
    const mockUsers = [
      {
        id: 'user1',
        email: 'user1@example.com',
        companyName: 'Company 1',
        isApproved: true,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockRevokedUser = {
      ...mockUsers[0],
      isActive: false,
    };

    vi.mocked(trustApi.getAllUsers)
      .mockResolvedValueOnce(mockUsers)
      .mockResolvedValueOnce([mockRevokedUser]);
    vi.mocked(trustApi.revokeUserAccess).mockResolvedValue(mockRevokedUser);

    // Mock window.confirm
    window.confirm = vi.fn(() => true);

    render(<TrustCenterAdminPage />);

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Click on User Management tab (use getByRole to find the tab button)
    const user = userEvent.setup();
    const userManagementTab = screen.getByRole('tab', { name: 'User Management' });
    await user.click(userManagementTab);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    // Click Revoke Access button
    const revokeButton = screen.getByText('Revoke Access');
    await user.click(revokeButton);

    await waitFor(() => {
      expect(trustApi.revokeUserAccess).toHaveBeenCalledWith('user1');
      expect(trustApi.getAllUsers).toHaveBeenCalledTimes(2); // Initial load + reload after revoke
    });
  });

  it('should restore user access when Restore Access is clicked', async () => {
    const mockUsers = [
      {
        id: 'user1',
        email: 'user1@example.com',
        companyName: 'Company 1',
        isApproved: true,
        isActive: false,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    const mockRestoredUser = {
      ...mockUsers[0],
      isActive: true,
    };

    vi.mocked(trustApi.getAllUsers)
      .mockResolvedValueOnce(mockUsers)
      .mockResolvedValueOnce([mockRestoredUser]);
    vi.mocked(trustApi.restoreUserAccess).mockResolvedValue(mockRestoredUser);

    // Mock window.confirm
    window.confirm = vi.fn(() => true);

    render(<TrustCenterAdminPage />);

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Click on User Management tab (use getByRole to find the tab button)
    const user = userEvent.setup();
    const userManagementTab = screen.getByRole('tab', { name: 'User Management' });
    await user.click(userManagementTab);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    // Click Restore Access button
    const restoreButton = screen.getByText('Restore Access');
    await user.click(restoreButton);

    await waitFor(() => {
      expect(trustApi.restoreUserAccess).toHaveBeenCalledWith('user1');
      expect(trustApi.getAllUsers).toHaveBeenCalledTimes(2); // Initial load + reload after restore
    });
  });

  it('should filter users by status', async () => {
    const mockUsers = [
      {
        id: 'user1',
        email: 'user1@example.com',
        companyName: 'Company 1',
        isApproved: true,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    vi.mocked(trustApi.getAllUsers).mockResolvedValue(mockUsers);

    render(<TrustCenterAdminPage />);

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Click on User Management tab (use getByRole to find the tab button)
    const user = userEvent.setup();
    const userManagementTab = screen.getByRole('tab', { name: 'User Management' });
    await user.click(userManagementTab);

    await waitFor(() => {
      expect(trustApi.getAllUsers).toHaveBeenCalledWith({
        status: 'all',
        active: undefined,
        search: undefined,
      });
    });

    // Change status filter
    const statusSelect = screen.getByLabelText('Status');
    await user.selectOptions(statusSelect, 'approved');

    await waitFor(() => {
      expect(trustApi.getAllUsers).toHaveBeenCalledWith({
        status: 'approved',
        active: undefined,
        search: undefined,
      });
    });
  });
});

