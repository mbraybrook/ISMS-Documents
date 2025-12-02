import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { authService } from '../../services/authService';
import axios from 'axios';

// Mock auth service
vi.mock('../../services/authService', () => ({
  authService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(false),
  },
  msalInstance: {
    handleRedirectPromise: vi.fn().mockResolvedValue(null),
  },
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// Mock MSAL
vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: vi.fn(),
  InteractionType: {
    Popup: 'popup',
    Redirect: 'redirect',
  },
}));

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide auth context', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider>{children}</AuthProvider>
      ),
    });

    expect(result.current).toBeDefined();
    expect(result.current.login).toBeDefined();
    expect(result.current.logout).toBeDefined();
    expect(result.current.isAuthenticated).toBeDefined();
  });

  it('should handle login', async () => {
    const mockToken = 'mock-token';
    const mockUser = {
      id: 'user-1',
      email: 'test@paythru.com',
      displayName: 'Test User',
      role: 'ADMIN',
    };

    vi.mocked(authService.login).mockResolvedValue(undefined);
    vi.mocked(authService.getAccessToken).mockResolvedValue(mockToken);
    vi.mocked(axios.post).mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider>{children}</AuthProvider>
      ),
    });

    await act(async () => {
      await result.current.login();
    });

    expect(authService.login).toHaveBeenCalled();
  });

  it('should handle logout', async () => {
    vi.mocked(authService.logout).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider>{children}</AuthProvider>
      ),
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(authService.logout).toHaveBeenCalled();
  });

  it('should sync user on mount', async () => {
    const mockToken = 'mock-token';
    const mockUser = {
      id: 'user-1',
      email: 'test@paythru.com',
      displayName: 'Test User',
      role: 'ADMIN',
    };

    vi.mocked(authService.initialize).mockResolvedValue(undefined);
    vi.mocked(authService.getAccessToken).mockResolvedValue(mockToken);
    vi.mocked(authService.isAuthenticated).mockReturnValue(true);
    vi.mocked(axios.post).mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider>{children}</AuthProvider>
      ),
    });

    // Wait for sync to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    // User should be synced
    expect(axios.post).toHaveBeenCalled();
  });
});

