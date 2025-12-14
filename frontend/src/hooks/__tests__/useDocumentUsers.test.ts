import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDocumentUsers } from '../useDocumentUsers';
import api from '../../services/api';
import { useToast } from '@chakra-ui/react';

// Mock dependencies
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('@chakra-ui/react', async () => {
  const actual = await vi.importActual('@chakra-ui/react');
  return {
    ...actual,
    useToast: vi.fn(),
  };
});

describe('useDocumentUsers', () => {
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue(mockToast as never);
  });

  it('should fetch users when modal opens and user can edit owner', async () => {
    const mockUsers = [
      { id: 'user-1', displayName: 'Admin User', email: 'admin@example.com', role: 'ADMIN' },
      { id: 'user-2', displayName: 'Editor User', email: 'editor@example.com', role: 'EDITOR' },
      { id: 'user-3', displayName: 'Staff User', email: 'staff@example.com', role: 'STAFF' },
    ];

    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: mockUsers } });

    const { result } = renderHook(() =>
      useDocumentUsers({
        documentOwnerUserId: undefined,
        canEditOwner: true,
        isOpen: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loadingUsers).toBe(false);
    });

    expect(api.get).toHaveBeenCalledWith('/api/users');
    expect(result.current.users).toHaveLength(2); // Only Admin and Editor
    expect(result.current.users.every((u) => u.role === 'ADMIN' || u.role === 'EDITOR')).toBe(true);
  });

  it('should not fetch users when user cannot edit owner', () => {
    const { result } = renderHook(() =>
      useDocumentUsers({
        documentOwnerUserId: undefined,
        canEditOwner: false,
        isOpen: true,
      })
    );

    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.users).toHaveLength(0);
  });

  it('should not fetch users when modal is closed', () => {
    const { result } = renderHook(() =>
      useDocumentUsers({
        documentOwnerUserId: undefined,
        canEditOwner: true,
        isOpen: false,
      })
    );

    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.users).toHaveLength(0);
  });

  it('should include current owner even if not Admin/Editor', async () => {
    const mockUsers = [
      { id: 'user-1', displayName: 'Admin User', email: 'admin@example.com', role: 'ADMIN' },
      { id: 'user-2', displayName: 'Staff User', email: 'staff@example.com', role: 'STAFF' },
    ];

    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: mockUsers } });

    const { result } = renderHook(() =>
      useDocumentUsers({
        documentOwnerUserId: 'user-2',
        canEditOwner: true,
        isOpen: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loadingUsers).toBe(false);
    });

    expect(result.current.users).toHaveLength(2); // Admin + Staff (current owner)
    expect(result.current.users.find((u) => u.id === 'user-2')).toBeDefined();
  });

  it('should handle error when fetching users fails', async () => {
    // Suppress expected error logs
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useDocumentUsers({
        documentOwnerUserId: undefined,
        canEditOwner: true,
        isOpen: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loadingUsers).toBe(false);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'Failed to load users for owner selection',
        status: 'error',
      })
    );

    consoleSpy.mockRestore();
  });
});


