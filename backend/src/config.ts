import dotenv from 'dotenv';

// Load .env file from current directory (standard behavior)
// Environment variables from docker-compose.yml or system will override
dotenv.config();

// DATABASE_URL must be in PostgreSQL format
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required. Format: postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public');
}

// Validate that it's a PostgreSQL connection string (not SQLite file: URL)
if (databaseUrl.startsWith('file:')) {
  throw new Error('SQLite file: URLs are not supported. Use PostgreSQL connection string format: postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public');
}

if (!databaseUrl.match(/^postgres(ql)?:\/\//)) {
  throw new Error('DATABASE_URL must be a PostgreSQL connection string. Format: postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public');
}

// SEED_SCOPE: Controls what data is seeded
// - "reference": seed only canonical/catalogue data (Asset Categories, base Controls, Legislation)
// - "full": reference data + sample/demo Risks, Documents, links
// - "none": do nothing (skip seeding)
// Defaults by environment:
// - Local dev: "full"
// - Staging: "reference"
// - Production: "none"
const getDefaultSeedScope = (): 'reference' | 'full' | 'none' => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    return 'none';
  } else if (nodeEnv === 'staging') {
    return 'reference';
  } else {
    return 'full';
  }
};

const seedScope = (process.env.SEED_SCOPE || getDefaultSeedScope()) as 'reference' | 'full' | 'none';
if (!['reference', 'full', 'none'].includes(seedScope)) {
  throw new Error(`Invalid SEED_SCOPE: ${seedScope}. Must be one of: "reference", "full", "none"`);
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: databaseUrl,
  seedScope: seedScope,
  // Auth configuration
  auth: {
    tenantId: process.env.AUTH_TENANT_ID || '',
    clientId: process.env.AUTH_CLIENT_ID || '',
    clientSecret: process.env.AUTH_CLIENT_SECRET || '',
    redirectUri: process.env.AUTH_REDIRECT_URI || '',
    allowedEmailDomain: process.env.AUTH_ALLOWED_EMAIL_DOMAIN || 'paythru.com',
  },
  // SharePoint configuration
  sharePoint: {
    siteId: process.env.SHAREPOINT_SITE_ID || '',
    driveId: process.env.SHAREPOINT_DRIVE_ID || '',
  },
  // Confluence configuration
  confluence: {
    baseUrl: process.env.CONFLUENCE_BASE_URL || '',
    username: process.env.CONFLUENCE_USERNAME || '',
    apiToken: process.env.CONFLUENCE_API_TOKEN || '',
  },
  // LLM configuration for similarity analysis
  llm: {
    provider: process.env.LLM_PROVIDER || 'ollama',
    baseUrl: process.env.LLM_BASE_URL || 'http://localhost:11434',
    embeddingModel: process.env.LLM_EMBEDDING_MODEL || 'nomic-embed-text',
    chatModel: process.env.LLM_CHAT_MODEL || 'llama2',
    similarityThreshold: parseFloat(process.env.LLM_SIMILARITY_THRESHOLD || '70'),
    maxEmbeddingTextLength: parseInt(process.env.LLM_MAX_EMBEDDING_TEXT_LENGTH || '1024', 10),
  },
  // Trust Center configuration
  trustCenter: {
    jwtSecret: process.env.TRUST_CENTER_JWT_SECRET || '',
    jwtExpiry: process.env.TRUST_CENTER_JWT_EXPIRY || '24h',
    maxFileSizeMB: parseInt(process.env.TRUST_CENTER_MAX_FILE_SIZE_MB || '50', 10),
    downloadTokenExpiry: process.env.TRUST_CENTER_DOWNLOAD_TOKEN_EXPIRY || '1h',
  },
  // Azure app-only authentication for Trust Center
  // Reuses the same Azure App Registration as user authentication
  azure: {
    appClientId: process.env.AZURE_APP_CLIENT_ID || process.env.AUTH_CLIENT_ID || '',
    appClientSecret: process.env.AZURE_APP_CLIENT_SECRET || process.env.AUTH_CLIENT_SECRET || '',
    tenantId: process.env.AZURE_TENANT_ID || process.env.AUTH_TENANT_ID || '',
  },
  // CORS configuration
  cors: {
    trustCenterOrigins: process.env.CORS_TRUST_CENTER_ORIGINS
      ? process.env.CORS_TRUST_CENTER_ORIGINS.split(',').map((s) => s.trim())
      : [],
  },
  // Email service configuration (optional)
  email: {
    smtpHost: process.env.EMAIL_SMTP_HOST || '',
    smtpPort: parseInt(process.env.EMAIL_SMTP_PORT || '587', 10),
    smtpUser: process.env.EMAIL_SMTP_USER || '',
    smtpPass: process.env.EMAIL_SMTP_PASS || '',
    from: process.env.EMAIL_FROM || '',
  },
};

// Log config on startup to verify env vars are loaded (in development only)
if (config.nodeEnv === 'development') {
  console.log('[CONFIG] Auth config loaded:', {
    tenantId: config.auth.tenantId ? `${config.auth.tenantId.substring(0, 8)}...` : 'MISSING',
    clientId: config.auth.clientId ? `${config.auth.clientId.substring(0, 8)}...` : 'MISSING',
    hasClientSecret: !!config.auth.clientSecret,
    redirectUri: config.auth.redirectUri,
    allowedEmailDomain: config.auth.allowedEmailDomain,
  });
  
  // Log database connection (mask password for security)
  const dbUrlForLogging = config.databaseUrl.replace(/:([^:@]+)@/, ':****@');
  console.log('[CONFIG] Database:', {
    url: dbUrlForLogging,
    seedScope: config.seedScope,
  });
}

