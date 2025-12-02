import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService, msalInstance } from '../authService';

// Mock MSAL
vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    loginPopup: vi.fn(),
    loginRedirect: vi.fn(),
    logout: vi.fn(),
    logoutRedirect: vi.fn(),
    acquireTokenSilent: vi.fn(),
    getAllAccounts: vi.fn().mockReturnValue([]),
    getAccountByUsername: vi.fn(),
    handleRedirectPromise: vi.fn().mockResolvedValue(null),
    setActiveAccount: vi.fn(),
    getActiveAccount: vi.fn().mockReturnValue(null),
  })),
  InteractionType: {
    Popup: 'popup',
    Redirect: 'redirect',
  },
  BrowserCacheLocation: {
    LocalStorage: 'localStorage',
    SessionStorage: 'sessionStorage',
  },
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize MSAL', async () => {
    await authService.initialize();

    expect(msalInstance.initialize).toHaveBeenCalled();
  });

  it('should handle login with popup', async () => {
    const mockAccount = {
      homeAccountId: 'test-account-id',
      username: 'test@paythru.com',
    };
    const mockResponse = {
      account: mockAccount,
      accessToken: 'mock-token',
    };

    vi.mocked(msalInstance.loginPopup).mockResolvedValue(mockResponse as any);

    await authService.login();

    expect(msalInstance.loginPopup).toHaveBeenCalled();
  });

  it('should handle login with redirect on popup failure', async () => {
    const popupError = {
      errorCode: 'user_cancelled',
      name: 'BrowserAuthError',
    };

    vi.mocked(msalInstance.loginPopup).mockRejectedValue(popupError);
    vi.mocked(msalInstance.loginRedirect).mockResolvedValue(undefined as any);

    await authService.login();

    expect(msalInstance.loginPopup).toHaveBeenCalled();
    expect(msalInstance.loginRedirect).toHaveBeenCalled();
  });

  it('should handle logout', async () => {
    vi.mocked(msalInstance.logout).mockResolvedValue(undefined);

    await authService.logout();

    expect(msalInstance.logout).toHaveBeenCalled();
  });

  it('should get access token', async () => {
    const mockToken = 'mock-access-token';
    const mockAccount = {
      homeAccountId: 'test-account-id',
      username: 'test@paythru.com',
    };

    vi.mocked(msalInstance.getActiveAccount).mockReturnValue(mockAccount as any);
    vi.mocked(msalInstance.acquireTokenSilent).mockResolvedValue({
      accessToken: mockToken,
    } as any);

    const token = await authService.getAccessToken();

    expect(token).toBe(mockToken);
    expect(msalInstance.acquireTokenSilent).toHaveBeenCalled();
  });

  it('should return null if no account', async () => {
    vi.mocked(msalInstance.getActiveAccount).mockReturnValue(null);
    vi.mocked(msalInstance.getAllAccounts).mockReturnValue([]);

    const token = await authService.getAccessToken();

    expect(token).toBeNull();
  });

  it('should check if user is authenticated', () => {
    const mockAccount = {
      homeAccountId: 'test-account-id',
      username: 'test@paythru.com',
    };

    vi.mocked(msalInstance.getActiveAccount).mockReturnValue(mockAccount as any);

    const isAuth = authService.isAuthenticated();

    expect(isAuth).toBe(true);
  });
});

