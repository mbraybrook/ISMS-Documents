import { vi } from 'vitest';

// Create mock instance that will be shared across all tests
// This ensures the same instance is used by authService and tests
export const mockMsalInstance = {
  loginPopup: vi.fn().mockResolvedValue({
    account: {
      homeAccountId: 'test-account-id',
      environment: 'login.microsoftonline.com',
      tenantId: 'test-tenant-id',
      username: 'test@paythru.com',
      localAccountId: 'test-local-account-id',
      name: 'Test User',
    },
    accessToken: 'mock-access-token',
    idToken: 'mock-id-token',
  }),
  loginRedirect: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  logoutPopup: vi.fn().mockResolvedValue(undefined),
  logoutRedirect: vi.fn().mockResolvedValue(undefined),
  acquireTokenSilent: vi.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    idToken: 'mock-id-token',
    account: {
      homeAccountId: 'test-account-id',
      environment: 'login.microsoftonline.com',
      tenantId: 'test-tenant-id',
      username: 'test@paythru.com',
      localAccountId: 'test-local-account-id',
      name: 'Test User',
    },
  }),
  acquireTokenPopup: vi.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    idToken: 'mock-id-token',
    account: {
      homeAccountId: 'test-account-id',
      environment: 'login.microsoftonline.com',
      tenantId: 'test-tenant-id',
      username: 'test@paythru.com',
      localAccountId: 'test-local-account-id',
      name: 'Test User',
    },
  }),
  acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
  getAllAccounts: vi.fn().mockReturnValue([
    {
      homeAccountId: 'test-account-id',
      environment: 'login.microsoftonline.com',
      tenantId: 'test-tenant-id',
      username: 'test@paythru.com',
      localAccountId: 'test-local-account-id',
      name: 'Test User',
    },
  ]),
  getAccountByUsername: vi.fn().mockReturnValue({
    homeAccountId: 'test-account-id',
    environment: 'login.microsoftonline.com',
    tenantId: 'test-tenant-id',
    username: 'test@paythru.com',
    localAccountId: 'test-local-account-id',
    name: 'Test User',
  }),
  initialize: vi.fn().mockResolvedValue(undefined),
  handleRedirectPromise: vi.fn().mockResolvedValue(null),
  setActiveAccount: vi.fn(),
  getActiveAccount: vi.fn().mockReturnValue({
    homeAccountId: 'test-account-id',
    environment: 'login.microsoftonline.com',
    tenantId: 'test-tenant-id',
    username: 'test@paythru.com',
    localAccountId: 'test-local-account-id',
    name: 'Test User',
  }),
};

// Mock MSAL module - must define mock instance inside factory to avoid hoisting issues
vi.mock('@azure/msal-browser', () => {
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


