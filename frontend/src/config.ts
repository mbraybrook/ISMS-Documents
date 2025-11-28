export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  auth: {
    tenantId: import.meta.env.VITE_AUTH_TENANT_ID || '',
    clientId: import.meta.env.VITE_AUTH_CLIENT_ID || '',
    redirectUri: import.meta.env.VITE_AUTH_REDIRECT_URI || 'http://localhost:3000',
  },
};

