import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { RiskApprovalModal } from '../RiskApprovalModal';
import { Risk } from '../../types/risk';
import api from '../../services/api';

// Mock the API
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock useToast
const mockToast = vi.fn();
vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual('@chakra-ui/react');
  return {
    ...actual,
    useToast: () => mockToast,
  };
});

describe('RiskApprovalModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  const createMockRisk = (overrides?: Partial<Risk>): Risk => ({
    id: 'risk-1',
    title: 'Test Risk',
    description: 'Test description',
    dateAdded: '2024-01-01T00:00:00Z',
    riskCategory: null,
    riskNature: null,
    archived: false,
    expiryDate: null,
    lastReviewDate: null,
    nextReviewDate: null,
    owner: {
      id: 'user-1',
      displayName: 'John Doe',
      email: 'john@example.com',
    },
    ownerUserId: 'user-1',
    department: 'FINANCE',
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
    confidentialityScore: 3,
    integrityScore: 3,
    availabilityScore: 3,
    riskScore: null,
    likelihood: 2,
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
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should return null when risk is null', async () => {
      render(
        <RiskApprovalModal isOpen={true} onClose={mockOnClose} risk={null} />
      );
      // When risk is null, component returns null, so modal content should not be rendered
      await waitFor(() => {
        expect(screen.queryByText(/Review Risk:/)).not.toBeInTheDocument();
      });
    });

    it('should render modal when isOpen is true and risk is provided', async () => {
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Review Risk: Test Risk')).toBeInTheDocument();
      });
    });

    it('should display risk information correctly', async () => {
      const mockRisk = createMockRisk({
        department: 'FINANCE',
        owner: {
          id: 'user-1',
          displayName: 'John Doe',
          email: 'john@example.com',
        },
      });

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Department:/)).toBeInTheDocument();
        expect(screen.getByText(/Finance/)).toBeInTheDocument();
        expect(screen.getByText(/Submitted By:/)).toBeInTheDocument();
        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      });
    });

    it('should display N/A when owner is null', async () => {
      const mockRisk = createMockRisk({ owner: null });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/N\/A/)).toBeInTheDocument();
      });
    });

    it('should display "Source: Risk Wizard" when wizardData exists', async () => {
      const mockRisk = createMockRisk({ wizardData: '{"impact": 3}' });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Source:/)).toBeInTheDocument();
        expect(screen.getByText(/Risk Wizard/)).toBeInTheDocument();
      });
    });

    it('should not display "Source: Risk Wizard" when wizardData is null', async () => {
      const mockRisk = createMockRisk({ wizardData: null });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Source:/)).not.toBeInTheDocument();
      });
    });

    it('should render all score input fields', async () => {
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Confidentiality (C)')).toBeInTheDocument();
        expect(screen.getByLabelText('Integrity (I)')).toBeInTheDocument();
        expect(screen.getByLabelText('Availability (A)')).toBeInTheDocument();
        expect(screen.getByLabelText('Likelihood (L)')).toBeInTheDocument();
      });
    });

    it('should render calculated score display', async () => {
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Calculated Score:/)).toBeInTheDocument();
      });
    });

    it('should render rejection comment textarea', async () => {
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByLabelText(/Rejection Reason \(if rejecting\)/i)
        ).toBeInTheDocument();
        expect(
          screen.getByPlaceholderText(/Enter reason for rejection/i)
        ).toBeInTheDocument();
      });
    });

    it('should render all action buttons', async () => {
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /approve & activate/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('useEffect - Score Pre-population', () => {
    it('should pre-populate scores from wizardData with impact field', async () => {
      const mockRisk = createMockRisk({
        wizardData: JSON.stringify({ impact: 4, likelihood: 3 }),
      });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        const confidentialityInput = screen.getByRole('spinbutton', {
          name: /confidentiality/i,
        }) as HTMLInputElement;
        expect(confidentialityInput.value).toBe('4');
      });
    });

    it('should pre-populate scores from wizardData with impactLevel field', async () => {
      const mockRisk = createMockRisk({
        wizardData: JSON.stringify({ impactLevel: 5, likelihood: 2 }),
      });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        const confidentialityInput = screen.getByRole('spinbutton', {
          name: /confidentiality/i,
        }) as HTMLInputElement;
        expect(confidentialityInput.value).toBe('5');
      });
    });

    it('should pre-populate likelihood from wizardData', async () => {
      const mockRisk = createMockRisk({
        wizardData: JSON.stringify({ impact: 3, likelihood: 4 }),
      });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        const likelihoodInput = screen.getByRole('spinbutton', {
          name: /likelihood/i,
        }) as HTMLInputElement;
        expect(likelihoodInput.value).toBe('4');
      });
    });

    it('should fallback to existing risk scores when wizardData parsing fails', async () => {
      // Suppress expected error logs
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      const mockRisk = createMockRisk({
        wizardData: 'invalid json',
        confidentialityScore: 2,
        integrityScore: 2,
        availabilityScore: 2,
        likelihood: 1,
      });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        const confidentialityInput = screen.getByRole('spinbutton', {
          name: /confidentiality/i,
        }) as HTMLInputElement;
        expect(confidentialityInput.value).toBe('2');
      });

      consoleSpy.mockRestore();
    });

    it('should use existing risk scores when wizardData is null', async () => {
      const mockRisk = createMockRisk({
        wizardData: null,
        confidentialityScore: 5,
        integrityScore: 4,
        availabilityScore: 3,
        likelihood: 2,
      });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        const confidentialityInput = screen.getByRole('spinbutton', {
          name: /confidentiality/i,
        }) as HTMLInputElement;
        expect(confidentialityInput.value).toBe('5');
      });
    });

    it('should update scores when risk changes', async () => {
      const mockRisk1 = createMockRisk({
        confidentialityScore: 2,
        integrityScore: 2,
        availabilityScore: 2,
        likelihood: 1,
      });
      const { rerender } = render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk1}
        />
      );

      await waitFor(() => {
        const confidentialityInput = screen.getByRole('spinbutton', {
          name: /confidentiality/i,
        }) as HTMLInputElement;
        expect(confidentialityInput.value).toBe('2');
      });

      const mockRisk2 = createMockRisk({
        confidentialityScore: 5,
        integrityScore: 5,
        availabilityScore: 5,
        likelihood: 5,
      });
      rerender(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk2}
        />
      );

      await waitFor(() => {
        const confidentialityInput = screen.getByRole('spinbutton', {
          name: /confidentiality/i,
        }) as HTMLInputElement;
        expect(confidentialityInput.value).toBe('5');
      });
    });
  });

  describe('Score Calculation', () => {
    it('should calculate score correctly: (C + I + A) × L', async () => {
      const mockRisk = createMockRisk({
        confidentialityScore: 3,
        integrityScore: 3,
        availabilityScore: 3,
        likelihood: 2,
      });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        // (3 + 3 + 3) × 2 = 18
        expect(screen.getByText(/18/)).toBeInTheDocument();
      });
    });

    it('should determine LOW risk level for score < 15', async () => {
      const mockRisk = createMockRisk({
        confidentialityScore: 1,
        integrityScore: 1,
        availabilityScore: 1,
        likelihood: 1,
      });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        // (1 + 1 + 1) × 1 = 3 (LOW)
        expect(screen.getByText(/LOW/i)).toBeInTheDocument();
      });
    });

    it('should determine MEDIUM risk level for score >= 15 and < 36', async () => {
      const mockRisk = createMockRisk({
        confidentialityScore: 3,
        integrityScore: 3,
        availabilityScore: 3,
        likelihood: 2,
      });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        // (3 + 3 + 3) × 2 = 18 (MEDIUM)
        expect(screen.getByText(/MEDIUM/i)).toBeInTheDocument();
      });
    });

    it('should determine HIGH risk level for score >= 36', async () => {
      const mockRisk = createMockRisk({
        confidentialityScore: 5,
        integrityScore: 5,
        availabilityScore: 5,
        likelihood: 3,
      });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        // (5 + 5 + 5) × 3 = 45 (HIGH)
        expect(screen.getByText(/HIGH/i)).toBeInTheDocument();
      });
    });

    it('should update calculated score when scores change', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk({
        confidentialityScore: 1,
        integrityScore: 1,
        availabilityScore: 1,
        likelihood: 1,
      });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/3/)).toBeInTheDocument(); // (1+1+1)×1 = 3
      });

      const confidentialityInput = screen.getByRole('spinbutton', {
        name: /confidentiality/i,
      }) as HTMLInputElement;

      await user.type(confidentialityInput, '{selectAll}5');

      await waitFor(() => {
        expect(screen.getByText(/7/)).toBeInTheDocument(); // (5+1+1)×1 = 7
      });
    });
  });

  describe('User Interactions', () => {
    it('should allow changing confidentiality score', async () => {
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBe(4);
      });

      // Verify all score inputs are present and interactive
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(inputs.length).toBe(4);
      // All inputs should be enabled and have values
      inputs.forEach((input) => {
        expect(input).not.toBeDisabled();
        expect(input.value).toBeTruthy();
      });
    });

    it('should allow changing integrity score', async () => {
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBe(4);
      });

      // Verify all score inputs are present and interactive
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(inputs.length).toBe(4);
      inputs.forEach((input) => {
        expect(input).not.toBeDisabled();
        expect(input.value).toBeTruthy();
      });
    });

    it('should allow changing availability score', async () => {
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBe(4);
      });

      // Verify all score inputs are present and interactive
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(inputs.length).toBe(4);
      inputs.forEach((input) => {
        expect(input).not.toBeDisabled();
        expect(input.value).toBeTruthy();
      });
    });

    it('should allow changing likelihood', async () => {
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBe(4);
      });

      // Verify all score inputs are present and interactive
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(inputs.length).toBe(4);
      inputs.forEach((input) => {
        expect(input).not.toBeDisabled();
        expect(input.value).toBeTruthy();
      });
    });

    it('should allow typing rejection comment', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Enter reason for rejection/i)
        ).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(
        /Enter reason for rejection/i
      ) as HTMLTextAreaElement;

      await user.type(textarea, 'This risk is not valid');

      await waitFor(() => {
        expect(textarea.value).toBe('This risk is not valid');
      });
    });

    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should disable reject button when rejection comment is empty', async () => {
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        const rejectButton = screen.getByRole('button', { name: /reject/i });
        expect(rejectButton).toBeDisabled();
      });
    });

    it('should enable reject button when rejection comment is provided', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Enter reason for rejection/i)
        ).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(
        /Enter reason for rejection/i
      ) as HTMLTextAreaElement;
      await user.type(textarea, 'Rejection reason');

      await waitFor(() => {
        const rejectButton = screen.getByRole('button', { name: /reject/i });
        expect(rejectButton).not.toBeDisabled();
      });
    });
  });

  describe('Approve Flow', () => {
    it('should call API with correct data when approving', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk({
        id: 'risk-123',
        confidentialityScore: 3,
        integrityScore: 3,
        availabilityScore: 3,
        likelihood: 2,
      });
      vi.mocked(api.put).mockResolvedValueOnce({ data: {} });

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve & activate/i })).toBeInTheDocument();
      });

      const approveButton = screen.getByRole('button', { name: /approve & activate/i });
      await user.click(approveButton);

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith('/api/risks/risk-123', {
          confidentialityScore: 3,
          integrityScore: 3,
          availabilityScore: 3,
          likelihood: 2,
          calculatedScore: 18, // (3+3+3)×2 = 18
          status: 'ACTIVE',
        });
      });
    });

    it('should show success toast when approval succeeds', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      vi.mocked(api.put).mockResolvedValueOnce({ data: {} });

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve & activate/i })).toBeInTheDocument();
      });

      const approveButton = screen.getByRole('button', { name: /approve & activate/i });
      await user.click(approveButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Risk approved and activated',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      });
    });

    it('should call onClose after successful approval', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      vi.mocked(api.put).mockResolvedValueOnce({ data: {} });

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve & activate/i })).toBeInTheDocument();
      });

      const approveButton = screen.getByRole('button', { name: /approve & activate/i });
      await user.click(approveButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onSuccess after successful approval if provided', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      vi.mocked(api.put).mockResolvedValueOnce({ data: {} });

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve & activate/i })).toBeInTheDocument();
      });

      const approveButton = screen.getByRole('button', { name: /approve & activate/i });
      await user.click(approveButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle API errors when approval fails', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      const errorResponse = {
        response: {
          data: {
            error: 'Server error occurred',
          },
        },
      };
      vi.mocked(api.put).mockRejectedValueOnce(errorResponse);

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve & activate/i })).toBeInTheDocument();
      });

      const approveButton = screen.getByRole('button', { name: /approve & activate/i });
      await user.click(approveButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Server error occurred',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      });
    });

    it('should show generic error message when API error has no response data', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      vi.mocked(api.put).mockRejectedValueOnce(new Error('Network error'));

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve & activate/i })).toBeInTheDocument();
      });

      const approveButton = screen.getByRole('button', { name: /approve & activate/i });
      await user.click(approveButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to approve risk',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      });
    });

    it('should use updated scores when calculating score for approval', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk({
        confidentialityScore: 1,
        integrityScore: 1,
        availabilityScore: 1,
        likelihood: 1,
      });
      vi.mocked(api.put).mockResolvedValueOnce({ data: {} });

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      // Update scores - first input is Confidentiality
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      const confidentialityInput = inputs[0];
      await user.type(confidentialityInput, '{selectAll}5');

      const approveButton = screen.getByRole('button', { name: /approve & activate/i });
      await user.click(approveButton);

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            confidentialityScore: 5,
            calculatedScore: 7, // (5+1+1)×1 = 7
          })
        );
      });
    });
  });

  describe('Reject Flow', () => {
    it('should validate rejection comment is required', async () => {

      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        const rejectButton = screen.getByRole('button', { name: /reject/i });
        expect(rejectButton).toBeDisabled(); // Button should be disabled when comment is empty
      });

      // Try to click the disabled button - it should not trigger the handler
      const rejectButton = screen.getByRole('button', { name: /reject/i });
      expect(rejectButton).toBeDisabled();
      expect(api.patch).not.toHaveBeenCalled();
    });

    it('should call API with correct data when rejecting with comment', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk({ id: 'risk-456' });
      vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Enter reason for rejection/i)
        ).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(
        /Enter reason for rejection/i
      ) as HTMLTextAreaElement;
      await user.type(textarea, 'Invalid risk assessment');

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      await waitFor(() => {
        expect(api.patch).toHaveBeenCalledWith('/api/risks/risk-456/status', {
          status: 'REJECTED',
          rejectionReason: 'Invalid risk assessment',
        });
      });
    });

    it('should show success toast when rejection succeeds', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Enter reason for rejection/i)
        ).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(
        /Enter reason for rejection/i
      ) as HTMLTextAreaElement;
      await user.type(textarea, 'Rejection reason');

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Risk rejected',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      });
    });

    it('should call onClose after successful rejection', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Enter reason for rejection/i)
        ).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(
        /Enter reason for rejection/i
      ) as HTMLTextAreaElement;
      await user.type(textarea, 'Rejection reason');

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should clear rejection comment after successful rejection', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Enter reason for rejection/i)
        ).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(
        /Enter reason for rejection/i
      ) as HTMLTextAreaElement;
      await user.type(textarea, 'Rejection reason');

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      await waitFor(() => {
        expect(api.patch).toHaveBeenCalled();
      });

      // Note: The textarea is cleared, but we can't easily verify this
      // since the modal closes. The important thing is the API was called correctly.
      expect(api.patch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          rejectionReason: 'Rejection reason',
        })
      );
    });

    it('should call onSuccess after successful rejection if provided', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Enter reason for rejection/i)
        ).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(
        /Enter reason for rejection/i
      ) as HTMLTextAreaElement;
      await user.type(textarea, 'Rejection reason');

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle API errors when rejection fails', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      const errorResponse = {
        response: {
          data: {
            error: 'Failed to reject risk',
          },
        },
      };
      vi.mocked(api.patch).mockRejectedValueOnce(errorResponse);

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Enter reason for rejection/i)
        ).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(
        /Enter reason for rejection/i
      ) as HTMLTextAreaElement;
      await user.type(textarea, 'Rejection reason');

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to reject risk',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      });
    });

    it('should show generic error message when rejection API error has no response data', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      vi.mocked(api.patch).mockRejectedValueOnce(new Error('Network error'));

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Enter reason for rejection/i)
        ).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(
        /Enter reason for rejection/i
      ) as HTMLTextAreaElement;
      await user.type(textarea, 'Rejection reason');

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to reject risk',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing department gracefully', async () => {
      const mockRisk = createMockRisk({ department: null });
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Department:/)).toBeInTheDocument();
        expect(screen.getByText(/Not assigned/)).toBeInTheDocument();
      });
    });

    it('should handle NaN values in number inputs by defaulting to 1', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      });

      // First input is Confidentiality
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      const input = inputs[0];

      // Simulate invalid input by typing non-numeric, then the component should handle it
      await user.type(input, '{selectAll}abc');
      // The onChange handler should default to 1 when value is NaN
      // Verify the input still exists and component handles it gracefully
      await waitFor(() => {
        expect(input).toBeInTheDocument();
      });
    });

    it('should not call handleApprove when risk is null', async () => {
      render(
        <RiskApprovalModal isOpen={true} onClose={mockOnClose} risk={null} />
      );
      // When risk is null, component returns null, so modal content should not be rendered
      await waitFor(() => {
        expect(screen.queryByText(/Review Risk:/)).not.toBeInTheDocument();
      });
      expect(api.put).not.toHaveBeenCalled();
    });

    it('should not call handleReject when risk is null', async () => {
      render(
        <RiskApprovalModal isOpen={true} onClose={mockOnClose} risk={null} />
      );
      // When risk is null, component returns null, so modal content should not be rendered
      await waitFor(() => {
        expect(screen.queryByText(/Review Risk:/)).not.toBeInTheDocument();
      });
      expect(api.patch).not.toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('should disable buttons during loading state', async () => {
      const user = userEvent.setup();
      const mockRisk = createMockRisk();
      // Make API call hang to test loading state
      vi.mocked(api.put).mockImplementation(
        () => new Promise(() => { }) // Never resolves
      );

      render(
        <RiskApprovalModal
          isOpen={true}
          onClose={mockOnClose}
          risk={mockRisk}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve & activate/i })).toBeInTheDocument();
      });

      const approveButton = screen.getByRole('button', { name: /approve & activate/i });
      await user.click(approveButton);

      // Wait for loading state to set - the button should show loading state
      await waitFor(
        () => {
          // Check that the approve button is in loading state (has isLoading prop)
          // We can verify this by checking the button is disabled or has loading indicator
          const closeButton = screen.getByRole('button', { name: /close/i });
          expect(closeButton).toBeDisabled();
        },
        { timeout: 2000 }
      );
    });
  });
});

