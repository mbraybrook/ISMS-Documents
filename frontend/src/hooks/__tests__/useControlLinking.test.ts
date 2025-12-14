import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useControlLinking } from '../useControlLinking';
import api from '../../services/api';
import { useToast } from '@chakra-ui/react';

// Mock dependencies
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual('@chakra-ui/react');
  return {
    ...actual,
    useToast: vi.fn(),
  };
});

describe('useControlLinking', () => {
  const mockToast = vi.fn();
  const mockFormData = {
    title: 'Test Document',
    type: 'POLICY',
    storageLocation: 'SHAREPOINT',
    version: '1.0',
    status: 'DRAFT',
    ownerUserId: 'user-1',
    sharePointSiteId: '',
    sharePointDriveId: '',
    sharePointItemId: '',
    confluenceSpaceKey: '',
    confluencePageId: '',
    lastReviewDate: '',
    nextReviewDate: '',
    requiresAcknowledgement: false,
    versionNotes: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue(mockToast as never);
    // Default mock for all API calls
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
  });

  it('should fetch linked controls when document ID is provided', async () => {
    const mockLinkedControls = [
      { id: 'control-1', code: 'A.1.1', title: 'Control 1', category: 'Security' },
    ];

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/documents/doc-1/controls')) {
        return Promise.resolve({ data: mockLinkedControls });
      }
      return Promise.resolve({ data: [] });
    });

    const { result } = renderHook(() =>
      useControlLinking({
        documentId: 'doc-1',
        formData: mockFormData,
        isOpen: true,
      })
    );

    await waitFor(
      () => {
        expect(result.current.loadingControls).toBe(false);
        expect(result.current.linkedControls.length).toBeGreaterThan(0);
      },
      { timeout: 5000 }
    );

    expect(api.get).toHaveBeenCalledWith('/api/documents/doc-1/controls');
    expect(result.current.linkedControls).toEqual(mockLinkedControls);
  }, 10000);

  it('should not fetch linked controls when document ID is not provided', () => {
    const { result } = renderHook(() =>
      useControlLinking({
        documentId: undefined,
        formData: mockFormData,
        isOpen: true,
      })
    );

    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.linkedControls).toHaveLength(0);
  });

  it('should search controls when search term is provided', async () => {
    const mockControls = [
      { id: 'control-1', code: 'A.1.1', title: 'Security Control', category: 'Security' },
      { id: 'control-2', code: 'A.1.2', title: 'Access Control', category: 'Security' },
    ];

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/documents/doc-1/controls')) {
        return Promise.resolve({ data: [] }); // linked controls
      }
      if (typeof url === 'string' && url.includes('/api/controls')) {
        return Promise.resolve({ data: { data: mockControls } }); // search results
      }
      return Promise.resolve({ data: [] });
    });

    const { result } = renderHook(() =>
      useControlLinking({
        documentId: 'doc-1',
        formData: mockFormData,
        isOpen: true,
      })
    );

    await waitFor(
      () => {
        expect(result.current.loadingControls).toBe(false);
      },
      { timeout: 5000 }
    );

    await act(async () => {
      result.current.setControlSearchTerm('security');
    });

    await act(async () => {
      await result.current.searchControls();
    });

    await waitFor(
      () => {
        expect(result.current.searchingControls).toBe(false);
        expect(result.current.availableControls.length).toBeGreaterThan(0);
      },
      { timeout: 5000 }
    );
  }, 15000);

  it('should link control successfully', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/documents/doc-1/controls')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });

    const { result } = renderHook(() =>
      useControlLinking({
        documentId: 'doc-1',
        formData: mockFormData,
        isOpen: true,
      })
    );

    // Wait for initial load to complete
    await waitFor(
      () => {
        expect(result.current.loadingControls).toBe(false);
      },
      { timeout: 5000 }
    );

    // Clear mocks to track only the link call
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    vi.mocked(api.post).mockResolvedValue({ data: {} });

    await act(async () => {
      await result.current.handleLinkControl('control-1');
    });

    await waitFor(
      () => {
        expect(api.post).toHaveBeenCalledWith('/api/documents/doc-1/controls', {
          controlId: 'control-1',
        });
      },
      { timeout: 2000 }
    );

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Success',
        description: 'Control linked successfully',
      })
    );
  }, 10000);

  it('should unlink control successfully', async () => {
    const mockLinkedControls = [
      { id: 'control-1', code: 'A.1.1', title: 'Control 1', category: 'Security' },
    ];

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/documents/doc-1/controls')) {
        return Promise.resolve({ data: mockLinkedControls });
      }
      return Promise.resolve({ data: [] });
    });
    vi.mocked(api.delete).mockResolvedValue({ data: {} });

    const { result } = renderHook(() =>
      useControlLinking({
        documentId: 'doc-1',
        formData: mockFormData,
        isOpen: true,
      })
    );

    await waitFor(
      () => {
        expect(result.current.loadingControls).toBe(false);
      },
      { timeout: 5000 }
    );

    // Clear mocks to track only the unlink call
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    vi.mocked(api.delete).mockResolvedValue({ data: {} });

    await act(async () => {
      await result.current.handleUnlinkControl('control-1');
    });

    await waitFor(
      () => {
        expect(api.delete).toHaveBeenCalledWith('/api/documents/doc-1/controls/control-1');
      },
      { timeout: 2000 }
    );

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Success',
        description: 'Control unlinked successfully',
      })
    );
  }, 10000);

  it('should fetch suggested controls when title changes (debounced)', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/documents/doc-1/controls')) {
        return Promise.resolve({ data: [] }); // linked controls
      }
      if (url.includes('/api/controls')) {
        return Promise.resolve({
          data: {
            data: [{ id: 'control-1', code: 'A.1.1', title: 'Suggested Control', category: 'Security' }],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    vi.mocked(api.post).mockResolvedValue({
      data: { suggestedControlIds: ['control-1'] },
    });

    const { result, rerender } = renderHook(
      ({ formData }) =>
        useControlLinking({
          documentId: 'doc-1',
          formData,
          isOpen: true,
        }),
      {
        initialProps: {
          formData: { ...mockFormData, title: 'Test' },
        },
      }
    );

    await waitFor(
      () => {
        expect(result.current.loadingControls).toBe(false);
      },
      { timeout: 5000 }
    );

    // Clear previous API calls
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/documents/doc-1/controls')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/api/controls')) {
        return Promise.resolve({
          data: {
            data: [{ id: 'control-1', code: 'A.1.1', title: 'Suggested Control', category: 'Security' }],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    vi.mocked(api.post).mockResolvedValue({
      data: { suggestedControlIds: ['control-1'] },
    });

    // Update title to trigger suggestion fetch
    rerender({
      formData: { ...mockFormData, title: 'Information Security Policy' },
    });

    // Wait for debounce (500ms) plus API call time
    await waitFor(
      () => {
        expect(api.post).toHaveBeenCalledWith('/api/documents/suggest-controls', {
          title: 'Information Security Policy',
          type: 'POLICY',
        });
      },
      { timeout: 2000 }
    );
  }, 10000);

  it('should not fetch suggestions when title is too short', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/documents/doc-1/controls')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    const { result } = renderHook(() =>
      useControlLinking({
        documentId: 'doc-1',
        formData: { ...mockFormData, title: 'AB' }, // Less than 3 characters
        isOpen: true,
      })
    );

    await waitFor(
      () => {
        expect(result.current.loadingControls).toBe(false);
      },
      { timeout: 5000 }
    );

    // Clear any previous calls
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: [] });

    // Wait for debounce time plus a bit more to ensure no API calls are made
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    expect(api.post).not.toHaveBeenCalledWith(
      '/api/documents/suggest-controls',
      expect.any(Object)
    );
    expect(result.current.suggestedControls).toHaveLength(0);
  }, 10000);
});

