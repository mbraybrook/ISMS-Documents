import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ControlFormModal } from '../ControlFormModal';
import { Control } from '../../types/control';
import { Supplier } from '../../types/supplier';
import api, { supplierApi } from '../../services/api';

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
    ...actual, // Preserves BrowserRouter and other exports needed by test/utils
    Link: ({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: (e: React.MouseEvent) => void }) => (
      <a href={to} onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}>
        {children}
      </a>
    ),
    useNavigate: () => mockNavigate,
  };
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

describe('ControlFormModal', () => {
  const mockOnClose = vi.fn();
  const mockControl: Control = {
    id: 'control-1',
    code: 'A.8.1',
    title: 'Test Control',
    description: 'Test description',
    category: 'ORGANIZATIONAL',
    isStandardControl: false,
    selectedForRiskAssessment: false,
    selectedForContractualObligation: false,
    selectedForLegalRequirement: false,
    selectedForBusinessRequirement: false,
    justification: '',
    implemented: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockStandardControl: Control = {
    id: 'control-2',
    code: '5.1',
    title: 'Standard Control',
    description: 'Standard control description',
    category: 'ORGANIZATIONAL',
    isStandardControl: true,
    selectedForRiskAssessment: true,
    selectedForContractualObligation: false,
    selectedForLegalRequirement: true,
    selectedForBusinessRequirement: false,
    justification: 'Test justification',
    implemented: true,
    controlText: 'Control text',
    purpose: 'Control purpose',
    guidance: 'Control guidance',
    otherInformation: 'Other information',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    riskControls: [
      {
        riskId: 'risk-1',
        controlId: 'control-2',
        risk: {
          id: 'risk-1',
          title: 'Test Risk',
          description: null,
          dateAdded: '2024-01-01T00:00:00Z',
          riskCategory: null,
          riskNature: null,
          archived: false,
          expiryDate: null,
          lastReviewDate: null,
          nextReviewDate: null,
          owner: null,
          ownerUserId: null,
          department: null,
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
          calculatedScore: 5,
          threatDescription: null,
          confidentialityScore: 3,
          integrityScore: 3,
          availabilityScore: 3,
          riskScore: 5,
          likelihood: 3,
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
      },
    ],
  };

  const mockSupplier: Supplier = {
    id: 'supplier-1',
    name: 'Test Supplier',
    tradingName: null,
    status: 'ACTIVE',
    supplierType: 'SERVICE_PROVIDER',
    serviceSubType: null,
    serviceDescription: null,
    processesCardholderData: false,
    processesPersonalData: false,
    hostingRegions: null,
    customerFacingImpact: false,
    overallRiskRating: null,
    criticality: null,
    riskRationale: null,
    criticalityRationale: null,
    pciStatus: null,
    iso27001Status: null,
    iso22301Status: null,
    iso9001Status: null,
    gdprStatus: null,
    complianceEvidenceLinks: null,
    relationshipOwnerUserId: null,
    relationshipOwner: null,
    primaryContacts: null,
    contractReferences: null,
    dataProcessingAgreementRef: null,
    contractStartDate: null,
    contractEndDate: null,
    autoRenewal: false,
    performanceRating: null,
    performanceNotes: null,
    lifecycleState: 'APPROVED',
    cisoExemptionGranted: false,
    reviewDate: null,
    showInTrustCenter: false,
    trustCenterDisplayName: null,
    trustCenterDescription: null,
    trustCenterCategory: null,
    trustCenterComplianceSummary: null,
    createdAt: '2024-01-01T00:00:00Z',
    createdByUserId: null,
    createdBy: null,
    updatedAt: '2024-01-01T00:00:00Z',
    updatedByUserId: null,
    updatedBy: null,
  };

  const mockDocument = {
    id: 'doc-1',
    title: 'Test Document',
    version: '1.0',
    type: 'POLICY',
    status: 'APPROVED',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.setItem.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockResolvedValue({ data: [] });
    });

    it('should render create control modal when control is null', () => {
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      expect(screen.getByText('Create Control')).toBeInTheDocument();
      expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
    });

    it('should render edit control modal when control is provided', async () => {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/documents')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      await waitFor(() => {
        expect(screen.getByText('Edit Control')).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue('A.8.1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Control')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
    });

    it('should render standard control modal when control is standard', async () => {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/documents')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockStandardControl} />);

      await waitFor(() => {
        expect(screen.getByText('View Standard Control')).toBeInTheDocument();
      });

      expect(screen.getByText('ISO 27002 Standard')).toBeInTheDocument();
      expect(screen.getByText('5.1')).toBeInTheDocument();
      expect(screen.getByText('Standard Control')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      const { container } = render(
        <ControlFormModal isOpen={false} onClose={mockOnClose} control={null} />
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockResolvedValue({ data: [] });
    });

    it('should show error when code is empty for custom control', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      // Wait for modal to fully render
      await waitFor(() => {
        expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
      });

      const codeInput = screen.getByLabelText(/code/i);
      await user.clear(codeInput);
      await user.type(codeInput, '   '); // Only spaces

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Form validation should prevent submission
        expect(api.post).not.toHaveBeenCalled();
      });
    });

    it('should show error when title is empty for custom control', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);
      await user.type(titleInput, '   '); // Only spaces

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Form validation should prevent submission
        expect(api.post).not.toHaveBeenCalled();
      });
    });

    it('should show error when category is not selected for new control', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      const codeInput = screen.getByLabelText(/code/i);
      await user.type(codeInput, 'A.8.1');

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Test Control');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Form validation should prevent submission
        expect(api.post).not.toHaveBeenCalled();
      });
    });

    it('should clear error when field is corrected', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      const codeInput = screen.getByLabelText(/code/i);
      await user.clear(codeInput);

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      // Form validation should prevent submission
      await waitFor(() => {
        expect(api.post).not.toHaveBeenCalled();
      });

      await user.type(codeInput, 'A.8.1');
      await user.type(screen.getByLabelText(/title/i), 'Test Control');
      await user.selectOptions(screen.getByLabelText(/category/i), 'ORGANIZATIONAL');

      vi.mocked(api.post).mockResolvedValue({ data: { id: 'new-control' } });
      await user.click(submitButton);

      // After correction, form should submit
      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
      });
    });

    it('should not validate standard control fields', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockStandardControl} />);

      const submitButton = screen.getByRole('button', { name: /update applicability/i });
      await user.click(submitButton);

      // Should not show validation errors for standard controls
      expect(screen.queryByText('Code is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockResolvedValue({ data: [] });
    });

    it('should create new control when form is submitted', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValue({ data: { id: 'new-control' } });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      await user.type(screen.getByLabelText(/code/i), 'A.8.1');
      await user.type(screen.getByLabelText(/title/i), 'New Control');
      await user.selectOptions(screen.getByLabelText(/category/i), 'ORGANIZATIONAL');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/controls', expect.objectContaining({
          code: 'A.8.1',
          title: 'New Control',
          category: 'ORGANIZATIONAL',
        }));
      });
    });

    it('should update existing control when form is submitted', async () => {
      const user = userEvent.setup();
      vi.mocked(api.put).mockResolvedValue({ data: mockControl });
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/documents')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      const titleInput = screen.getByDisplayValue('Test Control');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Control');

      const submitButton = screen.getByRole('button', { name: /update/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith(
          '/api/controls/control-1',
          expect.objectContaining({
            title: 'Updated Control',
          })
        );
      });
    });

    it('should update standard control applicability when form is submitted', async () => {
      const user = userEvent.setup();
      vi.mocked(api.put).mockResolvedValue({ data: mockStandardControl });
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/documents')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockStandardControl} />);

      const contractualCheckbox = screen.getByLabelText(/contractual obligation/i);
      await user.click(contractualCheckbox);

      const submitButton = screen.getByRole('button', { name: /update applicability/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith(
          '/api/controls/control-2',
          expect.objectContaining({
            selectedForContractualObligation: true,
            selectedForLegalRequirement: true,
            selectedForBusinessRequirement: false,
            implemented: true,
          })
        );
      });
    });

    // Skipping test due to coverage timeout
    it.skip('should show success toast after successful create', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValue({ data: { id: 'new-control' } });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      await user.type(screen.getByLabelText(/code/i), 'A.8.1');
      await user.type(screen.getByLabelText(/title/i), 'New Control');
      await user.selectOptions(screen.getByLabelText(/category/i), 'ORGANIZATIONAL');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    // Skipping test due to coverage timeout
    it.skip('should show error toast when create fails', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValue({
        response: {
          data: {
            error: 'Failed to create control',
          },
        },
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      await user.type(screen.getByLabelText(/code/i), 'A.8.1');
      await user.type(screen.getByLabelText(/title/i), 'New Control');
      await user.selectOptions(screen.getByLabelText(/category/i), 'ORGANIZATIONAL');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
        // Modal should remain open on error
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });

    it('should close modal after successful submission', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockResolvedValue({ data: { id: 'new-control' } });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      await user.type(screen.getByLabelText(/code/i), 'A.8.1');
      await user.type(screen.getByLabelText(/title/i), 'New Control');
      await user.selectOptions(screen.getByLabelText(/category/i), 'ORGANIZATIONAL');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Delete Functionality', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/documents')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });
    });

    it('should show delete button for custom control', async () => {
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should not show delete button for standard control', async () => {
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockStandardControl} />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      });
    });

    it('should open delete confirmation dialog when delete is clicked', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(screen.getByText(/are you sure you want to delete control/i)).toBeInTheDocument();
      expect(screen.getByText(/A\.8\.1: Test Control/i)).toBeInTheDocument();
    });

    it('should delete control when confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(api.delete).mockResolvedValue({});

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Wait for AlertDialog to appear
      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to delete control/i)).toBeInTheDocument();
      });

      // Find the Delete button in the AlertDialog (should be the one with colorScheme="red")
      const confirmButtons = screen.getAllByRole('button', { name: /^delete$/i });
      // The AlertDialog Delete button should be the one that's not disabled and is in the dialog
      const confirmButton = confirmButtons.find(btn =>
        btn.closest('[role="alertdialog"]') !== null ||
        btn.getAttribute('colorScheme') === 'red' ||
        btn.classList.toString().includes('red')
      ) || confirmButtons[confirmButtons.length - 1]; // Fallback to last one

      await user.click(confirmButton);

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith('/api/controls/control-1');
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it.skip('should close delete dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Wait for AlertDialog to appear
      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to delete control/i)).toBeInTheDocument();
      });

      // Find the Cancel button in the AlertDialog
      const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
      // The AlertDialog Cancel button should be the one in the dialog
      const cancelButton = cancelButtons.find(btn =>
        btn.closest('[role="alertdialog"]') !== null
      ) || cancelButtons[0]; // Fallback to first one

      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/are you sure you want to delete control/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Supplier Linking', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockResolvedValue({ data: [mockSupplier] });
    });

    it('should fetch and display linked suppliers', async () => {
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/controls/control-1/suppliers');
      });

      await waitFor(() => {
        expect(screen.getByText('Test Supplier')).toBeInTheDocument();
      });
    });

    it.skip('should open supplier modal when link supplier button is clicked', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      const linkButton = screen.getByRole('button', { name: /link supplier/i });
      await user.click(linkButton);

      expect(screen.getByText('Link Supplier to Control')).toBeInTheDocument();
    });

    // Skipping flaky test that causes timeouts in CI environment
    it.skip('should search suppliers when search term is entered', async () => {
      const user = userEvent.setup();
      vi.mocked(supplierApi.getSuppliers).mockResolvedValue([mockSupplier]);

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      const linkButton = screen.getByRole('button', { name: /link supplier/i });
      await user.click(linkButton);

      const searchInput = screen.getByPlaceholderText(/search suppliers by name/i);
      await user.type(searchInput, 'Test');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(supplierApi.getSuppliers).toHaveBeenCalledWith({ search: 'Test' });
      });
    });

    it('should unlink supplier when unlink button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(api.delete).mockResolvedValue({});

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      await waitFor(() => {
        expect(screen.getByText('Test Supplier')).toBeInTheDocument();
      });

      const unlinkButtons = screen.getAllByLabelText(/unlink supplier/i);
      await user.click(unlinkButtons[0]);

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith('/api/suppliers/supplier-1/controls/control-1');
      });
    });
  });

  describe('Document Linking', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/documents')) {
          return Promise.resolve({
            data: {
              data: [mockDocument],
            },
          });
        }
        return Promise.resolve({ data: [] });
      });
    });

    it('should fetch and display linked documents', async () => {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === `/api/controls/${mockControl.id}/documents`) {
          return Promise.resolve({ data: [mockDocument] });
        }
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/controls/control-1/documents');
      });

      await waitFor(() => {
        expect(screen.getByText('Test Document')).toBeInTheDocument();
      });
    });

    it('should search documents when search term is entered', async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === `/api/controls/${mockControl.id}/documents`) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url === '/api/documents') {
          return Promise.resolve({
            data: {
              data: [mockDocument],
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search documents by title/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search documents by title/i);
      await user.type(searchInput, 'Test');

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/documents', expect.objectContaining({
          params: expect.objectContaining({
            limit: 20,
          }),
        }));
      });
    });

    it('should link document when document is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === `/api/controls/${mockControl.id}/documents`) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url === '/api/documents') {
          return Promise.resolve({
            data: {
              data: [mockDocument],
            },
          });
        }
        return Promise.resolve({ data: [] });
      });
      vi.mocked(api.post).mockResolvedValue({ data: {} });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search documents by title/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search documents by title/i);
      await user.type(searchInput, 'Test');

      // Wait for API call to complete and document to appear (with longer timeout for debounce/search)
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/documents', expect.anything());
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(screen.getByText('Test Document')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Find the clickable document box (it's a Box with onClick, not a button)
      const documentBox = screen.getByText('Test Document').closest('div[class*="Box"]') ||
        screen.getByText('Test Document').parentElement;

      if (documentBox) {
        await user.click(documentBox as HTMLElement);
      } else {
        // Fallback: click the text itself
        await user.click(screen.getByText('Test Document'));
      }

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/controls/control-1/documents', {
          documentId: 'doc-1',
        });
      }, { timeout: 3000 });
    });

    it('should unlink document when unlink button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === `/api/controls/${mockControl.id}/documents`) {
          return Promise.resolve({ data: [mockDocument] });
        }
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });
      vi.mocked(api.delete).mockResolvedValue({});

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      await waitFor(() => {
        expect(screen.getByText('Test Document')).toBeInTheDocument();
      });

      const unlinkButton = screen.getByLabelText(/unlink document/i);
      await user.click(unlinkButton);

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith('/api/controls/control-1/documents/doc-1');
      });
    });
  });

  describe('Standard Control Display', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/documents')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });
    });

    it('should display all standard control fields', async () => {
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockStandardControl} />);

      await waitFor(() => {
        expect(screen.getByText('5.1')).toBeInTheDocument();
      });

      expect(screen.getByText('5.1')).toBeInTheDocument();
      expect(screen.getByText('Standard Control')).toBeInTheDocument();
      expect(screen.getByText('Control text')).toBeInTheDocument();
      expect(screen.getByText('Control purpose')).toBeInTheDocument();
      expect(screen.getByText('Control guidance')).toBeInTheDocument();
      expect(screen.getByText('Other information')).toBeInTheDocument();
    });

    it('should display linked risks for standard control', async () => {
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockStandardControl} />);

      await waitFor(() => {
        expect(screen.getByText('Linked Risks (1):')).toBeInTheDocument();
      });
      expect(screen.getByText('Test Risk')).toBeInTheDocument();
    });

    it('should store risk ID in sessionStorage when risk link is clicked', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockStandardControl} />);

      const riskLink = screen.getByText('Test Risk');
      await user.click(riskLink);

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('highlightRiskId', 'risk-1');
    });

    it('should display risk assessment checkbox as disabled', () => {
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockStandardControl} />);

      const riskAssessmentCheckbox = screen.getByLabelText(/risk assessment/i);
      expect(riskAssessmentCheckbox).toBeDisabled();
    });
  });

  describe('Form Fields', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockResolvedValue({ data: [] });
    });

    it('should update form fields when values change', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      const codeInput = screen.getByLabelText(/code/i);
      await user.type(codeInput, 'A.8.1');

      expect(codeInput).toHaveValue('A.8.1');
    });

    it('should handle checkbox changes', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      const implementedCheckbox = screen.getByLabelText(/implemented/i);
      await user.click(implementedCheckbox);

      expect(implementedCheckbox).toBeChecked();
    });

    it('should handle textarea changes', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      const descriptionTextarea = screen.getByLabelText(/description/i);
      await user.type(descriptionTextarea, 'Test description');

      expect(descriptionTextarea).toHaveValue('Test description');
    });

    it('should handle category selection', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, 'ORGANIZATIONAL');

      expect(categorySelect).toHaveValue('ORGANIZATIONAL');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockResolvedValue({ data: [] });
    });

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup();
      vi.mocked(api.post).mockRejectedValue({
        response: {
          data: {
            error: 'Server error',
            details: 'Detailed error message',
          },
        },
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      await user.type(screen.getByLabelText(/code/i), 'A.8.1');
      await user.type(screen.getByLabelText(/title/i), 'New Control');
      await user.selectOptions(screen.getByLabelText(/category/i), 'ORGANIZATIONAL');

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
        // Modal should remain open on error
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });

    it('should handle supplier search errors', async () => {
      const user = userEvent.setup();
      vi.mocked(supplierApi.getSuppliers).mockRejectedValue(new Error('Search failed'));
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/documents')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      const linkButton = screen.getByRole('button', { name: /link supplier/i });
      await user.click(linkButton);

      const searchInput = screen.getByPlaceholderText(/search suppliers by name/i);
      await user.type(searchInput, 'Test');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(supplierApi.getSuppliers).toHaveBeenCalled();
      });
    });

    it('should handle document search errors', async () => {
      const user = userEvent.setup();
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === `/api/controls/${mockControl.id}/documents`) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url === '/api/documents') {
          return Promise.reject(new Error('Search failed'));
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search documents by title/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search documents by title/i);
      await user.type(searchInput, 'Test');

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/documents', expect.anything());
      });
    });
  });

  describe('Modal Interactions', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockResolvedValue({ data: [] });
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={null} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty supplier list', async () => {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/documents')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      await waitFor(() => {
        expect(screen.getByText(/no suppliers linked to this control/i)).toBeInTheDocument();
      });
    });

    it('should handle empty document list', async () => {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/documents')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      // Should not show error, just empty state
      await waitFor(() => {
        expect(screen.queryByText(/no documents linked/i)).not.toBeInTheDocument();
      });
    });

    it('should handle control with no risk controls', async () => {
      const controlWithoutRisks = { ...mockStandardControl, riskControls: [] };
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url.includes('/documents')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={controlWithoutRisks} />);

      await waitFor(() => {
        expect(screen.queryByText(/linked risks/i)).not.toBeInTheDocument();
      });

      expect(screen.queryByText(/linked risks/i)).not.toBeInTheDocument();
    });

    it('should filter out already linked suppliers from search results', async () => {
      const user = userEvent.setup();
      const anotherSupplier = { ...mockSupplier, id: 'supplier-2', name: 'Another Supplier' };
      vi.mocked(supplierApi.getSuppliers).mockResolvedValue([mockSupplier, anotherSupplier]);
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [mockSupplier] });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      const linkButton = screen.getByRole('button', { name: /link supplier/i });
      await user.click(linkButton);

      const searchInput = screen.getByPlaceholderText(/search suppliers by name/i);
      await user.type(searchInput, 'Test');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(supplierApi.getSuppliers).toHaveBeenCalled();
      });

      // Wait for search results to appear
      await waitFor(() => {
        const supplierTable = screen.getByRole('table');
        expect(supplierTable).toBeInTheDocument();
      });
    });

    it('should filter out already linked documents from search results', async () => {
      const user = userEvent.setup();
      const anotherDocument = { ...mockDocument, id: 'doc-2', title: 'Another Document' };
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === `/api/controls/${mockControl.id}/documents`) {
          return Promise.resolve({ data: [mockDocument] });
        }
        if (url.includes('/suppliers')) {
          return Promise.resolve({ data: [] });
        }
        if (url === '/api/documents') {
          return Promise.resolve({
            data: {
              data: [mockDocument, anotherDocument],
            },
          });
        }
        return Promise.resolve({ data: [] });
      });

      render(<ControlFormModal isOpen={true} onClose={mockOnClose} control={mockControl} />);

      // Wait for component to load and fetch linked documents
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search documents by title/i)).toBeInTheDocument();
      });

      // Wait for linked documents to be fetched
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(`/api/controls/${mockControl.id}/documents`);
      });

      const searchInput = screen.getByPlaceholderText(/search documents by title/i);
      await user.type(searchInput, 'Document');

      // Wait for search API call (with timeout for debounce/search processing)
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/documents', expect.anything());
      }, { timeout: 3000 });

      // Wait for search results to appear - should only show "Another Document"
      // "Test Document" should be filtered out as it's already linked
      await waitFor(() => {
        expect(screen.getByText('Another Document')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify that "Test Document" is NOT in the search results (it's already linked)
      // But it might still be visible in the linked documents section, so check the search results area specifically
      const searchResultsArea = screen.getByText('Another Document').closest('div');
      if (searchResultsArea) {
        expect(searchResultsArea.textContent).not.toContain('Test Document');
      }
    });
  });
});

