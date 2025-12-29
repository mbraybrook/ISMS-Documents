import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { SupplierExitPlanTab } from '../SupplierExitPlanTab';
import { supplierApi } from '../../services/api';
import { SupplierExitPlan, ImpactAssessment } from '../../types/supplier';

// Mock the API
vi.mock('../../services/api', () => ({
  supplierApi: {
    getExitPlan: vi.fn(),
    createExitPlan: vi.fn(),
    updateExitPlan: vi.fn(),
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

describe('SupplierExitPlanTab', () => {
  const defaultProps = {
    supplierId: 'supplier-1',
    canEdit: true,
    lifecycleState: 'APPROVED',
  };

  const createMockExitPlan = (overrides?: Partial<SupplierExitPlan>): SupplierExitPlan => ({
    id: 'exit-plan-1',
    supplierId: 'supplier-1',
    impactAssessment: {
      notes: 'Impact notes',
      scopeOfServices: 'Scope details',
      dependencies: ['Dependency 1', 'Dependency 2'],
      stakeholders: ['Stakeholder 1'],
      completed: false,
    },
    dataAndIpr: {
      notes: 'Data notes',
      dataInventory: 'Inventory details',
      exportDetails: 'Export details',
      integrityValidation: 'Validation details',
      iprTransfer: 'IPR transfer details',
      deletionConfirmation: 'Deletion confirmation',
      completed: true,
    },
    replacementServiceAnalysis: {
      notes: 'Replacement notes',
      alternativeProviders: ['Provider 1'],
      securityComplianceChecks: 'Security checks',
      pocNotes: 'POC notes',
      tcoAnalysis: 'TCO analysis',
      completed: false,
    },
    contractClosure: {
      notes: 'Contract notes',
      obligationsMet: ['Obligation 1'],
      handoverDocs: ['Doc 1'],
      ticketClosure: ['Ticket 1'],
      serviceCessationEvidence: ['Evidence 1'],
      completed: false,
    },
    lessonsLearned: {
      notes: 'Lessons notes',
      findings: ['Finding 1', 'Finding 2'],
      completed: false,
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner while fetching exit plan', async () => {
      vi.mocked(supplierApi.getExitPlan).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = render(<SupplierExitPlanTab {...defaultProps} />);

      // Chakra UI Spinner doesn't have role="status", check for spinner class
      const spinner = container.querySelector('[class*="chakra-spinner"]');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('No Exit Plan State', () => {
    it('should show message when no exit plan exists', async () => {
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(null);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/no exit plan exists for this supplier/i)).toBeInTheDocument();
      });
    });

    it('should show create button when canEdit is true and no exit plan exists', async () => {
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(null);

      render(<SupplierExitPlanTab {...defaultProps} canEdit={true} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create exit plan/i })).toBeInTheDocument();
      });
    });

    it('should not show create button when canEdit is false', async () => {
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(null);

      render(<SupplierExitPlanTab {...defaultProps} canEdit={false} />);

      await waitFor(() => {
        expect(screen.getByText(/no exit plan exists for this supplier/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /create exit plan/i })).not.toBeInTheDocument();
    });

    it('should show alert when lifecycle state is EXIT_IN_PROGRESS and no exit plan exists', async () => {
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(null);

      render(<SupplierExitPlanTab {...defaultProps} lifecycleState="EXIT_IN_PROGRESS" />);

      await waitFor(() => {
        expect(screen.getByText(/this supplier is in exit process but no exit plan exists/i)).toBeInTheDocument();
      });
    });

    it('should not show alert when lifecycle state is not EXIT_IN_PROGRESS', async () => {
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(null);

      render(<SupplierExitPlanTab {...defaultProps} lifecycleState="APPROVED" />);

      await waitFor(() => {
        expect(screen.getByText(/no exit plan exists for this supplier/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/this supplier is in exit process/i)).not.toBeInTheDocument();
    });
  });

  describe('Fetching Exit Plan', () => {
    it('should fetch exit plan on mount', async () => {
      const mockPlan = createMockExitPlan();
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(supplierApi.getExitPlan).toHaveBeenCalledWith('supplier-1');
      });
    });

    it('should refetch exit plan when supplierId changes', async () => {
      const mockPlan = createMockExitPlan();
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      const { rerender } = render(<SupplierExitPlanTab {...defaultProps} supplierId="supplier-1" />);

      await waitFor(() => {
        expect(supplierApi.getExitPlan).toHaveBeenCalledWith('supplier-1');
      });

      vi.clearAllMocks();
      rerender(<SupplierExitPlanTab {...defaultProps} supplierId="supplier-2" />);

      await waitFor(() => {
        expect(supplierApi.getExitPlan).toHaveBeenCalledWith('supplier-2');
      });
    });

    it('should handle error when fetching exit plan fails', async () => {
      const error = new Error('Network error');
      vi.mocked(supplierApi.getExitPlan).mockRejectedValue(error);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to load exit plan',
            status: 'error',
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/no exit plan exists for this supplier/i)).toBeInTheDocument();
      });
    });
  });

  describe('Creating Exit Plan', () => {
    it('should create exit plan when create button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(null);
      const newPlan = createMockExitPlan();
      vi.mocked(supplierApi.createExitPlan).mockResolvedValue(newPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create exit plan/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create exit plan/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(supplierApi.createExitPlan).toHaveBeenCalledWith('supplier-1', {});
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Success',
            description: 'Exit plan created successfully',
            status: 'success',
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/exit plan/i)).toBeInTheDocument();
      });
    });

    it('should handle error when creating exit plan fails', async () => {
      const user = userEvent.setup();
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(null);
      const error = { response: { data: { error: 'Creation failed' } } };
      vi.mocked(supplierApi.createExitPlan).mockRejectedValue(error);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create exit plan/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create exit plan/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Creation failed',
            status: 'error',
          })
        );
      });
    });

    it('should handle error when creating exit plan fails without response data', async () => {
      const user = userEvent.setup();
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(null);
      const error = new Error('Network error');
      vi.mocked(supplierApi.createExitPlan).mockRejectedValue(error);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create exit plan/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create exit plan/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to create exit plan',
            status: 'error',
          })
        );
      });
    });

    it('should show loading state while creating exit plan', async () => {
      const user = userEvent.setup();
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(null);
      let resolveCreate: (value: unknown) => void;
      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve;
      });
      vi.mocked(supplierApi.createExitPlan).mockReturnValue(createPromise as never);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create exit plan/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create exit plan/i });
      await user.click(createButton);

      // Button should show loading state (isLoading prop sets aria-busy or disabled)
      // Chakra UI Button with isLoading may show loading spinner
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /create exit plan/i });
        expect(button).toBeInTheDocument();
        // Check for loading state - button may be disabled or have aria-busy
        const isDisabled = button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true';
        const isBusy = button.getAttribute('aria-busy') === 'true';
        expect(isDisabled || isBusy).toBe(true);
      }, { timeout: 2000 });

      // Resolve the promise to clean up
      resolveCreate!(createMockExitPlan());
    });
  });

  describe('Rendering Exit Plan Sections', () => {
    it('should render all exit plan sections when exit plan exists', async () => {
      const mockPlan = createMockExitPlan();
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/exit plan/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. data and ipr/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. replacement service analysis/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. contract closure/i)).toBeInTheDocument();
      expect(screen.getByText(/5\. lessons learned/i)).toBeInTheDocument();
    });

    it('should render section with completed styling when completed is true', async () => {
      const mockPlan = createMockExitPlan({
        dataAndIpr: {
          notes: 'Test notes',
          completed: true,
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/2\. data and ipr/i)).toBeInTheDocument();
      });

      // Find the section box - it should have green background when completed
      // The section is a Box component with bg={isCompleted ? 'green.50' : 'white'}
      // We can verify the completed state by checking the checkbox is checked
      const checkboxes = screen.getAllByRole('checkbox', { name: /completed/i });
      // Find the checkbox for Data and IPR section (should be the second one)
      expect(checkboxes.length).toBeGreaterThan(1);
      // The Data and IPR section checkbox should be checked (completed: true)
      const dataAndIprCheckbox = checkboxes[1]; // Second checkbox is for Data and IPR
      expect(dataAndIprCheckbox).toBeChecked();
    });

    it('should render section with default styling when completed is false', async () => {
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          notes: 'Test notes',
          completed: false,
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      });

      // Verify the checkbox is not checked (completed: false)
      const checkboxes = screen.getAllByRole('checkbox', { name: /completed/i });
      expect(checkboxes.length).toBeGreaterThan(0);
      // The first checkbox is for Impact Assessment
      const impactAssessmentCheckbox = checkboxes[0];
      expect(impactAssessmentCheckbox).not.toBeChecked();
    });
  });

  describe('Section Field Types', () => {
    it('should render textarea fields correctly', async () => {
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          notes: 'Test notes',
          scopeOfServices: 'Test scope',
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      });

      // Get the notes field from Impact Assessment section
      const notesFields = screen.getAllByLabelText(/notes/i);
      expect(notesFields.length).toBeGreaterThan(0);
      const notesField = notesFields[0];
      expect(notesField).toHaveValue('Test notes');
      expect(notesField.tagName).toBe('TEXTAREA');
    });

    it('should render text input fields correctly', async () => {
      // Note: The component doesn't have text input fields in the current implementation,
      // but the renderSection function supports them. Testing the structure.
      const mockPlan = createMockExitPlan();
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      });
    });

    it('should render array fields correctly', async () => {
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          dependencies: ['Dependency 1', 'Dependency 2'],
          stakeholders: ['Stakeholder 1'],
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/dependencies/i)).toBeInTheDocument();
      });

      const dependencyInputs = screen.getAllByDisplayValue('Dependency 1');
      expect(dependencyInputs.length).toBeGreaterThan(0);
    });

    it('should handle empty array fields', async () => {
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          dependencies: [],
          stakeholders: [],
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      });

      // When array is empty, the label still exists but there are no input fields
      // Check that the label text exists (use getAllByText since button also contains "Dependencies")
      const dependencyTexts = screen.getAllByText(/dependencies/i);
      expect(dependencyTexts.length).toBeGreaterThan(0);
      // Check that the Add button exists for empty arrays (when canEdit is true)
      expect(screen.getByRole('button', { name: /add dependencies/i })).toBeInTheDocument();
    });
  });

  describe('Updating Sections', () => {
    it('should update section when checkbox is toggled', async () => {
      const user = userEvent.setup();
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          notes: 'Test notes',
          completed: false,
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);
      const updatedPlan = createMockExitPlan({
        impactAssessment: {
          notes: 'Test notes',
          completed: true,
        },
      });
      vi.mocked(supplierApi.updateExitPlan).mockResolvedValue(updatedPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      });

      // Get the first checkbox (from Impact Assessment section)
      const checkboxes = screen.getAllByRole('checkbox', { name: /completed/i });
      expect(checkboxes.length).toBeGreaterThan(0);
      const checkbox = checkboxes[0];
      await user.click(checkbox);

      await waitFor(() => {
        expect(supplierApi.updateExitPlan).toHaveBeenCalledWith(
          'supplier-1',
          expect.objectContaining({
            impactAssessment: expect.objectContaining({
              completed: true,
            }),
          })
        );
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Success',
            description: 'Exit plan updated',
            status: 'success',
          })
        );
      });
    });

    it('should update section when textarea value changes', async () => {
      const user = userEvent.setup();
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          notes: 'Original notes',
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);
      const updatedPlan = createMockExitPlan({
        impactAssessment: {
          notes: 'Updated',
        },
      });
      vi.mocked(supplierApi.updateExitPlan).mockResolvedValue(updatedPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      });

      // Get the first notes field (from Impact Assessment section)
      const notesFields = screen.getAllByLabelText(/notes/i);
      expect(notesFields.length).toBeGreaterThan(0);
      const notesField = notesFields[0];
      
      // Clear and type a single character to trigger update
      await user.clear(notesField);
      await user.type(notesField, 'U');

      // Component debounces textarea updates (500ms delay)
      // Wait for the debounced API call to be made
      await waitFor(() => {
        expect(supplierApi.updateExitPlan).toHaveBeenCalled();
      }, { timeout: 2000 }); // Allow time for 500ms debounce + API call
      
      // Verify the call was made with correct supplier ID and section name
      expect(supplierApi.updateExitPlan).toHaveBeenCalledWith(
        'supplier-1',
        expect.objectContaining({
          impactAssessment: expect.any(Object),
        })
      );
    });

    it('should update section when array item is edited', async () => {
      const user = userEvent.setup();
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          dependencies: ['Dependency 1'],
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);
      const updatedPlan = createMockExitPlan({
        impactAssessment: {
          dependencies: ['Updated'],
        },
      });
      vi.mocked(supplierApi.updateExitPlan).mockResolvedValue(updatedPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Dependency 1')).toBeInTheDocument();
      });

      const dependencyInput = screen.getByDisplayValue('Dependency 1');
      // Clear and type a single character to trigger update
      await user.clear(dependencyInput);
      await user.type(dependencyInput, 'U');

      // Component debounces array input updates (500ms delay)
      // Wait for the debounced API call to be made
      await waitFor(() => {
        expect(supplierApi.updateExitPlan).toHaveBeenCalled();
      }, { timeout: 2000 }); // Allow time for 500ms debounce + API call
      
      // Verify the call was made with correct supplier ID and section name
      expect(supplierApi.updateExitPlan).toHaveBeenCalledWith(
        'supplier-1',
        expect.objectContaining({
          impactAssessment: expect.any(Object),
        })
      );
    });

    it('should add new array item when add button is clicked', async () => {
      const user = userEvent.setup();
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          dependencies: ['Dependency 1'],
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);
      const updatedPlan = createMockExitPlan({
        impactAssessment: {
          dependencies: ['Dependency 1', ''],
        },
      });
      vi.mocked(supplierApi.updateExitPlan).mockResolvedValue(updatedPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add dependencies/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(supplierApi.updateExitPlan).toHaveBeenCalledWith(
          'supplier-1',
          expect.objectContaining({
            impactAssessment: expect.objectContaining({
              dependencies: ['Dependency 1', ''],
            }),
          })
        );
      });
    });

    it('should remove array item when delete button is clicked', async () => {
      const user = userEvent.setup();
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          dependencies: ['Dependency 1', 'Dependency 2'],
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);
      const updatedPlan = createMockExitPlan({
        impactAssessment: {
          dependencies: ['Dependency 2'],
        },
      });
      vi.mocked(supplierApi.updateExitPlan).mockResolvedValue(updatedPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Dependency 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(supplierApi.updateExitPlan).toHaveBeenCalledWith(
          'supplier-1',
          expect.objectContaining({
            impactAssessment: expect.objectContaining({
              dependencies: ['Dependency 2'],
            }),
          })
        );
      });
    });

    it('should handle error when updating section fails', async () => {
      const user = userEvent.setup();
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          notes: 'Test notes',
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);
      const error = new Error('Update failed');
      vi.mocked(supplierApi.updateExitPlan).mockRejectedValue(error);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      });

      // Get the first notes field (from Impact Assessment section)
      const notesFields = screen.getAllByLabelText(/notes/i);
      expect(notesFields.length).toBeGreaterThan(0);
      const notesField = notesFields[0];
      
      // Clear and type a single character to trigger one API call
      await user.clear(notesField);
      await user.type(notesField, 'U');

      // Component debounces text input updates (500ms delay)
      // Wait for the debounced API call to be made and fail
      await waitFor(() => {
        expect(supplierApi.updateExitPlan).toHaveBeenCalled();
      }, { timeout: 2000 }); // Allow time for 500ms debounce + API call

      // Wait for the error toast to be called after API failure
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to update exit plan',
            status: 'error',
          })
        );
      }, { timeout: 2000 });
    });
  });

  describe('Read-Only Mode', () => {
    it('should disable checkbox when canEdit is false', async () => {
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          notes: 'Test notes',
          completed: false,
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} canEdit={false} />);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox', { name: /completed/i });
        // All checkboxes should be disabled
        checkboxes.forEach(checkbox => {
          expect(checkbox).toBeDisabled();
        });
      });
    });

    it('should make inputs read-only when canEdit is false', async () => {
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          notes: 'Test notes',
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} canEdit={false} />);

      await waitFor(() => {
        // Get the first notes field (from Impact Assessment section)
        const notesFields = screen.getAllByLabelText(/notes/i);
        expect(notesFields.length).toBeGreaterThan(0);
        // All textareas should be readonly
        notesFields.forEach(field => {
          expect(field).toHaveAttribute('readonly');
        });
      });
    });

    it('should not show delete buttons for array items when canEdit is false', async () => {
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          dependencies: ['Dependency 1', 'Dependency 2'],
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} canEdit={false} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Dependency 1')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });

    it('should not show add button for array fields when canEdit is false', async () => {
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          dependencies: ['Dependency 1'],
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} canEdit={false} />);

      await waitFor(() => {
        expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /add dependencies/i })).not.toBeInTheDocument();
    });
  });

  describe('All Sections Rendering', () => {
    it('should render Impact Assessment section with all fields', async () => {
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          notes: 'Impact notes',
          scopeOfServices: 'Scope details',
          dependencies: ['Dep 1'],
          stakeholders: ['Stakeholder 1'],
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      });

      // Check that all fields exist (using getAllBy since Notes appears in multiple sections)
      const notesFields = screen.getAllByLabelText(/notes/i);
      expect(notesFields.length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/scope of services/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/dependencies/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/stakeholders/i)).toBeInTheDocument();
    });

    it('should render Data and IPR section with all fields', async () => {
      const mockPlan = createMockExitPlan({
        dataAndIpr: {
          notes: 'Data notes',
          dataInventory: 'Inventory',
          exportDetails: 'Export',
          integrityValidation: 'Validation',
          iprTransfer: 'IPR',
          deletionConfirmation: 'Deletion',
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/2\. data and ipr/i)).toBeInTheDocument();
      });

      // Notes field exists (multiple sections have notes)
      const notesFields = screen.getAllByLabelText(/notes/i);
      expect(notesFields.length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/data inventory/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/export details/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/integrity validation/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/ipr transfer/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/deletion confirmation/i)).toBeInTheDocument();
    });

    it('should render Replacement Service Analysis section with all fields', async () => {
      const mockPlan = createMockExitPlan({
        replacementServiceAnalysis: {
          notes: 'Replacement notes',
          alternativeProviders: ['Provider 1'],
          securityComplianceChecks: 'Security checks',
          pocNotes: 'POC notes',
          tcoAnalysis: 'TCO analysis',
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/3\. replacement service analysis/i)).toBeInTheDocument();
      });

      // Notes field exists (multiple sections have notes)
      const notesFields = screen.getAllByLabelText(/notes/i);
      expect(notesFields.length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/alternative providers/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/security\/compliance checks/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/proof of concept notes/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/total cost of ownership analysis/i)).toBeInTheDocument();
    });

    it('should render Contract Closure section with all fields', async () => {
      const mockPlan = createMockExitPlan({
        contractClosure: {
          notes: 'Contract notes',
          obligationsMet: ['Obligation 1'],
          handoverDocs: ['Doc 1'],
          ticketClosure: ['Ticket 1'],
          serviceCessationEvidence: ['Evidence 1'],
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/4\. contract closure/i)).toBeInTheDocument();
      });

      // Notes field exists (multiple sections have notes)
      const notesFields = screen.getAllByLabelText(/notes/i);
      expect(notesFields.length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/obligations met/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/handover documents/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/ticket closure references/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/service cessation evidence/i)).toBeInTheDocument();
    });

    it('should render Lessons Learned section with all fields', async () => {
      const mockPlan = createMockExitPlan({
        lessonsLearned: {
          notes: 'Lessons notes',
          findings: ['Finding 1'],
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/5\. lessons learned/i)).toBeInTheDocument();
      });

      // Notes field exists (multiple sections have notes)
      const notesFields = screen.getAllByLabelText(/notes/i);
      expect(notesFields.length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/key findings/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null section data', async () => {
      const mockPlan = createMockExitPlan({
        impactAssessment: null,
        dataAndIpr: null,
        replacementServiceAnalysis: null,
        contractClosure: null,
        lessonsLearned: null,
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      });

      // Should render sections even with null data
      expect(screen.getByText(/2\. data and ipr/i)).toBeInTheDocument();
    });

    it('should handle undefined section properties', async () => {
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          notes: undefined,
          scopeOfServices: undefined,
          dependencies: undefined,
          stakeholders: undefined,
        } as unknown as ImpactAssessment,
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1\. impact assessment/i)).toBeInTheDocument();
      });

      // Should render with empty values - get first notes field from Impact Assessment
      const notesFields = screen.getAllByLabelText(/notes/i);
      expect(notesFields.length).toBeGreaterThan(0);
      // The first notes field should be from Impact Assessment and have empty value
      const firstNotesField = notesFields[0];
      expect(firstNotesField).toHaveValue('');
    });

    it('should handle multiple array items correctly', async () => {
      const mockPlan = createMockExitPlan({
        impactAssessment: {
          dependencies: ['Dep 1', 'Dep 2', 'Dep 3'],
        },
      });
      vi.mocked(supplierApi.getExitPlan).mockResolvedValue(mockPlan);

      render(<SupplierExitPlanTab {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Dep 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Dep 2')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Dep 3')).toBeInTheDocument();
      });
    });
  });
});

