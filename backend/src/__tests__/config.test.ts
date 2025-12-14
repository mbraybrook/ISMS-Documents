// Mock dotenv to prevent it from loading .env files during tests
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Suppress console.log during tests
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Set a valid DATABASE_URL by default
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/testdb?schema=public';
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('DATABASE_URL validation', () => {
    it('should throw error when DATABASE_URL is missing', async () => {
      // Arrange
      const originalDatabaseUrl = process.env.DATABASE_URL;

      // Act & Assert
      await expect(async () => {
        // Remove DATABASE_URL for this test
        const savedDatabaseUrl = process.env.DATABASE_URL;
        delete process.env.DATABASE_URL;
        try {
          await import('../config');
        } finally {
          // Restore even if it throws
          if (savedDatabaseUrl) {
            process.env.DATABASE_URL = savedDatabaseUrl;
          }
        }
      }).rejects.toThrow('DATABASE_URL environment variable is required');

      // Restore
      if (originalDatabaseUrl) {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    });

    it('should throw error when DATABASE_URL is a SQLite file URL', async () => {
      // Arrange
      process.env.DATABASE_URL = 'file:./test.db';

      // Act & Assert
      await expect(async () => {
        await import('../config');
      }).rejects.toThrow('SQLite file: URLs are not supported');
    });

    it('should throw error when DATABASE_URL does not match PostgreSQL format', async () => {
      // Arrange
      process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/testdb';

      // Act & Assert
      await expect(async () => {
        await import('../config');
      }).rejects.toThrow('DATABASE_URL must be a PostgreSQL connection string');
    });

    it('should accept valid PostgreSQL connection string with postgresql://', async () => {
      // Arrange
      process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/testdb?schema=public';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.databaseUrl).toBe('postgresql://user:password@localhost:5432/testdb?schema=public');
    });

    it('should accept valid PostgreSQL connection string with postgres://', async () => {
      // Arrange
      process.env.DATABASE_URL = 'postgres://user:password@localhost:5432/testdb?schema=public';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.databaseUrl).toBe('postgres://user:password@localhost:5432/testdb?schema=public');
    });
  });

  describe('SEED_SCOPE validation', () => {
    it('should use default seed scope "full" in development environment', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      delete process.env.SEED_SCOPE;

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.seedScope).toBe('full');
    });

    it('should use default seed scope "reference" in staging environment', async () => {
      // Arrange
      const originalNodeEnv = process.env.NODE_ENV;
      const originalSeedScope = process.env.SEED_SCOPE;
      const originalDatabaseUrl = process.env.DATABASE_URL;

      // Act
      // Set env vars before requiring the module - must set all required vars
      process.env.NODE_ENV = 'staging';
      process.env.DATABASE_URL = originalDatabaseUrl || 'postgresql://user:password@localhost:5432/testdb';
      delete process.env.SEED_SCOPE;
      const module = await import('../config');
      const config = module.config;

      // Assert
      expect(config.seedScope).toBe('reference');

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
      if (originalSeedScope) {
        process.env.SEED_SCOPE = originalSeedScope;
      }
    });

    it('should use default seed scope "none" in production environment', async () => {
      // Arrange
      const originalNodeEnv = process.env.NODE_ENV;
      const originalSeedScope = process.env.SEED_SCOPE;
      const originalDatabaseUrl = process.env.DATABASE_URL;

      // Act
      // Set env vars before requiring the module - must set all required vars
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = originalDatabaseUrl || 'postgresql://user:password@localhost:5432/testdb';
      delete process.env.SEED_SCOPE;
      const module = await import('../config');
      const config = module.config;

      // Assert
      expect(config.seedScope).toBe('none');

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
      if (originalSeedScope) {
        process.env.SEED_SCOPE = originalSeedScope;
      }
    });

    it('should use SEED_SCOPE from environment variable when provided', async () => {
      // Arrange
      process.env.SEED_SCOPE = 'reference';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.seedScope).toBe('reference');
    });

    it('should throw error when SEED_SCOPE is invalid', async () => {
      // Arrange
      process.env.SEED_SCOPE = 'invalid';

      // Act & Assert
      await expect(async () => {
        await import('../config');
      }).rejects.toThrow('Invalid SEED_SCOPE: invalid. Must be one of: "reference", "full", "none"');
    });

    it('should accept "reference" as valid SEED_SCOPE', async () => {
      // Arrange
      process.env.SEED_SCOPE = 'reference';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.seedScope).toBe('reference');
    });

    it('should accept "full" as valid SEED_SCOPE', async () => {
      // Arrange
      process.env.SEED_SCOPE = 'full';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.seedScope).toBe('full');
    });

    it('should accept "none" as valid SEED_SCOPE', async () => {
      // Arrange
      process.env.SEED_SCOPE = 'none';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.seedScope).toBe('none');
    });
  });

  describe('Config object creation', () => {
    it('should set default port to 4000 when PORT is not provided', async () => {
      // Arrange
      delete process.env.PORT;

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.port).toBe(4000);
    });

    it('should use PORT from environment variable', async () => {
      // Arrange
      process.env.PORT = '5000';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.port).toBe(5000);
    });

    it('should set default nodeEnv to development when NODE_ENV is not provided', async () => {
      // Arrange
      delete process.env.NODE_ENV;

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.nodeEnv).toBe('development');
    });

    it('should use NODE_ENV from environment variable', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.nodeEnv).toBe('production');
    });

    it('should configure auth settings with defaults', async () => {
      // Arrange
      delete process.env.AUTH_ALLOWED_EMAIL_DOMAIN;

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.auth.allowedEmailDomain).toBe('paythru.com');
      expect(config.auth.tenantId).toBe('');
      expect(config.auth.clientId).toBe('');
      expect(config.auth.clientSecret).toBe('');
      expect(config.auth.redirectUri).toBe('');
    });

    it('should use AUTH_ALLOWED_EMAIL_DOMAIN from environment variable', async () => {
      // Arrange
      process.env.AUTH_ALLOWED_EMAIL_DOMAIN = 'example.com';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.auth.allowedEmailDomain).toBe('example.com');
    });

    it('should configure SharePoint settings', async () => {
      // Arrange
      process.env.SHAREPOINT_SITE_ID = 'site-123';
      process.env.SHAREPOINT_DRIVE_ID = 'drive-456';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.sharePoint.siteId).toBe('site-123');
      expect(config.sharePoint.driveId).toBe('drive-456');
    });

    it('should configure Confluence settings', async () => {
      // Arrange
      process.env.CONFLUENCE_BASE_URL = 'https://confluence.example.com';
      process.env.CONFLUENCE_USERNAME = 'user';
      process.env.CONFLUENCE_API_TOKEN = 'token-123';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.confluence.baseUrl).toBe('https://confluence.example.com');
      expect(config.confluence.username).toBe('user');
      expect(config.confluence.apiToken).toBe('token-123');
    });

    it('should configure LLM settings with defaults', async () => {
      // Arrange
      delete process.env.LLM_PROVIDER;
      delete process.env.LLM_BASE_URL;
      delete process.env.LLM_EMBEDDING_MODEL;
      delete process.env.LLM_CHAT_MODEL;
      delete process.env.LLM_SIMILARITY_THRESHOLD;
      delete process.env.LLM_MAX_EMBEDDING_TEXT_LENGTH;

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.llm.provider).toBe('ollama');
      expect(config.llm.baseUrl).toBe('http://localhost:11434');
      expect(config.llm.embeddingModel).toBe('nomic-embed-text');
      expect(config.llm.chatModel).toBe('llama2');
      expect(config.llm.similarityThreshold).toBe(70);
      expect(config.llm.maxEmbeddingTextLength).toBe(1024);
    });

    it('should use LLM settings from environment variables', async () => {
      // Arrange
      process.env.LLM_PROVIDER = 'openai';
      process.env.LLM_BASE_URL = 'https://api.openai.com';
      process.env.LLM_EMBEDDING_MODEL = 'text-embedding-ada-002';
      process.env.LLM_CHAT_MODEL = 'gpt-4';
      process.env.LLM_SIMILARITY_THRESHOLD = '85';
      process.env.LLM_MAX_EMBEDDING_TEXT_LENGTH = '2048';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.llm.provider).toBe('openai');
      expect(config.llm.baseUrl).toBe('https://api.openai.com');
      expect(config.llm.embeddingModel).toBe('text-embedding-ada-002');
      expect(config.llm.chatModel).toBe('gpt-4');
      expect(config.llm.similarityThreshold).toBe(85);
      expect(config.llm.maxEmbeddingTextLength).toBe(2048);
    });

    it('should configure Trust Center settings with defaults', async () => {
      // Arrange
      delete process.env.TRUST_CENTER_JWT_SECRET;
      delete process.env.TRUST_CENTER_JWT_EXPIRY;
      delete process.env.TRUST_CENTER_MAX_FILE_SIZE_MB;
      delete process.env.TRUST_CENTER_DOWNLOAD_TOKEN_EXPIRY;

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.trustCenter.jwtSecret).toBe('');
      expect(config.trustCenter.jwtExpiry).toBe('24h');
      expect(config.trustCenter.maxFileSizeMB).toBe(50);
      expect(config.trustCenter.downloadTokenExpiry).toBe('1h');
    });

    it('should use Trust Center settings from environment variables', async () => {
      // Arrange
      process.env.TRUST_CENTER_JWT_SECRET = 'secret-key';
      process.env.TRUST_CENTER_JWT_EXPIRY = '48h';
      process.env.TRUST_CENTER_MAX_FILE_SIZE_MB = '100';
      process.env.TRUST_CENTER_DOWNLOAD_TOKEN_EXPIRY = '2h';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.trustCenter.jwtSecret).toBe('secret-key');
      expect(config.trustCenter.jwtExpiry).toBe('48h');
      expect(config.trustCenter.maxFileSizeMB).toBe(100);
      expect(config.trustCenter.downloadTokenExpiry).toBe('2h');
    });

    it('should configure Azure settings with fallback to AUTH variables', async () => {
      // Arrange
      process.env.AUTH_CLIENT_ID = 'auth-client-id';
      process.env.AUTH_CLIENT_SECRET = 'auth-secret';
      process.env.AUTH_TENANT_ID = 'auth-tenant-id';
      delete process.env.AZURE_APP_CLIENT_ID;
      delete process.env.AZURE_APP_CLIENT_SECRET;
      delete process.env.AZURE_TENANT_ID;

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.azure.appClientId).toBe('auth-client-id');
      expect(config.azure.appClientSecret).toBe('auth-secret');
      expect(config.azure.tenantId).toBe('auth-tenant-id');
    });

    it('should use Azure-specific environment variables when provided', async () => {
      // Arrange
      process.env.AZURE_APP_CLIENT_ID = 'azure-client-id';
      process.env.AZURE_APP_CLIENT_SECRET = 'azure-secret';
      process.env.AZURE_TENANT_ID = 'azure-tenant-id';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.azure.appClientId).toBe('azure-client-id');
      expect(config.azure.appClientSecret).toBe('azure-secret');
      expect(config.azure.tenantId).toBe('azure-tenant-id');
    });

    it('should configure CORS settings with empty array when not provided', async () => {
      // Arrange
      delete process.env.CORS_TRUST_CENTER_ORIGINS;

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.cors.trustCenterOrigins).toEqual([]);
    });

    it('should parse CORS_TRUST_CENTER_ORIGINS from comma-separated string', async () => {
      // Arrange
      process.env.CORS_TRUST_CENTER_ORIGINS = 'https://trust.paythru.com, https://trust.staging.paythru.com ';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.cors.trustCenterOrigins).toEqual([
        'https://trust.paythru.com',
        'https://trust.staging.paythru.com',
      ]);
    });

    it('should trim whitespace from CORS origins', async () => {
      // Arrange
      process.env.CORS_TRUST_CENTER_ORIGINS = '  https://trust.paythru.com  ,  https://trust.staging.paythru.com  ';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.cors.trustCenterOrigins).toEqual([
        'https://trust.paythru.com',
        'https://trust.staging.paythru.com',
      ]);
    });

    it('should configure email settings with defaults', async () => {
      // Arrange
      delete process.env.EMAIL_SMTP_PORT;

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.email.smtpHost).toBe('');
      expect(config.email.smtpPort).toBe(587);
      expect(config.email.smtpUser).toBe('');
      expect(config.email.smtpPass).toBe('');
      expect(config.email.from).toBe('');
    });

    it('should use email settings from environment variables', async () => {
      // Arrange
      process.env.EMAIL_SMTP_HOST = 'smtp.example.com';
      process.env.EMAIL_SMTP_PORT = '465';
      process.env.EMAIL_SMTP_USER = 'user@example.com';
      process.env.EMAIL_SMTP_PASS = 'password';
      process.env.EMAIL_FROM = 'noreply@example.com';

      // Act
      const { config } = await import('../config');

      // Assert
      expect(config.email.smtpHost).toBe('smtp.example.com');
      expect(config.email.smtpPort).toBe(465);
      expect(config.email.smtpUser).toBe('user@example.com');
      expect(config.email.smtpPass).toBe('password');
      expect(config.email.from).toBe('noreply@example.com');
    });
  });

  describe('Development logging', () => {
    it('should log config in development environment', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      process.env.AUTH_TENANT_ID = 'tenant-12345678';
      process.env.AUTH_CLIENT_ID = 'client-12345678';
      process.env.AUTH_CLIENT_SECRET = 'secret';
      process.env.AUTH_REDIRECT_URI = 'http://localhost:3000';
      process.env.AUTH_ALLOWED_EMAIL_DOMAIN = 'paythru.com';
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

      // Act
      require('../config');

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[CONFIG] Auth config loaded:',
        expect.objectContaining({
          tenantId: 'tenant-1...',
          clientId: 'client-1...',
          hasClientSecret: true,
          redirectUri: 'http://localhost:3000',
          allowedEmailDomain: 'paythru.com',
        })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[CONFIG] Database:',
        expect.objectContaining({
          url: expect.stringContaining('postgresql://'),
          seedScope: expect.any(String),
        })
      );

      consoleLogSpy.mockRestore();
    });

    it('should not log config in production environment', () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

      // Act
      require('../config');

      // Assert
      expect(consoleLogSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should not log config in staging environment', () => {
      // Arrange
      process.env.NODE_ENV = 'staging';
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

      // Act
      require('../config');

      // Assert
      expect(consoleLogSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should mask password in database URL when logging', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://user:secretpassword@localhost:5432/testdb';
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

      // Act
      require('../config');

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[CONFIG] Database:',
        expect.objectContaining({
          url: expect.stringMatching(/postgresql:\/\/user:\*\*\*\*@localhost:5432\/testdb/),
        })
      );

      consoleLogSpy.mockRestore();
    });

    it('should show MISSING for tenantId when not provided', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      delete process.env.AUTH_TENANT_ID;
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

      // Act
      require('../config');

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[CONFIG] Auth config loaded:',
        expect.objectContaining({
          tenantId: 'MISSING',
        })
      );

      consoleLogSpy.mockRestore();
    });

    it('should show MISSING for clientId when not provided', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      delete process.env.AUTH_CLIENT_ID;
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

      // Act
      require('../config');

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[CONFIG] Auth config loaded:',
        expect.objectContaining({
          clientId: 'MISSING',
        })
      );

      consoleLogSpy.mockRestore();
    });
  });
});

