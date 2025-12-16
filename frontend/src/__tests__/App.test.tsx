import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import App from '../App';

// Store initial path for router mock
let testInitialPath = '/';

// Mock BrowserRouter to use MemoryRouter for testing
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => {
      return (
        <MemoryRouter
          initialEntries={[testInitialPath]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          {children}
        </MemoryRouter>
      );
    },
  };
});

// Mock all page components
vi.mock('../pages/HomePage', () => ({
  HomePage: () => <div data-testid="home-page">HomePage</div>,
}));

vi.mock('../pages/LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page">LoginPage</div>,
}));

vi.mock('../pages/ProfilePage', () => ({
  ProfilePage: () => <div data-testid="profile-page">ProfilePage</div>,
}));

vi.mock('../pages/DocumentsPage', () => ({
  DocumentsPage: () => <div data-testid="documents-page">DocumentsPage</div>,
}));

vi.mock('../pages/AcknowledgmentPage', () => ({
  AcknowledgmentPage: () => <div data-testid="acknowledgment-page">AcknowledgmentPage</div>,
}));

vi.mock('../pages/ReviewsPage', () => ({
  ReviewsPage: () => <div data-testid="reviews-page">ReviewsPage</div>,
}));

vi.mock('../pages/RisksPage', () => ({
  RisksPage: () => <div data-testid="risks-page">RisksPage</div>,
}));

vi.mock('../pages/ControlsPage', () => ({
  ControlsPage: () => <div data-testid="controls-page">ControlsPage</div>,
}));

vi.mock('../pages/SoAPage', () => ({
  SoAPage: () => <div data-testid="soa-page">SoAPage</div>,
}));

vi.mock('../pages/MassImportPage', () => ({
  MassImportPage: () => <div data-testid="mass-import-page">MassImportPage</div>,
}));

vi.mock('../pages/AssetsPage', () => ({
  AssetsPage: () => <div data-testid="assets-page">AssetsPage</div>,
}));

vi.mock('../pages/AssetCategoriesPage', () => ({
  AssetCategoriesPage: () => <div data-testid="asset-categories-page">AssetCategoriesPage</div>,
}));

vi.mock('../pages/InterestedPartiesPage', () => ({
  InterestedPartiesPage: () => <div data-testid="interested-parties-page">InterestedPartiesPage</div>,
}));

vi.mock('../pages/LegislationPage', () => ({
  LegislationPage: () => <div data-testid="legislation-page">LegislationPage</div>,
}));

vi.mock('../pages/SuppliersPage', () => ({
  SuppliersPage: () => <div data-testid="suppliers-page">SuppliersPage</div>,
}));

vi.mock('../pages/SupplierDetailPage', () => ({
  SupplierDetailPage: () => <div data-testid="supplier-detail-page">SupplierDetailPage</div>,
}));

vi.mock('../pages/StaffHomePage', () => ({
  StaffHomePage: () => <div data-testid="staff-home-page">StaffHomePage</div>,
}));

vi.mock('../pages/StaffAcknowledgmentPage', () => ({
  StaffAcknowledgmentPage: () => <div data-testid="staff-acknowledgment-page">StaffAcknowledgmentPage</div>,
}));

vi.mock('../pages/StaffDocumentsPage', () => ({
  StaffDocumentsPage: () => <div data-testid="staff-documents-page">StaffDocumentsPage</div>,
}));

vi.mock('../pages/UnauthorizedPage', () => ({
  UnauthorizedPage: () => <div data-testid="unauthorized-page">UnauthorizedPage</div>,
}));

vi.mock('../pages/UsersPage', () => ({
  UsersPage: () => <div data-testid="users-page">UsersPage</div>,
}));

vi.mock('../pages/TrustCenterPage', () => ({
  TrustCenterPage: () => <div data-testid="trust-center-page">TrustCenterPage</div>,
}));

vi.mock('../pages/TrustCenterLoginPage', () => ({
  TrustCenterLoginPage: () => <div data-testid="trust-center-login-page">TrustCenterLoginPage</div>,
}));

vi.mock('../pages/TrustCenterAdminPage', () => ({
  TrustCenterAdminPage: () => <div data-testid="trust-center-admin-page">TrustCenterAdminPage</div>,
}));

// Mock components
vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('../components/DepartmentRiskTable', () => ({
  DepartmentRiskTable: () => <div data-testid="department-risk-table">DepartmentRiskTable</div>,
}));

vi.mock('../components/RiskReviewQueue', () => ({
  RiskReviewQueue: () => <div data-testid="risk-review-queue">RiskReviewQueue</div>,
}));

// Mock contexts
const mockAuthContext = {
  user: null,
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: false,
  roleOverride: null,
  setRoleOverride: vi.fn(),
  getEffectiveRole: vi.fn<[], 'ADMIN' | 'EDITOR' | 'STAFF' | 'CONTRIBUTOR' | null>(() => null),
  departmentOverride: null,
  setDepartmentOverride: vi.fn(),
  getUserDepartment: vi.fn(() => null),
};

const mockTrustAuthContext = {
  user: null,
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: false,
  hasAcceptedTerms: false,
  refreshUser: vi.fn(),
};

vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext');
  return {
    ...actual, // Preserves AuthProvider export
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => mockAuthContext,
  };
});

vi.mock('../contexts/TrustAuthContext', () => ({
  TrustAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useTrustAuth: () => mockTrustAuthContext,
}));

// Mock ProtectedRoute
vi.mock('../components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) => {
    const { isAuthenticated, loading, getEffectiveRole } = mockAuthContext;

    if (loading) {
      return <div data-testid="loading">Loading...</div>;
    }

    if (!isAuthenticated) {
      return <div data-testid="redirect-to-login">Redirect to login</div>;
    }

    if (requiredRole) {
      const roleHierarchy: Record<string, number> = {
        STAFF: 1,
        CONTRIBUTOR: 1.5,
        EDITOR: 2,
        ADMIN: 3,
      };

      const effectiveRole = getEffectiveRole();
      const userRoleLevel = roleHierarchy[effectiveRole || 'STAFF'] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

      if (requiredRole === 'CONTRIBUTOR' && effectiveRole !== 'CONTRIBUTOR') {
        return <div data-testid="redirect-to-unauthorized">Redirect to unauthorized</div>;
      }

      if (userRoleLevel < requiredRoleLevel) {
        return <div data-testid="redirect-to-unauthorized">Redirect to unauthorized</div>;
      }
    }

    return <>{children}</>;
  },
}));

// Mock StaffOnlyRoute
vi.mock('../components/StaffOnlyRoute', () => ({
  StaffOnlyRoute: ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, loading, getEffectiveRole } = mockAuthContext;

    if (loading) {
      return <div data-testid="loading">Loading...</div>;
    }

    if (!isAuthenticated) {
      return <div data-testid="redirect-to-login">Redirect to login</div>;
    }

    const effectiveRole = getEffectiveRole();
    if (effectiveRole !== 'STAFF' && effectiveRole !== 'CONTRIBUTOR') {
      return <div data-testid="redirect-to-admin">Redirect to admin</div>;
    }

    return <>{children}</>;
  },
}));

// Mock auth service
vi.mock('../services/authService', () => ({
  authService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(false),
  },
  msalInstance: {
    handleRedirectPromise: vi.fn().mockResolvedValue(null),
  },
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(() => ({
      post: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn(), eject: vi.fn() },
        response: { use: vi.fn(), eject: vi.fn() },
      },
    })),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  },
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth context to default unauthenticated state
    mockAuthContext.user = null;
    mockAuthContext.loading = false;
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.getEffectiveRole.mockReturnValue(null);
    mockTrustAuthContext.user = null;
    mockTrustAuthContext.loading = false;
    mockTrustAuthContext.isAuthenticated = false;
  });

  const renderApp = (initialPath: string) => {
    // Set the initial path for the mocked BrowserRouter
    testInitialPath = initialPath;
    return render(
      <ChakraProvider>
        <App />
      </ChakraProvider>
    );
  };

  describe('Trust Center Routes (Public-facing)', () => {
    it('should render TrustCenterPage at root path "/"', () => {
      // Arrange & Act
      renderApp('/');

      // Assert
      expect(screen.getByTestId('trust-center-page')).toBeInTheDocument();
    });

    it('should render TrustCenterLoginPage at "/login"', () => {
      // Arrange & Act
      renderApp('/login');

      // Assert
      expect(screen.getByTestId('trust-center-login-page')).toBeInTheDocument();
    });

    it('should render UnauthorizedPage at "/unauthorized"', () => {
      // Arrange & Act
      renderApp('/unauthorized');

      // Assert
      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    });
  });

  describe('ISMS Admin Routes - Authentication', () => {
    it('should render LoginPage at "/admin/login"', () => {
      // Arrange & Act
      renderApp('/admin/login');

      // Assert
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('should redirect to login when accessing protected route without authentication', () => {
      // Arrange
      mockAuthContext.isAuthenticated = false;

      // Act
      renderApp('/admin');

      // Assert
      expect(screen.getByTestId('redirect-to-login')).toBeInTheDocument();
      expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
    });

    it('should render HomePage at "/admin" when authenticated', () => {
      // Arrange
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.getEffectiveRole.mockReturnValue('ADMIN');

      // Act
      renderApp('/admin');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
  });

  describe('ISMS Admin Routes - Documents', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.getEffectiveRole.mockReturnValue('ADMIN');
    });

    it('should render DocumentsPage at "/admin/documents/documents"', () => {
      // Arrange & Act
      renderApp('/admin/documents/documents');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('documents-page')).toBeInTheDocument();
    });

    it('should render MassImportPage at "/admin/documents/documents/import"', () => {
      // Arrange & Act
      renderApp('/admin/documents/documents/import');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('mass-import-page')).toBeInTheDocument();
    });

    it('should require EDITOR role for MassImportPage', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('CONTRIBUTOR');

      // Act
      renderApp('/admin/documents/documents/import');

      // Assert
      expect(screen.getByTestId('redirect-to-unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('mass-import-page')).not.toBeInTheDocument();
    });

    it('should allow EDITOR role to access MassImportPage', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('EDITOR');

      // Act
      renderApp('/admin/documents/documents/import');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('mass-import-page')).toBeInTheDocument();
    });

    it('should render AcknowledgmentPage at "/admin/documents/acknowledgments"', () => {
      // Arrange & Act
      renderApp('/admin/documents/acknowledgments');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('acknowledgment-page')).toBeInTheDocument();
    });

    it('should render ReviewsPage at "/admin/documents/reviews"', () => {
      // Arrange & Act
      renderApp('/admin/documents/reviews');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('reviews-page')).toBeInTheDocument();
    });
  });

  describe('ISMS Admin Routes - Risks', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.getEffectiveRole.mockReturnValue('ADMIN');
    });

    it('should render RisksPage at "/admin/risks/risks"', () => {
      // Arrange & Act
      renderApp('/admin/risks/risks');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('risks-page')).toBeInTheDocument();
    });

    it('should render DepartmentRiskTable at "/admin/risks/department" for CONTRIBUTOR', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('CONTRIBUTOR');

      // Act
      renderApp('/admin/risks/department');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('department-risk-table')).toBeInTheDocument();
    });

    it('should require CONTRIBUTOR role for DepartmentRiskTable', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('STAFF');

      // Act
      renderApp('/admin/risks/department');

      // Assert
      expect(screen.getByTestId('redirect-to-unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('department-risk-table')).not.toBeInTheDocument();
    });

    it('should allow CONTRIBUTOR role to access DepartmentRiskTable', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('CONTRIBUTOR');

      // Act
      renderApp('/admin/risks/department');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('department-risk-table')).toBeInTheDocument();
    });

    it('should render RiskReviewQueue at "/admin/risks/review"', () => {
      // Arrange & Act
      renderApp('/admin/risks/review');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('risk-review-queue')).toBeInTheDocument();
    });

    it('should render ControlsPage at "/admin/risks/controls"', () => {
      // Arrange & Act
      renderApp('/admin/risks/controls');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('controls-page')).toBeInTheDocument();
    });

    it('should render SoAPage at "/admin/soa"', () => {
      // Arrange & Act
      renderApp('/admin/soa');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('soa-page')).toBeInTheDocument();
    });

    it('should render InterestedPartiesPage at "/admin/risks/interested-parties"', () => {
      // Arrange & Act
      renderApp('/admin/risks/interested-parties');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('interested-parties-page')).toBeInTheDocument();
    });

    it('should render LegislationPage at "/admin/risks/legislation"', () => {
      // Arrange & Act
      renderApp('/admin/risks/legislation');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('legislation-page')).toBeInTheDocument();
    });
  });

  describe('ISMS Admin Routes - Assets', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.getEffectiveRole.mockReturnValue('ADMIN');
    });

    it('should render AssetsPage at "/admin/assets/assets"', () => {
      // Arrange & Act
      renderApp('/admin/assets/assets');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('assets-page')).toBeInTheDocument();
    });

    it('should render AssetCategoriesPage at "/admin/assets/asset-categories"', () => {
      // Arrange & Act
      renderApp('/admin/assets/asset-categories');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('asset-categories-page')).toBeInTheDocument();
    });
  });

  describe('ISMS Admin Routes - Suppliers', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.getEffectiveRole.mockReturnValue('EDITOR');
    });

    it('should render SuppliersPage at "/admin/suppliers"', () => {
      // Arrange & Act
      renderApp('/admin/suppliers');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('suppliers-page')).toBeInTheDocument();
    });

    it('should require EDITOR role for SuppliersPage', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('CONTRIBUTOR');

      // Act
      renderApp('/admin/suppliers');

      // Assert
      expect(screen.getByTestId('redirect-to-unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('suppliers-page')).not.toBeInTheDocument();
    });

    it('should render SupplierDetailPage at "/admin/suppliers/:id"', () => {
      // Arrange & Act
      renderApp('/admin/suppliers/123');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('supplier-detail-page')).toBeInTheDocument();
    });

    it('should require EDITOR role for SupplierDetailPage', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('CONTRIBUTOR');

      // Act
      renderApp('/admin/suppliers/123');

      // Assert
      expect(screen.getByTestId('redirect-to-unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('supplier-detail-page')).not.toBeInTheDocument();
    });
  });

  describe('ISMS Admin Routes - Profile and Users', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.getEffectiveRole.mockReturnValue('ADMIN');
    });

    it('should render ProfilePage at "/admin/profile"', () => {
      // Arrange & Act
      renderApp('/admin/profile');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    });

    it('should render UsersPage at "/admin/users"', () => {
      // Arrange & Act
      renderApp('/admin/users');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('users-page')).toBeInTheDocument();
    });

    it('should require ADMIN role for UsersPage', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('EDITOR');

      // Act
      renderApp('/admin/users');

      // Assert
      expect(screen.getByTestId('redirect-to-unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('users-page')).not.toBeInTheDocument();
    });

    it('should render TrustCenterAdminPage at "/admin/trust"', () => {
      // Arrange & Act
      renderApp('/admin/trust');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('trust-center-admin-page')).toBeInTheDocument();
    });

    it('should require EDITOR role for TrustCenterAdminPage', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('CONTRIBUTOR');

      // Act
      renderApp('/admin/trust');

      // Assert
      expect(screen.getByTestId('redirect-to-unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('trust-center-admin-page')).not.toBeInTheDocument();
    });
  });

  describe('Staff-only Routes', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
    });

    it('should render StaffHomePage at "/admin/staff" for STAFF role', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('STAFF');

      // Act
      renderApp('/admin/staff');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('staff-home-page')).toBeInTheDocument();
    });

    it('should render StaffHomePage at "/admin/staff" for CONTRIBUTOR role', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('CONTRIBUTOR');

      // Act
      renderApp('/admin/staff');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('staff-home-page')).toBeInTheDocument();
    });

    it('should redirect ADMIN users away from staff routes', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('ADMIN');

      // Act
      renderApp('/admin/staff');

      // Assert
      expect(screen.getByTestId('redirect-to-admin')).toBeInTheDocument();
      expect(screen.queryByTestId('staff-home-page')).not.toBeInTheDocument();
    });

    it('should redirect EDITOR users away from staff routes', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('EDITOR');

      // Act
      renderApp('/admin/staff');

      // Assert
      expect(screen.getByTestId('redirect-to-admin')).toBeInTheDocument();
      expect(screen.queryByTestId('staff-home-page')).not.toBeInTheDocument();
    });

    it('should render StaffAcknowledgmentPage at "/admin/staff/acknowledgments" for STAFF role', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('STAFF');

      // Act
      renderApp('/admin/staff/acknowledgments');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('staff-acknowledgment-page')).toBeInTheDocument();
    });

    it('should render StaffDocumentsPage at "/admin/staff/documents" for STAFF role', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('STAFF');

      // Act
      renderApp('/admin/staff/documents');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('staff-documents-page')).toBeInTheDocument();
    });

    it('should redirect to login when accessing staff routes without authentication', () => {
      // Arrange
      mockAuthContext.isAuthenticated = false;

      // Act
      renderApp('/admin/staff');

      // Assert
      expect(screen.getByTestId('redirect-to-login')).toBeInTheDocument();
      expect(screen.queryByTestId('staff-home-page')).not.toBeInTheDocument();
    });
  });

  describe('Role-based Access Control', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
    });

    it('should allow ADMIN to access all routes requiring EDITOR', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('ADMIN');

      // Act
      renderApp('/admin/suppliers');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('suppliers-page')).toBeInTheDocument();
    });

    it('should not allow ADMIN to access CONTRIBUTOR-only routes', () => {
      // Arrange
      // CONTRIBUTOR routes are restricted to CONTRIBUTOR role only per ProtectedRoute logic
      mockAuthContext.getEffectiveRole.mockReturnValue('ADMIN');

      // Act
      renderApp('/admin/risks/department');

      // Assert
      expect(screen.getByTestId('redirect-to-unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('department-risk-table')).not.toBeInTheDocument();
    });

    it('should allow EDITOR to access routes requiring EDITOR', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('EDITOR');

      // Act
      renderApp('/admin/suppliers');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('suppliers-page')).toBeInTheDocument();
    });

    it('should not allow EDITOR to access routes requiring ADMIN', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('EDITOR');

      // Act
      renderApp('/admin/users');

      // Assert
      expect(screen.getByTestId('redirect-to-unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('users-page')).not.toBeInTheDocument();
    });

    it('should not allow CONTRIBUTOR to access routes requiring EDITOR', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('CONTRIBUTOR');

      // Act
      renderApp('/admin/suppliers');

      // Assert
      expect(screen.getByTestId('redirect-to-unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('suppliers-page')).not.toBeInTheDocument();
    });

    it('should not allow STAFF to access routes requiring CONTRIBUTOR', () => {
      // Arrange
      mockAuthContext.getEffectiveRole.mockReturnValue('STAFF');

      // Act
      renderApp('/admin/risks/department');

      // Assert
      expect(screen.getByTestId('redirect-to-unauthorized')).toBeInTheDocument();
      expect(screen.queryByTestId('department-risk-table')).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state when auth is loading', () => {
      // Arrange
      mockAuthContext.loading = true;

      // Act
      renderApp('/admin');

      // Assert
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('should show loading state for protected routes when auth is loading', () => {
      // Arrange
      mockAuthContext.loading = true;

      // Act
      renderApp('/admin/documents/documents');

      // Assert
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });
  });

  describe('Route Structure', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.getEffectiveRole.mockReturnValue('ADMIN');
    });

    it('should wrap all admin routes with Layout component', () => {
      // Arrange & Act
      renderApp('/admin');

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    it('should wrap all protected routes with ProtectedRoute', () => {
      // Arrange
      mockAuthContext.isAuthenticated = false;

      // Act
      renderApp('/admin');

      // Assert
      expect(screen.getByTestId('redirect-to-login')).toBeInTheDocument();
    });

    it('should not wrap Trust Center routes with Layout', () => {
      // Arrange & Act
      renderApp('/');

      // Assert
      expect(screen.queryByTestId('layout')).not.toBeInTheDocument();
      expect(screen.getByTestId('trust-center-page')).toBeInTheDocument();
    });
  });
});

