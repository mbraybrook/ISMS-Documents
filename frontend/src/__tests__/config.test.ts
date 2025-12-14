import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unmock the config module to test the actual implementation
vi.unmock('../config');

describe('config', () => {
  beforeEach(() => {
    // Reset modules to allow re-importing with different env vars
    vi.resetModules();
  });

  describe('apiUrl', () => {
    it('should use VITE_API_URL when provided', async () => {
      // Arrange
      const testApiUrl = 'https://api.example.com';
      vi.stubEnv('VITE_API_URL', testApiUrl);
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.apiUrl).toBe(testApiUrl);
    });

    it('should use default value when VITE_API_URL is not set', async () => {
      // Arrange
      // Don't set the env var - it should use the default
      vi.unstubAllEnvs();
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.apiUrl).toBe('http://localhost:4000');
    });

    it('should use default value when VITE_API_URL is empty string', async () => {
      // Arrange
      vi.stubEnv('VITE_API_URL', '');
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.apiUrl).toBe('http://localhost:4000');
    });
  });

  describe('auth.tenantId', () => {
    it('should use VITE_AUTH_TENANT_ID when provided', async () => {
      // Arrange
      const testTenantId = 'test-tenant-123';
      vi.stubEnv('VITE_AUTH_TENANT_ID', testTenantId);
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.auth.tenantId).toBe(testTenantId);
    });

    it('should use empty string when VITE_AUTH_TENANT_ID is not set', async () => {
      // Arrange
      // Stub to empty string to simulate not set (triggers fallback)
      vi.stubEnv('VITE_AUTH_TENANT_ID', '');
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.auth.tenantId).toBe('');
    });

    it('should use empty string when VITE_AUTH_TENANT_ID is empty string', async () => {
      // Arrange
      vi.stubEnv('VITE_AUTH_TENANT_ID', '');
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.auth.tenantId).toBe('');
    });
  });

  describe('auth.clientId', () => {
    it('should use VITE_AUTH_CLIENT_ID when provided', async () => {
      // Arrange
      const testClientId = 'test-client-456';
      vi.stubEnv('VITE_AUTH_CLIENT_ID', testClientId);
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.auth.clientId).toBe(testClientId);
    });

    it('should use empty string when VITE_AUTH_CLIENT_ID is not set', async () => {
      // Arrange
      // Stub to empty string to simulate not set (triggers fallback)
      vi.stubEnv('VITE_AUTH_CLIENT_ID', '');
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.auth.clientId).toBe('');
    });

    it('should use empty string when VITE_AUTH_CLIENT_ID is empty string', async () => {
      // Arrange
      vi.stubEnv('VITE_AUTH_CLIENT_ID', '');
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.auth.clientId).toBe('');
    });
  });

  describe('auth.redirectUri', () => {
    it('should use VITE_AUTH_REDIRECT_URI when provided', async () => {
      // Arrange
      const testRedirectUri = 'https://app.example.com/callback';
      vi.stubEnv('VITE_AUTH_REDIRECT_URI', testRedirectUri);
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.auth.redirectUri).toBe(testRedirectUri);
    });

    it('should use default value when VITE_AUTH_REDIRECT_URI is not set', async () => {
      // Arrange
      // Don't set the env var - it should use the default
      vi.unstubAllEnvs();
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.auth.redirectUri).toBe('http://localhost:3000');
    });

    it('should use default value when VITE_AUTH_REDIRECT_URI is empty string', async () => {
      // Arrange
      vi.stubEnv('VITE_AUTH_REDIRECT_URI', '');
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.auth.redirectUri).toBe('http://localhost:3000');
    });
  });

  describe('config structure', () => {
    it('should export config object with correct structure', async () => {
      // Arrange
      vi.stubEnv('VITE_API_URL', 'https://api.test.com');
      vi.stubEnv('VITE_AUTH_TENANT_ID', 'tenant-123');
      vi.stubEnv('VITE_AUTH_CLIENT_ID', 'client-456');
      vi.stubEnv('VITE_AUTH_REDIRECT_URI', 'https://app.test.com');
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config).toBeDefined();
      expect(config).toHaveProperty('apiUrl');
      expect(config).toHaveProperty('auth');
      expect(config.auth).toHaveProperty('tenantId');
      expect(config.auth).toHaveProperty('clientId');
      expect(config.auth).toHaveProperty('redirectUri');
    });

    it('should have all environment variables set correctly', async () => {
      // Arrange
      const testApiUrl = 'https://api.production.com';
      const testTenantId = 'prod-tenant-id';
      const testClientId = 'prod-client-id';
      const testRedirectUri = 'https://app.production.com';

      vi.stubEnv('VITE_API_URL', testApiUrl);
      vi.stubEnv('VITE_AUTH_TENANT_ID', testTenantId);
      vi.stubEnv('VITE_AUTH_CLIENT_ID', testClientId);
      vi.stubEnv('VITE_AUTH_REDIRECT_URI', testRedirectUri);
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.apiUrl).toBe(testApiUrl);
      expect(config.auth.tenantId).toBe(testTenantId);
      expect(config.auth.clientId).toBe(testClientId);
      expect(config.auth.redirectUri).toBe(testRedirectUri);
    });

    it('should use all default values when no environment variables are set', async () => {
      // Arrange
      // Stub all env vars to empty strings to simulate not set (triggers fallbacks)
      vi.stubEnv('VITE_API_URL', '');
      vi.stubEnv('VITE_AUTH_TENANT_ID', '');
      vi.stubEnv('VITE_AUTH_CLIENT_ID', '');
      vi.stubEnv('VITE_AUTH_REDIRECT_URI', '');
      vi.resetModules();

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.apiUrl).toBe('http://localhost:4000');
      expect(config.auth.tenantId).toBe('');
      expect(config.auth.clientId).toBe('');
      expect(config.auth.redirectUri).toBe('http://localhost:3000');
    });
  });
});

