import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import path from 'path';
import fs from 'fs';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Use the resolved database URL from config to ensure correct path resolution
// This ensures the database path is correctly resolved regardless of where the process runs from
// Prisma reads DATABASE_URL from process.env, so we set it to the resolved value
// IMPORTANT: This must be set before creating PrismaClient to ensure it uses the correct path

// Extract the actual file path and normalize it
const dbUrl = config.databaseUrl;
const dbPath = dbUrl.replace(/^file:/, '');
const normalizedPath = path.normalize(dbPath);
const absoluteDbUrl = `file:${normalizedPath}`;

// Verify the database file exists (or can be created)
const dbDir = path.dirname(normalizedPath);
if (!fs.existsSync(dbDir)) {
  console.warn(`[PRISMA] Database directory does not exist: ${dbDir}`);
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`[PRISMA] Created database directory: ${dbDir}`);
  } catch (error) {
    console.error(`[PRISMA] Failed to create database directory: ${error}`);
  }
}

// Set both process.env and use in PrismaClient initialization
process.env.DATABASE_URL = absoluteDbUrl;

// Log the database URL being used (in development)
if (process.env.NODE_ENV === 'development') {
  console.log('[PRISMA] Initializing with database URL:', absoluteDbUrl);
  console.log('[PRISMA] Database file exists:', fs.existsSync(normalizedPath));
  console.log('[PRISMA] Database directory exists:', fs.existsSync(dbDir));
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: absoluteDbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

