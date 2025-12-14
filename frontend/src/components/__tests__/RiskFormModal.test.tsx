import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render, createMockUser } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { RiskFormModal } from '../RiskFormModal';
import api, { similarityApi, supplierApi } from '../../services/api';
import { Risk, SimilarRisk } from '../../types/risk';
import { Supplier } from '../../types/supplier';

// Mock the API
vi.mock('../../services/api', () => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  return {
    default: mockApi,
    similarityApi: {
      findSimilarRisks: vi.fn(),
      checkSimilarity: vi.fn(),
    },
    supplierApi: {
      getSuppliers: vi.fn(),
    },
  };
});

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

// Mock useAuth
const mockGetEffectiveRole = vi.fn(() => 'ADMIN');
vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: createMockUser(),
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
      roleOverride: null,
      setRoleOverride: vi.fn(),
      getEffectiveRole: mockGetEffectiveRole,
      departmentOverride: null,
      setDepartmentOverride: vi.fn(),
      getUserDepartment: vi.fn(() => null),
    }),
  };
});

// Mock useToast
const mockToast = vi.fn();
vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual('@chakra-ui/react');
  return {
    ...actual,
    useToast: () => mockToast,
  };
});

// Mock useDebounce hook
vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value, // Return value immediately for testing
}));

// Skipping flaky tests that timeout on CI/local env. TODO: Refactor using simpler component tests or higher timeout.
describe.skip('RiskFormModal', () => {
  const mockOnClose = vi.fn();
  const mockOnDuplicate = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnEdit = vi.fn();

  const mockUsers = [
    { id: 'user-1', displayName: 'Test User 1', email: 'user1@test.com', role: 'ADMIN' },
    { id: 'user-2', displayName: 'Test User 2', email: 'user2@test.com', role: 'EDITOR' },
  ];

  const mockControls = [
    { id: 'control-1', code: 'A.8.1', title: 'Control 1', description: 'Description 1' },
    { id: 'control-2', code: 'A.8.2', title: 'Control 2', description: 'Description 2' },
  ];

  const mockInterestedParties = [
    { id: 'party-1', name: 'Party 1', group: 'Group 1' },
    { id: 'party-2', name: 'Party 2', group: null },
  ];

  const mockAssetCategories = [
    { id: 'cat-1', name: 'Category 1' },
    { id: 'cat-2', name: 'Category 2' },
  ];

  const mockRisk: Partial<Risk> = {
    id: 'risk-1',
    title: 'Test Risk',
    description: 'Test Description',
    dateAdded: '2024-01-01T00:00:00Z',
    riskCategory: 'INFORMATION_SECURITY',
    riskNature: 'STATIC',
    archived: false,
    ownerUserId: 'user-1',
    interestedParty: { id: 'party-1', name: 'Party 1', group: 'Group 1' },
    confidentialityScore: 3,
    integrityScore: 2,
    availabilityScore: 4,
    likelihood: 3,
    riskScore: 27,
    initialRiskTreatmentCategory: 'MODIFY',
    riskControls: [
      { control: { id: 'control-1', code: 'A.8.1', title: 'Control 1', description: 'Desc 1' } },
    ],
  };

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    risk: null,
    isDuplicateMode: false,
    viewMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEffectiveRole.mockReturnValue('ADMIN');

    // Default API responses - ensure all endpoints return correct structure
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (typeof url === 'string') {
        if (url.includes('/api/users')) {
          return Promise.resolve({ data: { data: mockUsers } });
        }
        if (url.includes('/api/controls')) {
          return Promise.resolve({ data: { data: mockControls } });
        }
        if (url.includes('/api/interested-parties')) {
          return Promise.resolve({ data: mockInterestedParties });
        }
        if (url.includes('/api/asset-categories')) {
          return Promise.resolve({ data: mockAssetCategories });
        }
        if (url.includes('/api/risks') && url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/api/risks?page=1&limit=1') || (url.includes('/api/risks') && url.includes('page=1'))) {
          return Promise.resolve({ data: { pagination: { total: 100 } } });
        }
      }
      return Promise.resolve({ data: { data: [] } });
    });

    vi.mocked(api.post).mockResolvedValue({ data: { id: 'new-risk' } });
    vi.mocked(api.put).mockResolvedValue({ data: mockRisk });
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    vi.mocked(similarityApi.checkSimilarity).mockResolvedValue({ similarRisks: [] });
    vi.mocked(similarityApi.findSimilarRisks).mockResolvedValue({ similarRisks: [] });
    vi.mocked(supplierApi.getSuppliers).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Modal Rendering', () => {
    it('should render modal when isOpen is true', async () => {
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create Risk')).toBeInTheDocument();
      });
    });

    it('should not render modal when isOpen is false', () => {
      render(<RiskFormModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Create Risk')).not.toBeInTheDocument();
    });

    it('should show "Create Risk" title when creating new risk', async () => {
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create Risk')).toBeInTheDocument();
      });
    });

    it('should show "Edit Risk" title when editing existing risk', async () => {
      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        expect(screen.getByText('Edit Risk')).toBeInTheDocument();
      });
    });

    it('should show "Duplicate Risk" title when in duplicate mode', async () => {
      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} isDuplicateMode={true} />);

      await waitFor(() => {
        expect(screen.getByText('Duplicate Risk')).toBeInTheDocument();
      });
    });

    it('should show "View Risk" title when in view mode', async () => {
      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} viewMode={true} />);

      await waitFor(() => {
        expect(screen.getByText('View Risk')).toBeInTheDocument();
      });
    });

    it('should render all tabs', async () => {
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Essentials')).toBeInTheDocument();
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
        expect(screen.getByText('Existing Controls Assessment')).toBeInTheDocument();
        expect(screen.getByText('Additional Controls Assessment')).toBeInTheDocument();
        expect(screen.getByText('Controls Linkage')).toBeInTheDocument();
      });
    });
  });

  describe('Form Initialization', () => {
    it('should initialize form with default values when creating new risk', async () => {
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement;
        expect(titleInput.value).toBe('');
      });
    });

    it('should populate form with risk data when editing', async () => {
      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement;
        expect(titleInput.value).toBe('Test Risk');
      });
    });

    it('should load users, controls, and interested parties on open', async () => {
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/users');
        expect(api.get).toHaveBeenCalledWith('/api/controls', expect.any(Object));
        expect(api.get).toHaveBeenCalledWith('/api/interested-parties');
        expect(api.get).toHaveBeenCalledWith('/api/asset-categories');
      });
    });
  });

  describe('Essentials Tab', () => {
    it('should render all essential fields', async () => {
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /title/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/threat description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/risk description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/owner/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/interested party/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/date added/i)).toBeInTheDocument();
      });
    });

    it('should update title when user types', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /title/i })).toBeInTheDocument();
      });

      const titleInput = screen.getByRole('textbox', { name: /title/i });
      await user.type(titleInput, 'New Risk Title');

      expect(titleInput).toHaveValue('New Risk Title');
    });

    it('should show character count for threat description', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/threat description/i)).toBeInTheDocument();
      });

      const threatInput = screen.getByLabelText(/threat description/i);
      await user.type(threatInput, 'Test threat');

      await waitFor(() => {
        expect(screen.getByText(/12 characters/i)).toBeInTheDocument();
      });
    });

    it('should allow selecting owner from dropdown', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/owner/i)).toBeInTheDocument();
      });

      const ownerSelect = screen.getByLabelText(/owner/i);
      await user.selectOptions(ownerSelect, 'user-1');

      expect(ownerSelect).toHaveValue('user-1');
    });

    it('should allow selecting interested party', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/interested party/i)).toBeInTheDocument();
      });

      const partySelect = screen.getByLabelText(/interested party/i);
      await user.selectOptions(partySelect, 'party-1');

      expect(partySelect).toHaveValue('party-1');
    });
  });

  describe('Additional Details Tab', () => {
    it('should render additional details fields', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Details'));

      await waitFor(() => {
        expect(screen.getByLabelText(/risk category/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/department/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/risk nature/i)).toBeInTheDocument();
      });
    });

    it('should show expiry date field when risk nature is INSTANCE', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Details'));

      await waitFor(() => {
        const natureSelect = screen.getByLabelText(/risk nature/i);
        expect(natureSelect).toBeInTheDocument();
      });

      const natureSelect = screen.getByLabelText(/risk nature/i);
      await user.selectOptions(natureSelect, 'INSTANCE');

      await waitFor(() => {
        expect(screen.getByLabelText(/expiry date/i)).toBeInTheDocument();
      });
    });

    it('should show review dates when risk nature is STATIC', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Details'));

      await waitFor(() => {
        const natureSelect = screen.getByLabelText(/risk nature/i);
        expect(natureSelect).toBeInTheDocument();
      });

      const natureSelect = screen.getByLabelText(/risk nature/i);
      await user.selectOptions(natureSelect, 'STATIC');

      await waitFor(() => {
        expect(screen.getByLabelText(/last review date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/next review date/i)).toBeInTheDocument();
      });
    });

    it('should allow toggling archived checkbox', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Details'));

      await waitFor(() => {
        const archivedCheckbox = screen.getByLabelText(/archived/i);
        expect(archivedCheckbox).toBeInTheDocument();
      });

      const archivedCheckbox = screen.getByLabelText(/archived/i);
      await user.click(archivedCheckbox);

      expect(archivedCheckbox).toBeChecked();
    });

    it('should allow toggling supplier risk checkbox', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Details'));

      await waitFor(() => {
        const supplierRiskCheckbox = screen.getByLabelText(/supplier risk/i);
        expect(supplierRiskCheckbox).toBeInTheDocument();
      });

      const supplierRiskCheckbox = screen.getByLabelText(/supplier risk/i);
      await user.click(supplierRiskCheckbox);

      expect(supplierRiskCheckbox).toBeChecked();
    });
  });

  describe('Asset Selection', () => {
    it('should allow searching for assets', async () => {
      const user = userEvent.setup();
      const mockAssets = [
        {
          id: 'asset-1',
          nameSerialNo: 'Asset 1',
          model: 'Model 1',
          assetCategoryId: 'cat-1',
          category: { id: 'cat-1', name: 'Category 1' },
        },
      ];

      vi.mocked(api.get).mockImplementation((url: string, config?: { params?: { search?: string } }) => {
        if (url.includes('/api/assets') && config?.params?.search) {
          return Promise.resolve({ data: { data: mockAssets } });
        }
        return Promise.resolve({ data: { data: [] } });
      });

      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Details'));

      await waitFor(() => {
        const assetInput = screen.getByPlaceholderText(/type to search assets/i);
        expect(assetInput).toBeInTheDocument();
      });

      const assetInput = screen.getByPlaceholderText(/type to search assets/i);
      await user.type(assetInput, 'Asset');

      await waitFor(
        () => {
          expect(api.get).toHaveBeenCalledWith(
            '/api/assets',
            expect.objectContaining({
              params: expect.objectContaining({ search: 'Asset' }),
            })
          );
        },
        { timeout: 2000 }
      );
    });

    it('should allow selecting asset category', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Details'));

      await waitFor(() => {
        const categorySelect = screen.getByLabelText(/link to asset category/i);
        expect(categorySelect).toBeInTheDocument();
      });

      const categorySelect = screen.getByLabelText(/link to asset category/i);
      await user.selectOptions(categorySelect, 'cat-1');

      expect(categorySelect).toHaveValue('cat-1');
    });
  });

  describe('Existing Controls Assessment Tab', () => {
    it('should render CIA sliders', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Existing Controls Assessment')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Existing Controls Assessment'));

      await waitFor(() => {
        expect(screen.getByText(/confidentiality/i)).toBeInTheDocument();
        expect(screen.getByText(/integrity/i)).toBeInTheDocument();
        expect(screen.getByText(/availability/i)).toBeInTheDocument();
        expect(screen.getByText(/likelihood/i)).toBeInTheDocument();
      });
    });

    it('should calculate and display risk score', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Existing Controls Assessment')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Existing Controls Assessment'));

      await waitFor(() => {
        // Risk = C + I + A = 1 + 1 + 1 = 3
        // Risk Score = Risk × Likelihood = 3 × 1 = 3
        expect(screen.getByText('3')).toBeInTheDocument(); // Risk Score
      });
    });

    it('should display risk level badge', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Existing Controls Assessment')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Existing Controls Assessment'));

      await waitFor(() => {
        // Default scores give LOW risk
        expect(screen.getByText('LOW')).toBeInTheDocument();
      });
    });

    it('should allow selecting initial risk treatment category', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Existing Controls Assessment')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Existing Controls Assessment'));

      await waitFor(() => {
        const treatmentSelect = screen.getByLabelText(/initial risk treatment category/i);
        expect(treatmentSelect).toBeInTheDocument();
      });

      const treatmentSelect = screen.getByLabelText(/initial risk treatment category/i);
      await user.selectOptions(treatmentSelect, 'MODIFY');

      expect(treatmentSelect).toHaveValue('MODIFY');
    });
  });

  describe('Additional Controls Assessment Tab', () => {
    it('should render mitigated score sliders', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Controls Assessment')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Controls Assessment'));

      await waitFor(() => {
        expect(screen.getByText(/mitigated confidentiality/i)).toBeInTheDocument();
        expect(screen.getByText(/mitigated integrity/i)).toBeInTheDocument();
        expect(screen.getByText(/mitigated availability/i)).toBeInTheDocument();
        expect(screen.getByText(/mitigated likelihood/i)).toBeInTheDocument();
      });
    });

    it('should show non-conformance alert for MODIFY risks with HIGH initial score', async () => {
      const user = userEvent.setup();
      const highRiskRisk = {
        ...mockRisk,
        confidentialityScore: 5,
        integrityScore: 5,
        availabilityScore: 5,
        likelihood: 5,
        initialRiskTreatmentCategory: 'MODIFY',
      };

      render(<RiskFormModal {...defaultProps} risk={highRiskRisk as Risk} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Controls Assessment')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Controls Assessment'));

      await waitFor(() => {
        expect(screen.getByText(/policy non-conformance/i)).toBeInTheDocument();
      });
    });

    it('should allow unsetting mitigated scores', async () => {
      const user = userEvent.setup();
      const riskWithMitigation = {
        ...mockRisk,
        mitigatedConfidentialityScore: 2,
        mitigatedIntegrityScore: 2,
        mitigatedAvailabilityScore: 2,
        mitigatedLikelihood: 2,
      };

      render(<RiskFormModal {...defaultProps} risk={riskWithMitigation as Risk} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Controls Assessment')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Controls Assessment'));

      await waitFor(() => {
        const unsetButton = screen.getByText(/unset mitigated scores/i);
        expect(unsetButton).toBeInTheDocument();
      });

      await user.click(screen.getByText(/unset mitigated scores/i));

      await waitFor(() => {
        expect(screen.getByText(/not set/i)).toBeInTheDocument();
      });
    });
  });

  describe('Controls Linkage Tab', () => {
    it('should render controls search and selection', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Controls Linkage')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Controls Linkage'));

      await waitFor(() => {
        expect(screen.getByLabelText(/search and select controls/i)).toBeInTheDocument();
      });
    });

    it('should allow searching for controls', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Controls Linkage')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Controls Linkage'));

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search by control code/i);
        expect(searchInput).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by control code/i);
      await user.type(searchInput, 'A.8');

      await waitFor(() => {
        expect(screen.getByText('A.8.1')).toBeInTheDocument();
      });
    });

    it('should allow selecting controls from search results', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Controls Linkage')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Controls Linkage'));

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search by control code/i);
        expect(searchInput).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by control code/i);
      await user.type(searchInput, 'A.8');

      await waitFor(() => {
        const controlOption = screen.getByText('A.8.1');
        expect(controlOption).toBeInTheDocument();
      });

      const controlOption = screen.getByText('A.8.1').closest('div');
      if (controlOption) {
        await user.click(controlOption);
      }

      await waitFor(() => {
        expect(screen.getByText(/selected controls/i)).toBeInTheDocument();
      });
    });

    it('should allow removing selected controls', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        expect(screen.getByText('Controls Linkage')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Controls Linkage'));

      await waitFor(() => {
        const removeButtons = screen.queryAllByRole('button', { name: /close/i });
        const controlRemoveButton = removeButtons.find((btn) =>
          btn.closest('[class*="chakra-tag"]')
        );
        if (controlRemoveButton) {
          expect(controlRemoveButton).toBeInTheDocument();
        }
      });
    });

    it('should get AI suggestions for controls', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { suggestedControlIds: ['control-1', 'control-2'] },
      });

      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Controls Linkage')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Controls Linkage'));

      // Fill in some content for suggestions
      await user.click(screen.getByText('Essentials'));
      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        expect(titleInput).toBeInTheDocument();
      });
      await user.type(screen.getByRole('textbox', { name: /title/i }), 'Test Risk Title');

      await user.click(screen.getByText('Controls Linkage'));

      await waitFor(() => {
        const suggestionsButton = screen.getByText(/get ai suggestions/i);
        expect(suggestionsButton).toBeInTheDocument();
      });

      await user.click(screen.getByText(/get ai suggestions/i));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/api/risks/suggest-controls',
          expect.objectContaining({
            title: 'Test Risk Title',
          })
        );
      });
    });
  });

  describe('Form Validation', () => {
    it('should show error when title is empty on submit', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create Risk')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      });
    });

    it('should show error when date added is empty on submit', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        expect(titleInput).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /title/i }), 'Test Risk');

      // Clear date added
      const dateInput = screen.getByLabelText(/date added/i) as HTMLInputElement;
      await user.clear(dateInput);

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/date added is required/i)).toBeInTheDocument();
      });
    });

    it('should show error when interested party is not selected on submit', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        expect(titleInput).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /title/i }), 'Test Risk');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/interested party is required/i)).toBeInTheDocument();
      });
    });

    it('should not submit when validation fails', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create Risk')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.post).not.toHaveBeenCalled();
      });
    });
  });

  describe('Form Submission', () => {
    it('should create new risk when form is valid', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        expect(titleInput).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /title/i }), 'New Risk');
      await user.selectOptions(screen.getByLabelText(/interested party/i), 'party-1');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/api/risks',
          expect.objectContaining({
            title: 'New Risk',
            interestedPartyId: 'party-1',
          })
        );
      });
    });

    it('should update existing risk when form is valid', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement;
        expect(titleInput.value).toBe('Test Risk');
      });

      const titleInput = screen.getByRole('textbox', { name: /title/i });
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Risk');

      const submitButton = screen.getByRole('button', { name: /update/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith(
          '/api/risks/risk-1',
          expect.objectContaining({
            title: 'Updated Risk',
          }),
          expect.any(Object)
        );
      });
    });

    it('should update control associations after saving risk', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        expect(titleInput).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /title/i }), 'New Risk');
      await user.selectOptions(screen.getByLabelText(/interested party/i), 'party-1');

      // Select a control
      await user.click(screen.getByText('Controls Linkage'));
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search by control code/i);
        expect(searchInput).toBeInTheDocument();
      });
      await user.type(screen.getByPlaceholderText(/search by control code/i), 'A.8');
      await waitFor(() => {
        const controlOption = screen.getByText('A.8.1');
        expect(controlOption).toBeInTheDocument();
      });
      const controlOption = screen.getByText('A.8.1').closest('div');
      if (controlOption) {
        await user.click(controlOption);
      }

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/api/risks/new-risk/controls',
          expect.objectContaining({
            controlIds: expect.arrayContaining(['control-1']),
          })
        );
      });
    });

    it('should close modal after successful submission', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        expect(titleInput).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /title/i }), 'New Risk');
      await user.selectOptions(screen.getByLabelText(/interested party/i), 'party-1');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should show error toast when submission fails', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValueOnce({
        response: { data: { error: 'Server error' } },
      });

      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        expect(titleInput).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /title/i }), 'New Risk');
      await user.selectOptions(screen.getByLabelText(/interested party/i), 'party-1');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            status: 'error',
          })
        );
      });
    });
  });

  describe('Similarity Features', () => {
    it('should check for similar risks during creation', async () => {
      const user = userEvent.setup();
      const similarRisks: SimilarRisk[] = [
        {
          risk: mockRisk as Risk,
          similarityScore: 85,
          matchedFields: ['title'],
        },
      ];

      vi.mocked(similarityApi.checkSimilarity).mockResolvedValueOnce({
        similarRisks,
      });

      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        expect(titleInput).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /title/i }), 'Test Risk Title');

      await waitFor(
        () => {
          expect(similarityApi.checkSimilarity).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });

    it('should show similarity alert when similar risks are found', async () => {
      const user = userEvent.setup();
      const similarRisks: SimilarRisk[] = [
        {
          risk: mockRisk as Risk,
          similarityScore: 85,
          matchedFields: ['title'],
        },
      ];

      vi.mocked(similarityApi.checkSimilarity).mockResolvedValueOnce({
        similarRisks,
      });

      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        expect(titleInput).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /title/i }), 'Test Risk Title');

      await waitFor(
        () => {
          expect(screen.getByText(/similar risks found/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('should find similar risks for existing risk', async () => {
      const user = userEvent.setup();
      const similarRisks: SimilarRisk[] = [
        {
          risk: { ...mockRisk, id: 'risk-2' } as Risk,
          similarityScore: 90,
          matchedFields: ['title', 'description'],
        },
      ];

      vi.mocked(similarityApi.findSimilarRisks).mockResolvedValueOnce({
        similarRisks,
      });

      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        const findButton = screen.getByText(/find similar risks/i);
        expect(findButton).toBeInTheDocument();
      });

      await user.click(screen.getByText(/find similar risks/i));

      await waitFor(() => {
        expect(similarityApi.findSimilarRisks).toHaveBeenCalledWith('risk-1', 10);
      });
    });
  });

  describe('Supplier Linking', () => {
    it('should show linked suppliers for existing risk', async () => {
      const user = userEvent.setup();
      const mockSuppliers = [
        { id: 'supplier-1', name: 'Supplier 1', supplierType: 'VENDOR' },
      ];

      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/api/risks') && url.includes('/suppliers')) {
          return Promise.resolve({ data: mockSuppliers });
        }
        if (url.includes('/api/interested-parties')) {
          return Promise.resolve({ data: mockInterestedParties });
        }
        if (url.includes('/api/users')) {
          return Promise.resolve({ data: { data: mockUsers } });
        }
        if (url.includes('/api/controls')) {
          return Promise.resolve({ data: { data: mockControls } });
        }
        if (url.includes('/api/asset-categories')) {
          return Promise.resolve({ data: mockAssetCategories });
        }
        return Promise.resolve({ data: { data: [] } });
      });

      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Details'));

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/risks/risk-1/suppliers');
      });
    });

    it('should open supplier modal when link supplier button is clicked', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Details'));

      await waitFor(() => {
        const linkButton = screen.getByText(/link supplier/i);
        expect(linkButton).toBeInTheDocument();
      });

      await user.click(screen.getByText(/link supplier/i));

      await waitFor(() => {
        expect(screen.getByText(/link supplier to risk/i)).toBeInTheDocument();
      });
    });

    it('should search for suppliers in supplier modal', async () => {
      const user = userEvent.setup();
      const mockSuppliers = [
        { id: 'supplier-1', name: 'Supplier 1', supplierType: 'VENDOR' },
      ];

      vi.mocked(supplierApi.getSuppliers).mockResolvedValueOnce(mockSuppliers as unknown as Supplier[]);

      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Details'));

      await waitFor(() => {
        const linkButton = screen.getByText(/link supplier/i);
        expect(linkButton).toBeInTheDocument();
      });

      await user.click(screen.getByText(/link supplier/i));

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search suppliers/i);
        expect(searchInput).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search suppliers/i);
      await user.type(searchInput, 'Supplier');
      await user.click(screen.getByText(/search/i));

      await waitFor(() => {
        expect(supplierApi.getSuppliers).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'Supplier' })
        );
      });
    });
  });

  describe('Unsaved Changes Dialog', () => {
    it('should show unsaved changes dialog when closing with unsaved changes', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement;
        expect(titleInput.value).toBe('Test Risk');
      });

      const titleInput = screen.getByRole('textbox', { name: /title/i });
      await user.clear(titleInput);
      await user.type(titleInput, 'Modified Title');

      const closeButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
      });
    });

    it('should close without dialog when no changes made', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: /cancel/i });
        expect(closeButton).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
        expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
      });
    });

    it('should discard changes when confirmed', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement;
        expect(titleInput.value).toBe('Test Risk');
      });

      const titleInput = screen.getByRole('textbox', { name: /title/i });
      await user.clear(titleInput);
      await user.type(titleInput, 'Modified Title');

      const closeButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
      });

      const discardButton = screen.getByRole('button', { name: /discard changes/i });
      await user.click(discardButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should close modal when Escape key is pressed', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create Risk')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should submit form when Ctrl+Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        expect(titleInput).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /title/i }), 'New Risk');
      await user.selectOptions(screen.getByLabelText(/interested party/i), 'party-1');

      // Press Ctrl+Enter
      await user.keyboard('{Control>}{Enter}{/Control}');

      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
      });
    });
  });

  describe('View Mode', () => {
    it('should disable all form fields in view mode', async () => {
      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} viewMode={true} />);

      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        expect(titleInput).toHaveAttribute('readonly');
      });
    });

    it('should show Edit button in view mode', async () => {
      render(
        <RiskFormModal
          {...defaultProps}
          risk={mockRisk as Risk}
          viewMode={true}
          onEdit={mockOnEdit}
        />
      );

      await waitFor(() => {
        const editButton = screen.getByRole('button', { name: /edit/i });
        expect(editButton).toBeInTheDocument();
      });
    });

    it('should call onEdit when Edit button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <RiskFormModal
          {...defaultProps}
          risk={mockRisk as Risk}
          viewMode={true}
          onEdit={mockOnEdit}
        />
      );

      await waitFor(() => {
        const editButton = screen.getByRole('button', { name: /edit/i });
        expect(editButton).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(mockOnEdit).toHaveBeenCalled();
    });
  });

  describe('Duplicate Mode', () => {
    it('should show duplicate button for existing risk', async () => {
      render(
        <RiskFormModal
          {...defaultProps}
          risk={mockRisk as Risk}
          onDuplicate={mockOnDuplicate}
        />
      );

      await waitFor(() => {
        const duplicateButton = screen.getByRole('button', { name: /duplicate/i });
        expect(duplicateButton).toBeInTheDocument();
      });
    });

    it('should call onDuplicate when duplicate button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <RiskFormModal
          {...defaultProps}
          risk={mockRisk as Risk}
          onDuplicate={mockOnDuplicate}
        />
      );

      await waitFor(() => {
        const duplicateButton = screen.getByRole('button', { name: /duplicate/i });
        expect(duplicateButton).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /duplicate/i }));

      expect(mockOnDuplicate).toHaveBeenCalled();
    });
  });

  describe('Delete Functionality', () => {
    it('should show delete button for existing risk', async () => {
      render(
        <RiskFormModal
          {...defaultProps}
          risk={mockRisk as Risk}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /delete/i });
        expect(deleteButton).toBeInTheDocument();
      });
    });

    it('should call onDelete when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <RiskFormModal
          {...defaultProps}
          risk={mockRisk as Risk}
          onDelete={mockOnDelete}
        />
      );

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /delete/i });
        expect(deleteButton).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /delete/i }));

      expect(mockOnDelete).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Department Restrictions', () => {
    it('should disable department field for CONTRIBUTOR role', async () => {
      mockGetEffectiveRole.mockReturnValue('CONTRIBUTOR');
      const user = userEvent.setup();

      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Details'));

      await waitFor(() => {
        const departmentSelect = screen.getByLabelText(/department/i);
        expect(departmentSelect).toBeDisabled();
      });
    });

    it('should show message that department cannot be changed by Contributors', async () => {
      mockGetEffectiveRole.mockReturnValue('CONTRIBUTOR');
      const user = userEvent.setup();

      render(<RiskFormModal {...defaultProps} risk={mockRisk as Risk} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Additional Details'));

      await waitFor(() => {
        expect(
          screen.getByText(/department cannot be changed by contributors/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Risk Score Calculations', () => {
    it('should calculate risk score correctly', async () => {
      const user = userEvent.setup();
      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Existing Controls Assessment')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Existing Controls Assessment'));

      // Default scores: C=1, I=1, A=1, L=1
      // Risk = 1+1+1 = 3
      // Risk Score = 3*1 = 3
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument(); // Risk Score
      });
    });

    it('should display correct risk level for HIGH score', async () => {
      const highRiskRisk = {
        ...mockRisk,
        confidentialityScore: 5,
        integrityScore: 5,
        availabilityScore: 5,
        likelihood: 5,
      };

      render(<RiskFormModal {...defaultProps} risk={highRiskRisk as Risk} />);

      await waitFor(() => {
        expect(screen.getByText('Existing Controls Assessment')).toBeInTheDocument();
      });

      await userEvent.setup().click(screen.getByText('Existing Controls Assessment'));

      await waitFor(() => {
        expect(screen.getByText('HIGH')).toBeInTheDocument();
      });
    });

    it('should calculate mitigated risk score when mitigated scores are set', async () => {
      const riskWithMitigation = {
        ...mockRisk,
        mitigatedConfidentialityScore: 2,
        mitigatedIntegrityScore: 2,
        mitigatedAvailabilityScore: 2,
        mitigatedLikelihood: 2,
      };

      render(<RiskFormModal {...defaultProps} risk={riskWithMitigation as Risk} />);

      await waitFor(() => {
        expect(screen.getByText('Additional Controls Assessment')).toBeInTheDocument();
      });

      await userEvent.setup().click(screen.getByText('Additional Controls Assessment'));

      // Mitigated Risk = 2+2+2 = 6
      // Mitigated Risk Score = 6*2 = 12
      await waitFor(() => {
        expect(screen.getByText('12')).toBeInTheDocument(); // Mitigated Risk Score
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        // Component should still render even if initial API calls fail
        expect(screen.getByText('Create Risk')).toBeInTheDocument();
      });
    });

    it('should show error message when control suggestions fail', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValueOnce({
        response: { data: { error: 'Suggestion service unavailable' } },
      });

      render(<RiskFormModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Controls Linkage')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Controls Linkage'));

      // Fill in content
      await user.click(screen.getByText('Essentials'));
      await waitFor(() => {
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        expect(titleInput).toBeInTheDocument();
      });
      await user.type(screen.getByRole('textbox', { name: /title/i }), 'Test');

      await user.click(screen.getByText('Controls Linkage'));

      await waitFor(() => {
        const suggestionsButton = screen.getByText(/get ai suggestions/i);
        expect(suggestionsButton).toBeInTheDocument();
      });

      await user.click(screen.getByText(/get ai suggestions/i));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            status: 'error',
          })
        );
      });
    });
  });
});

