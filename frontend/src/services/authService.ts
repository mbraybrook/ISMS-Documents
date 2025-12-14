import { PublicClientApplication, AccountInfo, Configuration, PopupRequest, LogLevel, AuthError } from '@azure/msal-browser';
import { config } from '../config';

const msalConfig: Configuration = {
  auth: {
    clientId: config.auth.clientId,
    authority: `https://login.microsoftonline.com/${config.auth.tenantId}`,
    redirectUri: config.auth.redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    allowNativeBroker: false, // Disable WAM Broker
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        console.log(`[MSAL ${level}]`, message);
      },
      logLevel: LogLevel.Info,
    },
  },
};

// Validate configuration before creating MSAL instance
if (!config.auth.clientId || !config.auth.tenantId) {
  console.error('MSAL Configuration Error:', {
    clientId: config.auth.clientId || 'MISSING',
    tenantId: config.auth.tenantId || 'MISSING',
    redirectUri: config.auth.redirectUri,
  });
  throw new Error('MSAL configuration is incomplete. Please check your environment variables.');
}


export const msalInstance = new PublicClientApplication(msalConfig);

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'EDITOR' | 'CONTRIBUTOR' | 'STAFF';
  department?: string | null;
}

let currentAccount: AccountInfo | null = null;

export const authService = {
  async initialize(): Promise<void> {
    await msalInstance.initialize();
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      currentAccount = accounts[0];
    } else {
      currentAccount = null;
    }
  },

  async login(): Promise<void> {
    try {

      const loginRequest: PopupRequest = {
        scopes: ['User.Read'],
        prompt: 'select_account', // Force account selection
      };

      // Try popup first, but handle errors gracefully
      try {
        const loginResponse = await msalInstance.loginPopup(loginRequest);
        currentAccount = loginResponse.account;
      } catch (popupError: unknown) {
        // If popup fails (e.g., blocked), fall back to redirect
        const error = popupError as { errorCode?: string; name?: string };
        if (error.errorCode === 'user_cancelled' || error.name === 'BrowserAuthError') {
          await msalInstance.loginRedirect({
            scopes: ['User.Read'],
            prompt: 'select_account',
          });
          // Note: loginRedirect doesn't return, it redirects the page
          return;
        }
        throw popupError;
      }
    } catch (error) {
      const authError = error as AuthError;
      console.error('Login error:', authError);
      // Log more details about the error
      if (authError.errorCode) {
        console.error('Error code:', authError.errorCode);
        console.error('Error message:', authError.errorMessage);
        console.error('Full error:', JSON.stringify(authError, null, 2));
      }
      throw authError;
    }
  },

  async logout(): Promise<void> {
    if (currentAccount) {
      await msalInstance.logoutPopup({
        account: currentAccount,
      });
      currentAccount = null;
    }
  },

  async getAccessToken(): Promise<string | null> {
    if (!currentAccount) {
      return null;
    }

    try {
      const response = await msalInstance.acquireTokenSilent({
        scopes: ['User.Read'],
        account: currentAccount,
      });
      return response.accessToken;
    } catch (error: unknown) {
      const authError = error as AuthError;
      // If silent token acquisition fails, the token might be expired
      // This is expected and not an error - user needs to log in again
      if (authError.errorCode === 'interaction_required' ||
          authError.errorCode === 'consent_required' ||
          authError.errorCode === 'login_required') {
        console.log('Token acquisition requires user interaction');
        // Clear the cached account since we can't get a token
        currentAccount = null;
      } else {
        console.error('Token acquisition error:', authError);
      }
      return null;
    }
  },

  async getGraphAccessToken(scopes: string[] = ['Sites.Read.All', 'Files.Read.All']): Promise<string | null> {
    if (!currentAccount) {
      return null;
    }

    try {
      const response = await msalInstance.acquireTokenSilent({
        scopes: scopes,
        account: currentAccount,
      });
      return response.accessToken;
    } catch (error) {
      const authError = error as AuthError;
      // If silent token acquisition fails, try interactive
      if (authError.errorCode === 'interaction_required' ||
        authError.errorCode === 'consent_required' ||
        authError.errorCode === 'login_required' ||
        authError.errorCode === 'invalid_grant') {
    
        try {
          console.log('Attempting interactive token acquisition for scopes:', scopes);
          const response = await msalInstance.acquireTokenPopup({
            scopes: scopes,
            account: currentAccount,
            prompt: 'consent', // Force consent prompt
          });
          return response.accessToken;
        } catch (error) {
          const popupError = error as AuthError;
          console.error('Interactive token acquisition failed:', popupError);
          // If popup is blocked, try redirect
          if (popupError.errorCode === 'user_cancelled' || popupError.name === 'BrowserAuthError') {
            try {
              console.log('Popup blocked, trying redirect flow');
              await msalInstance.acquireTokenRedirect({
                scopes: scopes,
                account: currentAccount,
                prompt: 'consent',
              });
              // Redirect doesn't return, so return null and let the redirect happen
              return null;
            } catch (redirectError) {
              console.error('Redirect flow failed:', redirectError);
              return null;
            }
          }
          return null;
        }
      } else {
        console.error('Token acquisition error:', error);
        return null;
      }
    }
  },

  getCurrentAccount(): AccountInfo | null {
    return currentAccount;
  },

  isAuthenticated(): boolean {
    return currentAccount !== null;
  },
};

