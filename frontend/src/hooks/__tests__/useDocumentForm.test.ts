import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDocumentForm } from '../useDocumentForm';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '@chakra-ui/react';

// Mock dependencies
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual('@chakra-ui/react');
  return {
    ...actual,
    useToast: vi.fn(),
  };
});

describe('useDocumentForm', () => {
  const mockToast = vi.fn();
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'ADMIN',
  };
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
      roleOverride: null,
      setRoleOverride: vi.fn(),
      getEffectiveRole: () => 'ADMIN',
      departmentOverride: null,
      setDepartmentOverride: vi.fn(),
      getUserDepartment: () => null,
    } as never);
    vi.mocked(useToast).mockReturnValue(mockToast as never);
  });

  it('should initialize with default form data for new document', () => {
    const { result } = renderHook(() =>
      useDocumentForm({
        document: null,
        isOpen: true,
        isReviewContext: false,
        readOnly: false,
        onClose: mockOnClose,
      })
    );

    expect(result.current.formData.title).toBe('');
    expect(result.current.formData.type).toBe('POLICY');
    expect(result.current.formData.status).toBe('DRAFT');
    expect(result.current.formData.version).toBe('1.0');
    expect(result.current.formData.ownerUserId).toBe('user-1');
  });

  it('should initialize with document data when editing', async () => {
    const mockDocument = {
      id: 'doc-1',
      title: 'Test Document',
      type: 'POLICY',
      storageLocation: 'SHAREPOINT',
      version: '1.0',
      status: 'APPROVED',
      lastReviewDate: '2024-01-01T00:00:00Z',
      nextReviewDate: '2025-01-01T00:00:00Z',
      requiresAcknowledgement: true,
      ownerUserId: 'user-1',
      sharePointSiteId: 'site-1',
      sharePointDriveId: 'drive-1',
      sharePointItemId: 'item-1',
    };

    vi.mocked(api.get).mockResolvedValueOnce({ data: { notes: 'Version notes' } });

    const { result } = renderHook(() =>
      useDocumentForm({
        document: mockDocument,
        isOpen: true,
        isReviewContext: false,
        readOnly: false,
        onClose: mockOnClose,
      })
    );

    await waitFor(() => {
      expect(result.current.formData.title).toBe('Test Document');
    });

    expect(result.current.formData.type).toBe('POLICY');
    expect(result.current.formData.status).toBe('APPROVED');
    expect(result.current.formData.versionNotes).toBe('Version notes');
  });

  it('should reset form when modal closes', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) =>
        useDocumentForm({
          document: null,
          isOpen,
          isReviewContext: false,
          readOnly: false,
          onClose: mockOnClose,
        }),
      {
        initialProps: { isOpen: true },
      }
    );

    // Update form data
    act(() => {
      result.current.setFormData((prev) => ({ ...prev, title: 'Changed Title' }));
    });

    expect(result.current.formData.title).toBe('Changed Title');

    // Close modal
    rerender({ isOpen: false });

    // Reopen modal
    rerender({ isOpen: true });

    expect(result.current.formData.title).toBe('');
  });

  it('should create document successfully', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 'doc-1' } });

    const { result } = renderHook(() =>
      useDocumentForm({
        document: null,
        isOpen: true,
        isReviewContext: false,
        readOnly: false,
        onClose: mockOnClose,
      })
    );

    await waitFor(() => {
      expect(result.current.formData.title).toBe('');
    });

    act(() => {
      result.current.setFormData((prev) => ({ ...prev, title: 'New Document' }));
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.post).toHaveBeenCalledWith(
      '/api/documents',
      expect.objectContaining({
        title: 'New Document',
      })
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Success',
        description: 'Document created successfully',
      })
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should update document successfully', async () => {
    const mockDocument = {
      id: 'doc-1',
      title: 'Test Document',
      type: 'POLICY',
      storageLocation: 'SHAREPOINT',
      version: '1.0',
      status: 'APPROVED',
      lastReviewDate: null,
      nextReviewDate: null,
      ownerUserId: 'user-1',
    };

    vi.mocked(api.get).mockResolvedValueOnce({ data: { notes: '' } });
    vi.mocked(api.put).mockResolvedValueOnce({ data: mockDocument });

    const { result } = renderHook(() =>
      useDocumentForm({
        document: mockDocument,
        isOpen: true,
        isReviewContext: false,
        readOnly: false,
        onClose: mockOnClose,
      })
    );

    await waitFor(() => {
      expect(result.current.formData.title).toBe('Test Document');
    });

    act(() => {
      result.current.setFormData((prev) => ({ ...prev, title: 'Updated Document' }));
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.put).toHaveBeenCalledWith(
      '/api/documents/doc-1',
      expect.objectContaining({
        title: 'Updated Document',
      })
    );
    expect(api.put).toHaveBeenCalledWith(
      '/api/documents/doc-1',
      expect.not.objectContaining({
        version: expect.anything(),
      })
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Success',
        description: 'Document updated successfully',
      })
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle form submission errors', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useDocumentForm({
        document: null,
        isOpen: true,
        isReviewContext: false,
        readOnly: false,
        onClose: mockOnClose,
      })
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'Failed to save document',
      })
    );
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should close modal without submitting when readOnly', async () => {
    const { result } = renderHook(() =>
      useDocumentForm({
        document: null,
        isOpen: true,
        isReviewContext: false,
        readOnly: true,
        onClose: mockOnClose,
      })
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle version update success', async () => {
    const mockDocument = {
      id: 'doc-1',
      title: 'Test Document',
      type: 'POLICY',
      storageLocation: 'SHAREPOINT',
      version: '1.0',
      status: 'APPROVED',
      lastReviewDate: '2024-01-01T00:00:00Z',
      nextReviewDate: '2025-01-01T00:00:00Z',
      ownerUserId: 'user-1',
    };

    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { notes: '' } })
      .mockResolvedValueOnce({
        data: { ...mockDocument, version: '1.1', lastReviewDate: '2024-02-01T00:00:00Z', nextReviewDate: '2025-02-01T00:00:00Z' },
      })
      .mockResolvedValueOnce({ data: { notes: 'New version notes' } });

    const { result } = renderHook(() =>
      useDocumentForm({
        document: mockDocument,
        isOpen: true,
        isReviewContext: false,
        readOnly: false,
        onClose: mockOnClose,
      })
    );

    await waitFor(() => {
      expect(result.current.formData.version).toBe('1.0');
    });

    await act(async () => {
      await result.current.handleVersionUpdateSuccess();
    });

    await waitFor(() => {
      expect(result.current.formData.version).toBe('1.1');
    });

    expect(result.current.formData.versionNotes).toBe('New version notes');
  });
});


