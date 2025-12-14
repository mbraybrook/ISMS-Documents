import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { SetReviewDateModal } from '../SetReviewDateModal';
import api from '../../services/api';

// Mock the API
vi.mock('../../services/api', () => {
  const mockApi = {
    put: vi.fn(),
  };
  return {
    default: mockApi,
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

interface MockDocument {
  id: string;
  title: string;
  type: string;
  version: string;
  nextReviewDate: string | null;
  owner: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}

describe('SetReviewDateModal', () => {
  const mockOnClose = vi.fn();
  const mockDocument: MockDocument = {
    id: 'doc-1',
    title: 'Test Document',
    type: 'POLICY',
    version: '1.0',
    nextReviewDate: null,
    owner: {
      id: 'user-1',
      displayName: 'John Doe',
      email: 'john.doe@example.com',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockReturnValue(undefined);
  });

  describe('Rendering', () => {
    it('should render modal when isOpen is true', async () => {
      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });
    });

    it('should not render modal when isOpen is false', () => {
      render(
        <SetReviewDateModal
          isOpen={false}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      expect(screen.queryByText('Schedule Review')).not.toBeInTheDocument();
    });

    it('should display document information correctly', async () => {
      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Document')).toBeInTheDocument();
        expect(screen.getByText('POLICY')).toBeInTheDocument();
        expect(screen.getByText('v1.0')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should display owner email when displayName is not available', async () => {
      const documentWithoutDisplayName: MockDocument = {
        ...mockDocument,
        owner: {
          id: 'user-1',
          displayName: '',
          email: 'john.doe@example.com',
        },
      };

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={documentWithoutDisplayName}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      });
    });

    it('should not display owner section when owner is null', async () => {
      const documentWithoutOwner: MockDocument = {
        ...mockDocument,
        owner: null,
      };

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={documentWithoutOwner}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      // Owner section should not be rendered when owner is null
      expect(screen.queryByText('Owner')).not.toBeInTheDocument();
    });

    it('should display current next review date when available', async () => {
      const documentWithReviewDate: MockDocument = {
        ...mockDocument,
        nextReviewDate: '2024-12-31T00:00:00Z',
      };

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={documentWithReviewDate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Current Next Review Date')).toBeInTheDocument();
        expect(screen.getByText('31/12/2024')).toBeInTheDocument();
      });
    });

    it('should not display current next review date section when nextReviewDate is null', async () => {
      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Current Next Review Date')).not.toBeInTheDocument();
      });
    });

    it('should display N/A for type when type is not available', async () => {
      const documentWithoutType: MockDocument = {
        ...mockDocument,
        type: '',
      };

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={documentWithoutType}
        />
      );

      await waitFor(() => {
        const naTexts = screen.getAllByText('N/A');
        expect(naTexts.length).toBeGreaterThan(0);
      });
    });

    it('should display N/A for version when version is not available', async () => {
      const documentWithoutVersion: MockDocument = {
        ...mockDocument,
        version: '',
      };

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={documentWithoutVersion}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('vN/A')).toBeInTheDocument();
      });
    });
  });

  describe('Date Input Default Value', () => {
    it('should set default date to 1 year from today when document has no nextReviewDate', async () => {
      const today = new Date();
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      const expectedDate = nextYear.toISOString().split('T')[0];

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        const dateInput = screen.getByLabelText(/next review date/i) as HTMLInputElement;
        expect(dateInput.value).toBe(expectedDate);
      });
    });

    it('should set default date to document nextReviewDate when available', async () => {
      const documentWithReviewDate: MockDocument = {
        ...mockDocument,
        nextReviewDate: '2024-12-31T00:00:00Z',
      };
      const expectedDate = '2024-12-31';

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={documentWithReviewDate}
        />
      );

      await waitFor(() => {
        const dateInput = screen.getByLabelText(/next review date/i) as HTMLInputElement;
        expect(dateInput.value).toBe(expectedDate);
      });
    });

    it('should update date input when document changes', async () => {
      const { rerender } = render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const documentWithNewDate: MockDocument = {
        ...mockDocument,
        nextReviewDate: '2025-06-15T00:00:00Z',
      };

      rerender(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={documentWithNewDate}
        />
      );

      await waitFor(() => {
        const dateInput = screen.getByLabelText(/next review date/i) as HTMLInputElement;
        expect(dateInput.value).toBe('2025-06-15');
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid date and call API', async () => {
      const user = userEvent.setup();
      vi.mocked(api.put).mockResolvedValue({ data: {} });

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const dateInput = screen.getByLabelText(/next review date/i);
      await user.clear(dateInput);
      await user.type(dateInput, '2025-12-31');

      const submitButton = screen.getByRole('button', { name: /set review date/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith('/api/documents/doc-1', {
          nextReviewDate: '2025-12-31',
        });
      });
    });

    it('should show success toast and call onClose with true on successful submission', async () => {
      const user = userEvent.setup();
      vi.mocked(api.put).mockResolvedValue({ data: {} });

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /set review date/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Success',
            description: 'Review date set successfully',
            status: 'success',
            duration: 3000,
            isClosable: true,
            position: 'top-right',
          })
        );
        expect(mockOnClose).toHaveBeenCalledWith(true);
      });
    });

    it('should not submit when date is empty due to HTML5 validation', async () => {
      const user = userEvent.setup();
      vi.mocked(api.put).mockResolvedValue({ data: {} });

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const dateInput = screen.getByLabelText(/next review date/i) as HTMLInputElement;
      await user.clear(dateInput);

      const submitButton = screen.getByRole('button', { name: /set review date/i });
      await user.click(submitButton);

      // HTML5 validation should prevent form submission when required field is empty
      // Wait a bit to ensure no API call is made
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(api.put).not.toHaveBeenCalled();
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(api.put).mockReturnValue(promise as Promise<unknown>);

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /set review date/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });

      // Resolve the promise to complete the test
      resolvePromise!({ data: {} });
      await promise;
    });
  });

  describe('Error Handling', () => {
    it('should show error toast when API call fails', async () => {
      const user = userEvent.setup();
      const errorResponse = {
        response: {
          data: {
            error: 'Failed to update document',
          },
        },
      };
      vi.mocked(api.put).mockRejectedValue(errorResponse);

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /set review date/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to update document',
            status: 'error',
            duration: 5000,
            isClosable: true,
            position: 'top-right',
          })
        );
      });
    });

    it('should show generic error message when error response has no error message', async () => {
      const user = userEvent.setup();
      vi.mocked(api.put).mockRejectedValue(new Error('Network error'));

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /set review date/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to set review date',
            status: 'error',
          })
        );
      });
    });

    it('should not call onClose when API call fails', async () => {
      const user = userEvent.setup();
      vi.mocked(api.put).mockRejectedValue(new Error('Network error'));

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /set review date/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });

      // onClose should not be called with true on error
      expect(mockOnClose).not.toHaveBeenCalledWith(true);
    });
  });

  describe('Modal Interactions', () => {
    it('should call onClose with false when cancel button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledWith(false);
    });

    it('should call onClose with false when close button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledWith(false);
    });

    it('should allow user to change date input', async () => {
      const user = userEvent.setup();

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const dateInput = screen.getByLabelText(/next review date/i) as HTMLInputElement;
      await user.clear(dateInput);
      await user.type(dateInput, '2025-06-15');

      expect(dateInput.value).toBe('2025-06-15');
    });
  });

  describe('Edge Cases', () => {
    it('should handle document being null gracefully', async () => {
      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={null}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      // Should still render the form, but without document info
      expect(screen.queryByText('Test Document')).not.toBeInTheDocument();
      
      // Date input should still be rendered even when document is null
      await waitFor(() => {
        const dateInput = screen.getByLabelText(/next review date/i);
        expect(dateInput).toBeInTheDocument();
      });
    });

    it('should not submit when document is null', async () => {
      const user = userEvent.setup();

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={null}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /set review date/i });
      await user.click(submitButton);

      // Should not call API when document is null
      await waitFor(() => {
        expect(api.put).not.toHaveBeenCalled();
      });
    });

    it('should handle date input changes correctly', async () => {
      const user = userEvent.setup();

      render(
        <SetReviewDateModal
          isOpen={true}
          onClose={mockOnClose}
          document={mockDocument}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Schedule Review')).toBeInTheDocument();
      });

      const dateInput = screen.getByLabelText(/next review date/i) as HTMLInputElement;
      const initialValue = dateInput.value;

      // Change the date
      await user.clear(dateInput);
      await user.type(dateInput, '2025-12-25');

      expect(dateInput.value).toBe('2025-12-25');
      expect(dateInput.value).not.toBe(initialValue);
    });
  });
});

