import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ChakraProvider } from '@chakra-ui/react';
import { NDAAcceptanceModal } from '../NDAAcceptanceModal';
import { trustApi } from '../../services/trustApi';
import { useTrustAuth } from '../../contexts/TrustAuthContext';
import { useToast } from '@chakra-ui/react';

// Mock trustApi
vi.mock('../../services/trustApi', () => ({
  trustApi: {
    acceptTerms: vi.fn(),
  },
}));

// Mock useTrustAuth
const mockRefreshUser = vi.fn();
vi.mock('../../contexts/TrustAuthContext', () => ({
  useTrustAuth: vi.fn(),
}));

// Mock useToast
const mockToast = vi.fn();
vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual('@chakra-ui/react');
  return {
    ...actual,
    useToast: vi.fn(),
  };
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<ChakraProvider>{ui}</ChakraProvider>);
};

describe('NDAAcceptanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTrustAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      refreshUser: mockRefreshUser,
    });
    (useToast as ReturnType<typeof vi.fn>).mockReturnValue(mockToast);
  });

  describe('Rendering', () => {
    it('should render modal when isOpen is true', () => {
      // Arrange
      const onClose = vi.fn();

      // Act
      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);

      // Assert
      expect(screen.getByText('Accept Terms and Conditions')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      // Arrange
      const onClose = vi.fn();

      // Act
      renderWithProviders(<NDAAcceptanceModal isOpen={false} onClose={onClose} />);

      // Assert
      expect(screen.queryByText('Accept Terms and Conditions')).not.toBeInTheDocument();
    });

    it('should display correct header text', () => {
      // Arrange
      const onClose = vi.fn();

      // Act
      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);

      // Assert
      expect(screen.getByText('Accept Terms and Conditions')).toBeInTheDocument();
    });

    it('should display correct body text', () => {
      // Arrange
      const onClose = vi.fn();

      // Act
      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);

      // Assert
      expect(
        screen.getByText(
          'To access private documents, you must accept our Terms and Conditions and Non-Disclosure Agreement.',
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'By clicking "Accept", you agree to keep all confidential information private and not share it with unauthorized parties.',
        ),
      ).toBeInTheDocument();
    });

    it('should render Cancel button as disabled', () => {
      // Arrange
      const onClose = vi.fn();

      // Act
      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);

      // Assert
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });

    it('should render Accept button', () => {
      // Arrange
      const onClose = vi.fn();

      // Act
      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);

      // Assert
      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    });
  });

  describe('Accept Terms Flow', () => {
    it('should call trustApi.acceptTerms when Accept button is clicked', async () => {
      // Arrange
      const onClose = vi.fn();
      (trustApi.acceptTerms as ReturnType<typeof vi.fn>).mockResolvedValue({ message: 'Terms accepted' });
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);
      const acceptButton = screen.getByRole('button', { name: /accept/i });

      // Act
      fireEvent.click(acceptButton);

      // Assert
      await waitFor(() => {
        expect(trustApi.acceptTerms).toHaveBeenCalledTimes(1);
      });
    });

    it('should call refreshUser after successful terms acceptance', async () => {
      // Arrange
      const onClose = vi.fn();
      (trustApi.acceptTerms as ReturnType<typeof vi.fn>).mockResolvedValue({ message: 'Terms accepted' });
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);
      const acceptButton = screen.getByRole('button', { name: /accept/i });

      // Act
      fireEvent.click(acceptButton);

      // Assert
      await waitFor(() => {
        expect(mockRefreshUser).toHaveBeenCalledTimes(1);
      });
    });

    it('should show success toast after successful terms acceptance', async () => {
      // Arrange
      const onClose = vi.fn();
      (trustApi.acceptTerms as ReturnType<typeof vi.fn>).mockResolvedValue({ message: 'Terms accepted' });
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);
      const acceptButton = screen.getByRole('button', { name: /accept/i });

      // Act
      fireEvent.click(acceptButton);

      // Assert
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Terms accepted',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      });
    });

    it('should call onClose after successful terms acceptance', async () => {
      // Arrange
      const onClose = vi.fn();
      (trustApi.acceptTerms as ReturnType<typeof vi.fn>).mockResolvedValue({ message: 'Terms accepted' });
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);
      const acceptButton = screen.getByRole('button', { name: /accept/i });

      // Act
      fireEvent.click(acceptButton);

      // Assert
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast with error message when API call fails with response.data.error', async () => {
      // Arrange
      const onClose = vi.fn();
      const errorResponse = {
        response: {
          data: {
            error: 'Network error occurred',
          },
        },
      };
      (trustApi.acceptTerms as ReturnType<typeof vi.fn>).mockRejectedValue(errorResponse);

      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);
      const acceptButton = screen.getByRole('button', { name: /accept/i });

      // Act
      fireEvent.click(acceptButton);

      // Assert
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to accept terms',
          description: 'Network error occurred',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should show error toast with fallback message when API call fails without response.data.error', async () => {
      // Arrange
      const onClose = vi.fn();
      const errorResponse = {
        response: {
          data: {},
        },
      };
      (trustApi.acceptTerms as ReturnType<typeof vi.fn>).mockRejectedValue(errorResponse);

      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);
      const acceptButton = screen.getByRole('button', { name: /accept/i });

      // Act
      fireEvent.click(acceptButton);

      // Assert
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to accept terms',
          description: 'An error occurred',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should show error toast with fallback message when API call fails without response', async () => {
      // Arrange
      const onClose = vi.fn();
      const errorResponse = new Error('Network failure');
      (trustApi.acceptTerms as ReturnType<typeof vi.fn>).mockRejectedValue(errorResponse);

      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);
      const acceptButton = screen.getByRole('button', { name: /accept/i });

      // Act
      fireEvent.click(acceptButton);

      // Assert
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to accept terms',
          description: 'An error occurred',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should show error toast with fallback message when error is not an object', async () => {
      // Arrange
      const onClose = vi.fn();
      (trustApi.acceptTerms as ReturnType<typeof vi.fn>).mockRejectedValue('String error');

      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);
      const acceptButton = screen.getByRole('button', { name: /accept/i });

      // Act
      fireEvent.click(acceptButton);

      // Assert
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to accept terms',
          description: 'An error occurred',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should show error toast with fallback message when error.response.data is not an object', async () => {
      // Arrange
      const onClose = vi.fn();
      const errorResponse = {
        response: {
          data: 'String data',
        },
      };
      (trustApi.acceptTerms as ReturnType<typeof vi.fn>).mockRejectedValue(errorResponse);

      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);
      const acceptButton = screen.getByRole('button', { name: /accept/i });

      // Act
      fireEvent.click(acceptButton);

      // Assert
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to accept terms',
          description: 'An error occurred',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should show error toast with fallback message when error.response.data.error is not a string', async () => {
      // Arrange
      const onClose = vi.fn();
      const errorResponse = {
        response: {
          data: {
            error: 123,
          },
        },
      };
      (trustApi.acceptTerms as ReturnType<typeof vi.fn>).mockRejectedValue(errorResponse);

      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);
      const acceptButton = screen.getByRole('button', { name: /accept/i });

      // Act
      fireEvent.click(acceptButton);

      // Assert
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to accept terms',
          description: 'An error occurred',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Modal Behavior', () => {
    it('should not call onClose when clicking Cancel button since it is disabled', () => {
      // Arrange
      const onClose = vi.fn();

      renderWithProviders(<NDAAcceptanceModal isOpen={true} onClose={onClose} />);
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      // Act
      fireEvent.click(cancelButton);

      // Assert
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

