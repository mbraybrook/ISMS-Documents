import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, render as rtlRender } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { StaffOnlyRoute } from '../StaffOnlyRoute';

// Mock useAuth hook
const mockGetEffectiveRole = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual, // Preserves AuthProvider export
    useAuth: () => mockUseAuth(),
  };
});

// Helper to create wrapper with MemoryRouter for navigation testing
// Note: We can't use the standardized render from test/utils here because
// it includes BrowserRouter, and we need MemoryRouter for initialEntries testing
const renderWithRouter = (ui: React.ReactElement, initialEntries = ['/']) => {
  return rtlRender(
    <ChakraProvider>
      <MemoryRouter initialEntries={initialEntries} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {ui}
      </MemoryRouter>
    </ChakraProvider>
  );
};

describe('StaffOnlyRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEffectiveRole.mockReturnValue('STAFF');
  });

  describe('Loading State', () => {
    it('should show spinner when loading is true', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        loading: true,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>
      );

      // Assert
      // Spinner is rendered via Chakra UI's Spinner component
      // We can check that children are not rendered during loading
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
    });

    it('should not render children when loading is true', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        loading: true,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>
      );

      // Assert
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
    });

    it('should render loading UI when loading is true', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        loading: true,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      const { container } = renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>
      );

      // Assert
      // Verify that container has content (loading spinner) but not children
      expect(container.firstChild).toBeTruthy();
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
    });
  });

  describe('Authentication', () => {
    it('should redirect to /admin/login when user is not authenticated', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>,
        ['/staff-route']
      );

      // Assert
      // Navigate component doesn't render visible content, but we can check that children are not rendered
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
    });

    it('should not render children when user is not authenticated', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>
      );

      // Assert
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
    });
  });

  describe('Role-Based Access Control - STAFF', () => {
    it('should allow STAFF to access staff routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('STAFF');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>
      );

      // Assert
      expect(screen.getByText('Staff Content')).toBeInTheDocument();
    });

    it('should render children when user has STAFF role', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('STAFF');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Dashboard</div>
        </StaffOnlyRoute>
      );

      // Assert
      expect(screen.getByText('Staff Dashboard')).toBeInTheDocument();
    });
  });

  describe('Role-Based Access Control - CONTRIBUTOR', () => {
    it('should allow CONTRIBUTOR to access staff routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('CONTRIBUTOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>
      );

      // Assert
      expect(screen.getByText('Staff Content')).toBeInTheDocument();
    });

    it('should render children when user has CONTRIBUTOR role', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('CONTRIBUTOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Contributor Dashboard</div>
        </StaffOnlyRoute>
      );

      // Assert
      expect(screen.getByText('Contributor Dashboard')).toBeInTheDocument();
    });
  });

  describe('Role-Based Access Control - ADMIN', () => {
    it('should redirect ADMIN to /admin when accessing staff routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('ADMIN');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>,
        ['/staff-route']
      );

      // Assert
      // Navigate component redirects, so children should not be rendered
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
    });

    it('should not render children when user has ADMIN role', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('ADMIN');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>
      );

      // Assert
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
    });
  });

  describe('Role-Based Access Control - EDITOR', () => {
    it('should redirect EDITOR to /admin when accessing staff routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('EDITOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>,
        ['/staff-route']
      );

      // Assert
      // Navigate component redirects, so children should not be rendered
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
    });

    it('should not render children when user has EDITOR role', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('EDITOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>
      );

      // Assert
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should redirect to /admin when effective role is null', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue(null);
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>,
        ['/staff-route']
      );

      // Assert
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
    });

    it('should redirect to /admin when effective role is undefined', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue(undefined);
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>,
        ['/staff-route']
      );

      // Assert
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
    });

    it('should call getEffectiveRole when checking access', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('STAFF');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>
      );

      // Assert
      expect(mockGetEffectiveRole).toHaveBeenCalled();
    });

    it('should handle multiple children correctly', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('STAFF');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>First Child</div>
          <div>Second Child</div>
          <div>Third Child</div>
        </StaffOnlyRoute>
      );

      // Assert
      expect(screen.getByText('First Child')).toBeInTheDocument();
      expect(screen.getByText('Second Child')).toBeInTheDocument();
      expect(screen.getByText('Third Child')).toBeInTheDocument();
    });

    it('should handle complex nested children', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('CONTRIBUTOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>
            <h1>Staff Dashboard</h1>
            <p>Welcome to the staff area</p>
            <button>Action Button</button>
          </div>
        </StaffOnlyRoute>
      );

      // Assert
      expect(screen.getByText('Staff Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Welcome to the staff area')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
    });
  });

  describe('Component Behavior', () => {
    it('should check authentication before checking role', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('STAFF');
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>
      );

      // Assert
      // Should redirect to login, not check role
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
      // getEffectiveRole should not be called when not authenticated
      expect(mockGetEffectiveRole).not.toHaveBeenCalled();
    });

    it('should check role only when authenticated', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('STAFF');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>
      );

      // Assert
      expect(mockGetEffectiveRole).toHaveBeenCalled();
      expect(screen.getByText('Staff Content')).toBeInTheDocument();
    });

    it('should handle loading state independently of authentication', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('STAFF');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: true,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <StaffOnlyRoute>
          <div>Staff Content</div>
        </StaffOnlyRoute>
      );

      // Assert
      // Should show loading spinner, not check role or render children
      expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
      expect(mockGetEffectiveRole).not.toHaveBeenCalled();
    });
  });
});

