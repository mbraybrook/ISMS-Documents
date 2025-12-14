import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, render as rtlRender } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { ProtectedRoute } from '../ProtectedRoute';

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

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEffectiveRole.mockReturnValue('ADMIN');
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
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.getByText('Loading...')).toBeInTheDocument();
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
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Authentication', () => {
    it('should redirect to login when user is not authenticated', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
        ['/protected']
      );

      // Assert
      // Navigate component doesn't render visible content, but we can check that children are not rendered
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should render children when user is authenticated and no role required', () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('Role-Based Access Control - ADMIN', () => {
    it('should allow ADMIN to access ADMIN routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('ADMIN');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="ADMIN">
          <div>Admin Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });

    it('should allow ADMIN to access EDITOR routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('ADMIN');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="EDITOR">
          <div>Editor Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.getByText('Editor Content')).toBeInTheDocument();
    });

    it('should allow ADMIN to access STAFF routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('ADMIN');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="STAFF">
          <div>Staff Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.getByText('Staff Content')).toBeInTheDocument();
    });

    it('should not allow ADMIN to access CONTRIBUTOR routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('ADMIN');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="CONTRIBUTOR">
          <div>Contributor Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.queryByText('Contributor Content')).not.toBeInTheDocument();
    });
  });

  describe('Role-Based Access Control - EDITOR', () => {
    it('should allow EDITOR to access EDITOR routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('EDITOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="EDITOR">
          <div>Editor Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.getByText('Editor Content')).toBeInTheDocument();
    });

    it('should allow EDITOR to access STAFF routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('EDITOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="STAFF">
          <div>Staff Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.getByText('Staff Content')).toBeInTheDocument();
    });

    it('should not allow EDITOR to access ADMIN routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('EDITOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="ADMIN">
          <div>Admin Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });

    it('should not allow EDITOR to access CONTRIBUTOR routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('EDITOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="CONTRIBUTOR">
          <div>Contributor Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.queryByText('Contributor Content')).not.toBeInTheDocument();
    });
  });

  describe('Role-Based Access Control - STAFF', () => {
    it('should allow STAFF to access STAFF routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('STAFF');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="STAFF">
          <div>Staff Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.getByText('Staff Content')).toBeInTheDocument();
    });

    it('should not allow STAFF to access ADMIN routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('STAFF');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="ADMIN">
          <div>Admin Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });

    it('should not allow STAFF to access EDITOR routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('STAFF');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="EDITOR">
          <div>Editor Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.queryByText('Editor Content')).not.toBeInTheDocument();
    });

    it('should not allow STAFF to access CONTRIBUTOR routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('STAFF');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="CONTRIBUTOR">
          <div>Contributor Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.queryByText('Contributor Content')).not.toBeInTheDocument();
    });
  });

  describe('Role-Based Access Control - CONTRIBUTOR', () => {
    it('should allow CONTRIBUTOR to access CONTRIBUTOR routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('CONTRIBUTOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="CONTRIBUTOR">
          <div>Contributor Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.getByText('Contributor Content')).toBeInTheDocument();
    });

    it('should not allow CONTRIBUTOR to access ADMIN routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('CONTRIBUTOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="ADMIN">
          <div>Admin Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });

    it('should not allow CONTRIBUTOR to access EDITOR routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('CONTRIBUTOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="EDITOR">
          <div>Editor Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.queryByText('Editor Content')).not.toBeInTheDocument();
    });

    it('should allow CONTRIBUTOR to access STAFF routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('CONTRIBUTOR');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="STAFF">
          <div>Staff Content</div>
        </ProtectedRoute>
      );

      // Assert
      // CONTRIBUTOR (1.5) >= STAFF (1), so access is allowed
      expect(screen.getByText('Staff Content')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null effective role by defaulting to STAFF level', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue(null);
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="STAFF">
          <div>Staff Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.getByText('Staff Content')).toBeInTheDocument();
    });

    it('should not allow null effective role to access EDITOR routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue(null);
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="EDITOR">
          <div>Editor Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.queryByText('Editor Content')).not.toBeInTheDocument();
    });

    it('should not allow null effective role to access ADMIN routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue(null);
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="ADMIN">
          <div>Admin Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });

    it('should not allow null effective role to access CONTRIBUTOR routes', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue(null);
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="CONTRIBUTOR">
          <div>Contributor Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.queryByText('Contributor Content')).not.toBeInTheDocument();
    });

    it('should handle undefined effective role by defaulting to STAFF level', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue(undefined);
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="STAFF">
          <div>Staff Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(screen.getByText('Staff Content')).toBeInTheDocument();
    });

    it('should call getEffectiveRole when role is required', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('ADMIN');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute requiredRole="ADMIN">
          <div>Admin Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(mockGetEffectiveRole).toHaveBeenCalled();
    });

    it('should not call getEffectiveRole when no role is required', () => {
      // Arrange
      mockGetEffectiveRole.mockReturnValue('ADMIN');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        loading: false,
        getEffectiveRole: mockGetEffectiveRole,
      });

      // Act
      renderWithRouter(
        <ProtectedRoute>
          <div>Content</div>
        </ProtectedRoute>
      );

      // Assert
      expect(mockGetEffectiveRole).not.toHaveBeenCalled();
    });
  });
});
