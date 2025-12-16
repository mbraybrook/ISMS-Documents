import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSharePointIntegration } from '../useSharePointIntegration';
import api from '../../services/api';
import { authService } from '../../services/authService';
import { useToast } from '@chakra-ui/react';

// Mock dependencies
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../services/authService', () => ({
  authService: {
    getGraphAccessToken: vi.fn(),
  },
}));

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual('@chakra-ui/react');
  return {
    ...actual,
    useToast: vi.fn(),
  };
});

describe('useSharePointIntegration', () => {
  const mockToast = vi.fn();
  let mockFormData = {
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
  const mockSetFormData = vi.fn((updater) => {
    if (typeof updater === 'function') {
      mockFormData = updater(mockFormData);
    } else {
      Object.assign(mockFormData, updater);
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue(mockToast as never);
    vi.mocked(authService.getGraphAccessToken).mockResolvedValue('graph-token');
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() =>
      useSharePointIntegration({
        formData: mockFormData,
        setFormData: mockSetFormData,
        document: null,
      })
    );

    expect(result.current.sharePointUrl).toBe('');
    expect(result.current.parsingUrl).toBe(false);
    expect(result.current.urlError).toBe(null);
    expect(result.current.browserOpen).toBe(false);
    expect(result.current.showReplaceOptions).toBe(false);
    expect(result.current.documentUrl).toBe(null);
    expect(result.current.loadingUrl).toBe(false);
  });

  it('should parse SharePoint URL successfully', async () => {
    const mockParsedData = {
      siteId: 'site-1',
      driveId: 'drive-1',
      itemId: 'item-1',
      name: 'Parsed File.docx',
    };

    vi.mocked(api.post).mockResolvedValueOnce({ data: mockParsedData });

    const { result } = renderHook(() =>
      useSharePointIntegration({
        formData: mockFormData,
        setFormData: mockSetFormData,
        document: null,
      })
    );

    act(() => {
      result.current.setSharePointUrl('https://sharepoint.com/file');
    });

    await act(async () => {
      await result.current.handleParseUrl();
    });

    await waitFor(() => {
      expect(result.current.parsingUrl).toBe(false);
    });

    expect(api.post).toHaveBeenCalledWith(
      '/api/sharepoint/parse-url',
      { url: 'https://sharepoint.com/file' },
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-graph-token': 'graph-token',
        }),
      })
    );
    expect(mockSetFormData).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Success',
        description: 'SharePoint URL parsed successfully',
      })
    );
  });

  it('should show error when URL parsing fails', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: {
        data: { error: 'Invalid URL format' },
      },
    });

    const { result } = renderHook(() =>
      useSharePointIntegration({
        formData: mockFormData,
        setFormData: mockSetFormData,
        document: null,
      })
    );

    act(() => {
      result.current.setSharePointUrl('invalid-url');
    });

    await act(async () => {
      await result.current.handleParseUrl();
    });

    await waitFor(() => {
      expect(result.current.parsingUrl).toBe(false);
    });

    expect(result.current.urlError).toContain('Invalid URL format');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        status: 'error',
      })
    );
  });

  it('should show error when Graph token is unavailable', async () => {
    vi.mocked(authService.getGraphAccessToken).mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useSharePointIntegration({
        formData: mockFormData,
        setFormData: mockSetFormData,
        document: null,
      })
    );

    act(() => {
      result.current.setSharePointUrl('https://sharepoint.com/file');
    });

    await act(async () => {
      await result.current.handleParseUrl();
    });

    await waitFor(() => {
      expect(result.current.parsingUrl).toBe(false);
    });

    expect(result.current.urlError).toContain('Unable to get access token');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('should handle file selection', async () => {
    const mockItem = {
      id: 'item-1',
      name: 'Selected File.docx',
      siteId: 'site-1',
      driveId: 'drive-1',
    };

    const { result } = renderHook(() =>
      useSharePointIntegration({
        formData: mockFormData,
        setFormData: mockSetFormData,
        document: null,
      })
    );

    await act(async () => {
      await result.current.handleFileSelect(mockItem);
    });

    expect(mockSetFormData).toHaveBeenCalled();
    expect(result.current.browserOpen).toBe(false);
    expect(result.current.showReplaceOptions).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Success',
        description: 'File selected from SharePoint',
      })
    );
  });

  it('should load document URL when document has SharePoint IDs', async () => {
    const mockDocument = {
      id: 'doc-1',
      sharePointSiteId: 'site-1',
      sharePointDriveId: 'drive-1',
      sharePointItemId: 'item-1',
      documentUrl: null,
    };

    vi.mocked(api.get).mockResolvedValueOnce({
      data: { webUrl: 'https://sharepoint.com/file' },
    });

    const { result } = renderHook(() =>
      useSharePointIntegration({
        formData: mockFormData,
        setFormData: mockSetFormData,
        document: mockDocument,
      })
    );

    await act(async () => {
      await result.current.loadDocumentUrl(mockDocument);
    });

    await waitFor(() => {
      expect(result.current.loadingUrl).toBe(false);
    });

    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/sharepoint/items/item-1'),
      expect.any(Object)
    );
    expect(result.current.documentUrl).toBe('https://sharepoint.com/file');
  });

  it('should use stored documentUrl if available', async () => {
    const mockDocument = {
      id: 'doc-1',
      sharePointSiteId: 'site-1',
      sharePointDriveId: 'drive-1',
      sharePointItemId: 'item-1',
      documentUrl: 'https://stored-url.com/file',
    };

    const { result } = renderHook(() =>
      useSharePointIntegration({
        formData: mockFormData,
        setFormData: mockSetFormData,
        document: mockDocument,
      })
    );

    await act(async () => {
      await result.current.loadDocumentUrl(mockDocument);
    });

    expect(result.current.documentUrl).toBe('https://stored-url.com/file');
    expect(api.get).not.toHaveBeenCalled();
  });
});


