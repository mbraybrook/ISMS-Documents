/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before importing authService (since it validates config at module load time)
vi.mock('../config', () => ({
  config: {
    apiUrl: 'http://localhost:4000',
    auth: {
      tenantId: 'test-tenant-id',
      clientId: 'test-client-id',
      redirectUri: 'http://localhost:3000',
    },
  },
}));

// Mock MSAL
vi.mock('@azure/msal-browser', () => {
  const mockMsalInstance = {
    initialize: vi.fn().mockResolvedValue(undefined),
    loginPopup: vi.fn(),
    loginRedirect: vi.fn(),
    logout: vi.fn(),
    logoutPopup: vi.fn(),
    logoutRedirect: vi.fn(),
    acquireTokenSilent: vi.fn(),
    getAllAccounts: vi.fn().mockReturnValue([]),
    getAccountByUsername: vi.fn(),
    handleRedirectPromise: vi.fn().mockResolvedValue(null),
    setActiveAccount: vi.fn(),
    getActiveAccount: vi.fn().mockReturnValue(null),
  };

  return {
    PublicClientApplication: vi.fn().mockImplementation(() => mockMsalInstance),
    InteractionType: {
      Popup: 'popup',
      Redirect: 'redirect',
    },
    BrowserCacheLocation: {
      LocalStorage: 'localStorage',
      SessionStorage: 'sessionStorage',
    },
    LogLevel: {
      Error: 0,
      Warning: 1,
      Info: 2,
      Verbose: 3,
      Trace: 4,
    },
  };
});

// Import authService after mocks are set up
import { authService, msalInstance } from '../authService';

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
    const mockAccount = {
      homeAccountId: 'test-account-id',
      username: 'test@paythru.com',
    };

    // Set up a current account first
    vi.mocked(msalInstance.getActiveAccount).mockReturnValue(mockAccount as any);
    vi.mocked(msalInstance.logoutPopup).mockResolvedValue(undefined);

    await authService.logout();

    expect(msalInstance.logoutPopup).toHaveBeenCalled();
  });

  it('should get access token', async () => {
    const mockToken = 'mock-access-token';
    const mockAccount = {
      homeAccountId: 'test-account-id',
      username: 'test@paythru.com',
    };

    // Set up account by simulating a login
    vi.mocked(msalInstance.loginPopup).mockResolvedValue({
      account: mockAccount,
      accessToken: 'initial-token',
    } as any);
    await authService.login();

    // Now test getting the access token
    vi.mocked(msalInstance.acquireTokenSilent).mockResolvedValue({
      accessToken: mockToken,
    } as any);

    const token = await authService.getAccessToken();

    expect(token).toBe(mockToken);
    expect(msalInstance.acquireTokenSilent).toHaveBeenCalled();
  });

  it('should return null if no account', async () => {
    // Clear any existing account by calling logout first
    vi.mocked(msalInstance.logoutPopup).mockResolvedValue(undefined);
    await authService.logout();

    // Make sure acquireTokenSilent is not called when there's no account
    vi.mocked(msalInstance.acquireTokenSilent).mockClear();

    const token = await authService.getAccessToken();

    expect(token).toBeNull();
    expect(msalInstance.acquireTokenSilent).not.toHaveBeenCalled();
  });

  it('should check if user is authenticated', async () => {
    const mockAccount = {
      homeAccountId: 'test-account-id',
      username: 'test@paythru.com',
    };

    // Set up account by simulating a login
    vi.mocked(msalInstance.loginPopup).mockResolvedValue({
      account: mockAccount,
      accessToken: 'initial-token',
    } as any);
    await authService.login();

    const isAuth = authService.isAuthenticated();

    expect(isAuth).toBe(true);
  });
});

