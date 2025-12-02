import { vi } from 'vitest';

// Mock MSAL PublicClientApplication
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

// Mock MSAL module
vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: vi.fn().mockImplementation(() => mockMsalInstance),
  InteractionType: {
    Popup: 'popup',
    Redirect: 'redirect',
  },
  BrowserCacheLocation: {
    LocalStorage: 'localStorage',
    SessionStorage: 'sessionStorage',
  },
}));

export default mockMsalInstance;

