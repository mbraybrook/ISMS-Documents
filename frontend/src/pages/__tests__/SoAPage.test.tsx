import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { SoAPage } from '../SoAPage';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// Mock dependencies
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

describe('SoAPage', () => {
  const mockAdminUser = {
    id: 'user-1',
    email: 'admin@paythru.com',
    displayName: 'Admin User',
    role: 'ADMIN' as const,
  };

  const mockEditorUser = {
    id: 'user-2',
    email: 'editor@paythru.com',
    displayName: 'Editor User',
    role: 'EDITOR' as const,
  };

  const mockStaffUser = {
    id: 'user-3',
    email: 'staff@paythru.com',
    displayName: 'Staff User',
    role: 'STAFF' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(useAuth).mockReturnValue({
      user: mockAdminUser,
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

    vi.mocked(api.get).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
  });


  describe('Rendering', () => {
    it('should render SoA page heading', async () => {
      render(<SoAPage />);

      await waitFor(() => {
        expect(screen.getByText('Statement of Applicability (SoA) Export')).toBeInTheDocument();
      });
    });

    it('should render description text', async () => {
      render(<SoAPage />);

      await waitFor(() => {
        expect(screen.getByText(/Generate a Statement of Applicability report in Excel format/)).toBeInTheDocument();
      });
    });

    it('should render Generate SoA (Excel) button', async () => {
      render(<SoAPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate SoA \(Excel\)/ })).toBeInTheDocument();
      });
    });

    it('should only render Generate SoA (Excel) button', async () => {
      render(<SoAPage />);

      await waitFor(() => {
        const excelButton = screen.getByRole('button', { name: /Generate SoA \(Excel\)/ });
        expect(excelButton).toBeInTheDocument();
        // PDF button does not exist in the current implementation
        expect(screen.queryByRole('button', { name: /Generate SoA \(PDF\)/ })).not.toBeInTheDocument();
      });
    });
  });

  describe('Permission Checks', () => {
    it('should show permission warning for non-admin/editor users', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: mockStaffUser,
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
        isAuthenticated: true,
        roleOverride: null,
        setRoleOverride: vi.fn(),
        getEffectiveRole: vi.fn(() => 'STAFF' as const),
        departmentOverride: null,
        setDepartmentOverride: vi.fn(),
        getUserDepartment: vi.fn(() => null),
      } as ReturnType<typeof useAuth>);

      render(<SoAPage />);

      await waitFor(() => {
        expect(screen.getByText('You do not have permission to access this page.')).toBeInTheDocument();
      });

      expect(screen.queryByText('Statement of Applicability (SoA) Export')).not.toBeInTheDocument();
    });

    it('should allow access for ADMIN users', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: mockAdminUser,
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

      render(<SoAPage />);

      await waitFor(() => {
        expect(screen.getByText('Statement of Applicability (SoA) Export')).toBeInTheDocument();
      });
    });

    it('should allow access for EDITOR users', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: mockEditorUser,
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
        isAuthenticated: true,
        roleOverride: null,
        setRoleOverride: vi.fn(),
        getEffectiveRole: vi.fn(() => 'EDITOR' as const),
        departmentOverride: null,
        setDepartmentOverride: vi.fn(),
        getUserDepartment: vi.fn(() => null),
      } as ReturnType<typeof useAuth>);

      render(<SoAPage />);

      await waitFor(() => {
        expect(screen.getByText('Statement of Applicability (SoA) Export')).toBeInTheDocument();
      });
    });
  });

  describe('Loading Exports', () => {
    it('should load exports on mount', async () => {
      const mockExports = [
        {
          id: 'export-1',
          generatedAt: '2024-01-01T00:00:00Z',
          exportFormat: 'EXCEL',
          generatedBy: {
            id: 'user-1',
            displayName: 'Admin User',
            email: 'admin@paythru.com',
          },
        },
      ];

      vi.mocked(api.get).mockResolvedValue({ data: mockExports });

      render(<SoAPage />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/soa/exports');
      });
    });

    it('should display previous exports when available', async () => {
      const mockExports = [
        {
          id: 'export-1',
          generatedAt: '2024-01-01T10:00:00Z',
          exportFormat: 'EXCEL',
          generatedBy: {
            id: 'user-1',
            displayName: 'Admin User',
            email: 'admin@paythru.com',
          },
        },
        {
          id: 'export-2',
          generatedAt: '2024-01-02T10:00:00Z',
          exportFormat: 'EXCEL',
          generatedBy: {
            id: 'user-2',
            displayName: 'Editor User',
            email: 'editor@paythru.com',
          },
        },
      ];

      vi.mocked(api.get).mockResolvedValue({ data: mockExports });

      render(<SoAPage />);

      await waitFor(() => {
        expect(screen.getByText('Previous Exports')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Admin User')).toBeInTheDocument();
        expect(screen.getByText('Editor User')).toBeInTheDocument();
      });
    });

    it('should handle exports with null generatedBy', async () => {
      const mockExports = [
        {
          id: 'export-1',
          generatedAt: '2024-01-01T10:00:00Z',
          exportFormat: 'EXCEL',
          generatedBy: null,
        },
      ];

      vi.mocked(api.get).mockResolvedValue({ data: mockExports });

      render(<SoAPage />);

      await waitFor(() => {
        expect(screen.getByText('Previous Exports')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Unknown')).toBeInTheDocument();
      });
    });

    it('should not display exports table when no exports exist', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: [] });

      render(<SoAPage />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/soa/exports');
      });

      expect(screen.queryByText('Previous Exports')).not.toBeInTheDocument();
    });

    it('should handle error when loading exports fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(api.get).mockRejectedValue(new Error('Failed to load exports'));

      render(<SoAPage />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/soa/exports');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading exports:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      // Ensure clean state for each test in this describe block
      vi.clearAllMocks();
      
      // Restore any spies that might have been left from previous tests
      try {
        const createElementSpy = vi.spyOn(document, 'createElement');
        if (createElementSpy) createElementSpy.mockRestore();
      } catch {
        // Spy doesn't exist, which is fine
      }
      try {
        const appendChildSpy = vi.spyOn(document.body, 'appendChild');
        if (appendChildSpy) appendChildSpy.mockRestore();
      } catch {
        // Spy doesn't exist, which is fine
      }
    });

    it('should generate Excel export when button is clicked', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['mock excel content'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const mockResponse = { data: mockBlob };

      // Mock window.URL methods for download functionality
      const createObjectURLSpy = vi.fn(() => 'blob:mock-url');
      const revokeObjectURLSpy = vi.fn();
      window.URL.createObjectURL = createObjectURLSpy;
      window.URL.revokeObjectURL = revokeObjectURLSpy;

      vi.mocked(api.post).mockResolvedValue(mockResponse);

      render(<SoAPage />);
      
      // Set up spies AFTER render to avoid interfering with React's DOM creation
      const originalCreateElement = document.createElement.bind(document);
      const mockLink = originalCreateElement('a');
      mockLink.click = vi.fn();
      mockLink.remove = vi.fn();
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return mockLink;
        }
        return originalCreateElement(tagName);
      });
      
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate SoA \(Excel\)/ })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /Generate SoA \(Excel\)/ });
      await user.click(exportButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/api/soa/export',
          { format: 'EXCEL' },
          { responseType: 'blob' }
        );
      });

      // Verify download was triggered
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

      // Clean up spies
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
    });

    it('should show loading state during export generation', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['mock excel content'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const mockResponse = { data: mockBlob };

      // Mock window.URL methods for download functionality
      window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      window.URL.revokeObjectURL = vi.fn();

      // Delay the response to test loading state
      vi.mocked(api.post).mockImplementation(() => 
        new Promise((resolve) => setTimeout(() => resolve(mockResponse), 100))
      );

      render(<SoAPage />);
      
      // Set up spies AFTER render to avoid interfering with React's DOM creation
      const originalCreateElement = document.createElement.bind(document);
      const mockLink = originalCreateElement('a');
      mockLink.click = vi.fn();
      mockLink.remove = vi.fn();
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return mockLink;
        }
        return originalCreateElement(tagName);
      });
      
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate SoA \(Excel\)/ })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /Generate SoA \(Excel\)/ });
      await user.click(exportButton);

      // Button should show loading state
      await waitFor(() => {
        expect(screen.getByText('Generating...')).toBeInTheDocument();
      });

      // Clean up - wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Clean up spies
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
    });

    it('should show success toast after successful export', async () => {
      const user = userEvent.setup();
      const mockBlob = new Blob(['mock excel content'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const mockResponse = { data: mockBlob };

      // Mock window.URL methods for download functionality
      window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      window.URL.revokeObjectURL = vi.fn();

      vi.mocked(api.post).mockResolvedValue(mockResponse);
      vi.mocked(api.get).mockResolvedValue({ data: [] });

      render(<SoAPage />);
      
      // Set up spies AFTER render to avoid interfering with React's DOM creation
      const originalCreateElement = document.createElement.bind(document);
      const mockLink = originalCreateElement('a');
      mockLink.click = vi.fn();
      mockLink.remove = vi.fn();
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return mockLink;
        }
        return originalCreateElement(tagName);
      });
      
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate SoA \(Excel\)/ })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /Generate SoA \(Excel\)/ });
      await user.click(exportButton);

      // Wait for API call to complete
      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
      });

      // Wait for toast to appear - Chakra toasts can take a moment
      await waitFor(() => {
        expect(screen.getByText('Success')).toBeInTheDocument();
      }, { timeout: 5000 });

      await waitFor(() => {
        expect(screen.getByText('SoA export generated successfully.')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should refresh exports list after successful export
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(2); // Once on mount, once after export
      });

      // Clean up spies
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
    });

    it('should show error toast when export fails', async () => {
      const user = userEvent.setup();
      const error = {
        response: {
          data: {
            error: 'Failed to generate export',
          },
        },
      };

      vi.mocked(api.post).mockRejectedValue(error);

      render(<SoAPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate SoA \(Excel\)/ })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /Generate SoA \(Excel\)/ });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Failed to generate export')).toBeInTheDocument();
      });
    });

    it('should show generic error message when error response has no error field', async () => {
      const user = userEvent.setup();
      const error = new Error('Network error');

      vi.mocked(api.post).mockRejectedValue(error);

      render(<SoAPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate SoA \(Excel\)/ })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /Generate SoA \(Excel\)/ });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Failed to generate SoA export')).toBeInTheDocument();
      });
    });

    it('should prevent export for non-admin/editor users', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: mockStaffUser,
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
        isAuthenticated: true,
        roleOverride: null,
        setRoleOverride: vi.fn(),
        getEffectiveRole: vi.fn(() => 'STAFF' as const),
        departmentOverride: null,
        setDepartmentOverride: vi.fn(),
        getUserDepartment: vi.fn(() => null),
      } as ReturnType<typeof useAuth>);

      render(<SoAPage />);

      await waitFor(() => {
        expect(screen.getByText('You do not have permission to access this page.')).toBeInTheDocument();
      });

      // Should not be able to see export button
      expect(screen.queryByRole('button', { name: /Generate SoA \(Excel\)/ })).not.toBeInTheDocument();
    });
  });
});

