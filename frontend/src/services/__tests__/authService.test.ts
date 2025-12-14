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

// Unmock authService to test the real implementation
// The global mock in test/mocks/authService.ts would otherwise override it
vi.unmock('../authService');

// MSAL is already mocked globally in test/mocks/msal.ts
// Import the mock instance so we can spy on it
import { mockMsalInstance } from '../../test/mocks/msal';

// Import authService after mocks are set up
import { authService } from '../authService';

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset MSAL mock defaults to ensure clean state
    // Use the exported mock instance which is the same one used by authService
    mockMsalInstance.getActiveAccount.mockReturnValue(null);
    mockMsalInstance.getAllAccounts.mockReturnValue([]);
    mockMsalInstance.acquireTokenSilent.mockResolvedValue({
      accessToken: 'mock-access-token',
      idToken: 'mock-id-token',
      account: null,
    } as any);
  });

  it('should initialize MSAL', async () => {
    mockMsalInstance.initialize.mockResolvedValue(undefined);
    await authService.initialize();

    expect(mockMsalInstance.initialize).toHaveBeenCalled();
  });

  it('should handle login with popup', async () => {
    const mockAccount = {
      homeAccountId: 'test-account-id',
      username: 'test@paythru.com',
      environment: 'login.microsoftonline.com',
      tenantId: 'test-tenant-id',
      localAccountId: 'test-local-account-id',
      name: 'Test User',
    };
    const mockResponse = {
      account: mockAccount,
      accessToken: 'mock-token',
    };

    mockMsalInstance.loginPopup.mockResolvedValue(mockResponse as any);

    await authService.login();

    expect(mockMsalInstance.loginPopup).toHaveBeenCalled();
  });

  it('should handle login with redirect on popup failure', async () => {
    const popupError = {
      errorCode: 'user_cancelled',
      name: 'BrowserAuthError',
    };

    mockMsalInstance.loginPopup.mockRejectedValue(popupError);
    mockMsalInstance.loginRedirect.mockResolvedValue(undefined as any);

    await authService.login();

    expect(mockMsalInstance.loginPopup).toHaveBeenCalled();
    expect(mockMsalInstance.loginRedirect).toHaveBeenCalled();
  });

  it('should handle logout', async () => {
    const mockAccount = {
      homeAccountId: 'test-account-id',
      username: 'test@paythru.com',
      environment: 'login.microsoftonline.com',
      tenantId: 'test-tenant-id',
      localAccountId: 'test-local-account-id',
      name: 'Test User',
    };

    // Set up a current account by logging in first
    mockMsalInstance.loginPopup.mockResolvedValue({
      account: mockAccount,
      accessToken: 'initial-token',
    } as any);
    await authService.login();
    
    mockMsalInstance.logoutPopup.mockResolvedValue(undefined);

    await authService.logout();

    expect(mockMsalInstance.logoutPopup).toHaveBeenCalled();
  });

  it('should get access token', async () => {
    const mockToken = 'mock-access-token';
    const mockAccount = {
      homeAccountId: 'test-account-id',
      username: 'test@paythru.com',
      environment: 'login.microsoftonline.com',
      tenantId: 'test-tenant-id',
      localAccountId: 'test-local-account-id',
      name: 'Test User',
    };

    // Set up account by simulating a login
    mockMsalInstance.loginPopup.mockResolvedValue({
      account: mockAccount,
      accessToken: 'initial-token',
    } as any);
    await authService.login();

    // Now test getting the access token
    mockMsalInstance.acquireTokenSilent.mockResolvedValue({
      accessToken: mockToken,
      account: mockAccount,
    } as any);

    const token = await authService.getAccessToken();

    expect(token).toBe(mockToken);
    expect(mockMsalInstance.acquireTokenSilent).toHaveBeenCalled();
  });

  it('should return null if no account', async () => {
    // Ensure no account exists - the beforeEach already sets these to null/empty
    // But we need to make sure currentAccount is null by not calling login
    // The authService maintains currentAccount internally, so if it was set in a previous test,
    // we need to clear it. Since we can't access it directly, we ensure getAllAccounts is empty
    // and initialize doesn't set it.
    mockMsalInstance.getActiveAccount.mockReturnValue(null);
    mockMsalInstance.getAllAccounts.mockReturnValue([]);
    
    // Call initialize to ensure currentAccount is null (since getAllAccounts is empty)
    await authService.initialize();

    const token = await authService.getAccessToken();

    expect(token).toBeNull();
  });

  it('should check if user is authenticated', async () => {
    const mockAccount = {
      homeAccountId: 'test-account-id',
      username: 'test@paythru.com',
      environment: 'login.microsoftonline.com',
      tenantId: 'test-tenant-id',
      localAccountId: 'test-local-account-id',
      name: 'Test User',
    };

    // Set up account by simulating a login (this sets currentAccount internally)
    mockMsalInstance.loginPopup.mockResolvedValue({
      account: mockAccount,
      accessToken: 'initial-token',
    } as any);
    await authService.login();

    const isAuth = authService.isAuthenticated();

    expect(isAuth).toBe(true);
  });
});

