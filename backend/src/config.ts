import dotenv from 'dotenv';
import path from 'path';

// Determine the project root and backend directory
// Use require.main to find the backend directory more reliably
const findBackendDir = (): string => {
  const fs = require('fs');
  
  // Try to find backend directory by looking for package.json with prisma folder
  let searchDir = process.cwd();
  
  // If we're in a subdirectory, search upwards
  for (let i = 0; i < 5; i++) {
    const packageJsonPath = path.join(searchDir, 'package.json');
    const prismaPath = path.join(searchDir, 'prisma');
    
    if (fs.existsSync(packageJsonPath) && fs.existsSync(prismaPath)) {
      return searchDir;
    }
    
    const parentDir = path.resolve(searchDir, '..');
    if (parentDir === searchDir) break; // Reached filesystem root
    searchDir = parentDir;
  }
  
  // Fallback: assume current directory or look for backend subdirectory
  const backendPath = path.join(process.cwd(), 'backend');
  if (fs.existsSync(path.join(backendPath, 'package.json'))) {
    return backendPath;
  }
  
  return process.cwd();
};

const backendDir = findBackendDir();
const projectRoot = path.resolve(backendDir, '..');

// Load environment variables in order of precedence:
// 1. Backend .env (highest priority - most specific)
// 2. Root .env (lower priority - project-wide defaults)
// 3. Current directory .env (lowest priority - fallback)
// Note: Later calls to dotenv.config() override earlier ones, so we load in reverse order
dotenv.config(); // Current directory first (lowest priority)
dotenv.config({ path: path.join(projectRoot, '.env') }); // Root .env (middle priority)
dotenv.config({ path: path.join(backendDir, '.env') }); // Backend .env (highest priority - loaded last)

// Default database path is always relative to backend directory
const defaultDbPath = path.join(backendDir, 'prisma', 'dev.db');

// If DATABASE_URL is set but uses relative path, resolve it properly
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  databaseUrl = `file:${defaultDbPath}`;
} else if (databaseUrl.startsWith('file:')) {
  const dbPath = databaseUrl.replace('file:', '');
  
  // Normalize the path - always resolve relative to backend directory
  // Check specific patterns first before generic patterns
  if (dbPath === './prisma/dev.db' || dbPath === 'prisma/dev.db') {
    // Explicit prisma/dev.db path - resolve from backend directory
    databaseUrl = `file:${defaultDbPath}`;
  } else if (dbPath === './dev.db' || dbPath === 'dev.db') {
    // Default relative path - use the correct location in prisma folder
    databaseUrl = `file:${defaultDbPath}`;
  } else if (dbPath.startsWith('./') || dbPath.startsWith('../')) {
    // Always resolve relative paths from the backend directory
    // This ensures we don't create nested prisma/prisma paths
    const resolvedPath = path.resolve(backendDir, dbPath);
    // Normalize to remove any double slashes or .. segments
    databaseUrl = `file:${path.normalize(resolvedPath)}`;
  } else if (!path.isAbsolute(dbPath)) {
    // If it's a relative path without ./ or ../, resolve from backend directory
    const resolvedPath = path.resolve(backendDir, dbPath);
    databaseUrl = `file:${path.normalize(resolvedPath)}`;
  }
  // If it's already an absolute path, normalize it
  else {
    databaseUrl = `file:${path.normalize(dbPath)}`;
  }
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: databaseUrl,
  // Auth configuration (to be used in Phase 2)
  auth: {
    tenantId: process.env.AUTH_TENANT_ID || '',
    clientId: process.env.AUTH_CLIENT_ID || '',
    clientSecret: process.env.AUTH_CLIENT_SECRET || '',
    redirectUri: process.env.AUTH_REDIRECT_URI || '',
  },
  // SharePoint configuration (to be used in Phase 9)
  sharePoint: {
    siteId: process.env.SHAREPOINT_SITE_ID || '',
    driveId: process.env.SHAREPOINT_DRIVE_ID || '',
  },
  // Confluence configuration (to be used in Phase 9)
  confluence: {
    baseUrl: process.env.CONFLUENCE_BASE_URL || '',
    username: process.env.CONFLUENCE_USERNAME || '',
    apiToken: process.env.CONFLUENCE_API_TOKEN || '',
  },
  // LLM configuration for similarity analysis
  llm: {
    provider: process.env.LLM_PROVIDER || 'ollama',
    baseUrl: process.env.LLM_BASE_URL || 'http://localhost:11434',
    model: process.env.LLM_MODEL || 'llama2',
    similarityThreshold: parseFloat(process.env.LLM_SIMILARITY_THRESHOLD || '70'),
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
  });
  
  // Log database location
  const dbPath = config.databaseUrl.replace('file:', '');
  const fs = require('fs');
  // dbPath is already an absolute path from our resolution above
  const resolvedPath = path.normalize(dbPath);
  const dbExists = fs.existsSync(resolvedPath);
  const dbSize = dbExists ? fs.statSync(resolvedPath).size : 0;
  console.log('[CONFIG] Database:', {
    url: config.databaseUrl,
    resolvedPath: resolvedPath,
    exists: dbExists,
    size: dbSize,
    sizeKB: Math.round(dbSize / 1024),
    backendDir: backendDir,
  });
}

