import { vi } from 'vitest';

// Mock authService globally for all tests
vi.mock('../../services/authService', async () => {
  const actual = await vi.importActual('../../services/authService');
  return {
    ...actual,
    authService: {
      initialize: vi.fn().mockResolvedValue(undefined),
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
      getGraphAccessToken: vi.fn().mockResolvedValue('mock-graph-token'),
      isAuthenticated: vi.fn().mockReturnValue(false),
    },
    msalInstance: {
      initialize: vi.fn().mockResolvedValue(undefined),
      handleRedirectPromise: vi.fn().mockResolvedValue(null),
      getAllAccounts: vi.fn().mockReturnValue([]),
      getActiveAccount: vi.fn().mockReturnValue(null),
      loginPopup: vi.fn(),
      loginRedirect: vi.fn(),
      logoutPopup: vi.fn(),
      logoutRedirect: vi.fn(),
      acquireTokenSilent: vi.fn(),
      acquireTokenPopup: vi.fn(),
      setActiveAccount: vi.fn(),
    },
  };
});


