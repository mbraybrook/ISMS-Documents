import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Use the database URL from config (PostgreSQL connection string)
// Prisma reads DATABASE_URL from process.env, so we set it to the resolved value
// IMPORTANT: This must be set before creating PrismaClient to ensure it uses the correct connection
process.env.DATABASE_URL = config.databaseUrl;

// Log the database connection (mask password for security)
if (process.env.NODE_ENV === 'development') {
  const dbUrlForLogging = config.databaseUrl.replace(/:([^:@]+)@/, ':****@');
  console.log('[PRISMA] Initializing with database URL:', dbUrlForLogging);
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: config.databaseUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

