import { PublicClientApplication, AccountInfo, Configuration, PopupRequest } from '@azure/msal-browser';
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
      logLevel: 'Info',
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

console.log('MSAL Config:', {
  clientId: config.auth.clientId,
  tenantId: config.auth.tenantId,
  redirectUri: config.auth.redirectUri,
  authority: msalConfig.auth.authority,
});

export const msalInstance = new PublicClientApplication(msalConfig);

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'EDITOR' | 'STAFF';
}

let currentAccount: AccountInfo | null = null;

export const authService = {
  async initialize(): Promise<void> {
    await msalInstance.initialize();
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      currentAccount = accounts[0];
    }
  },

  async login(): Promise<void> {
    try {
      console.log('Initiating login with config:', {
        clientId: config.auth.clientId,
        tenantId: config.auth.tenantId,
        redirectUri: config.auth.redirectUri,
      });

      const loginRequest: PopupRequest = {
        scopes: ['User.Read'],
        prompt: 'select_account', // Force account selection
      };

      // Try popup first, but handle errors gracefully
      try {
        const loginResponse = await msalInstance.loginPopup(loginRequest);
        console.log('Login successful:', loginResponse);
        currentAccount = loginResponse.account;
      } catch (popupError: any) {
        console.warn('Popup login failed, trying redirect flow:', popupError);
        
        // If popup fails (e.g., blocked), fall back to redirect
        if (popupError.errorCode === 'user_cancelled' || popupError.name === 'BrowserAuthError') {
          await msalInstance.loginRedirect({
            scopes: ['User.Read'],
            prompt: 'select_account',
          });
          // Note: loginRedirect doesn't return, it redirects the page
          return;
        }
        throw popupError;
      }
    } catch (error: any) {
      console.error('Login error:', error);
      // Log more details about the error
      if (error.errorCode) {
        console.error('Error code:', error.errorCode);
        console.error('Error message:', error.errorMessage);
        console.error('Full error:', JSON.stringify(error, null, 2));
      }
      throw error;
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
    } catch (error: any) {
      // If silent token acquisition fails, the token might be expired
      // This is expected and not an error - user needs to log in again
      if (error.errorCode === 'interaction_required' || 
          error.errorCode === 'consent_required' ||
          error.errorCode === 'login_required') {
        console.log('Token acquisition requires user interaction');
        // Clear the cached account since we can't get a token
        currentAccount = null;
      } else {
        console.error('Token acquisition error:', error);
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
    } catch (error: any) {
      // If silent token acquisition fails, try interactive
      if (error.errorCode === 'interaction_required' || 
          error.errorCode === 'consent_required' ||
          error.errorCode === 'login_required' ||
          error.errorCode === 'invalid_grant') {
        try {
          console.log('Attempting interactive token acquisition for scopes:', scopes);
          const response = await msalInstance.acquireTokenPopup({
            scopes: scopes,
            account: currentAccount,
            prompt: 'consent', // Force consent prompt
          });
          return response.accessToken;
        } catch (popupError: any) {
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

