import { PrismaClient } from '@prisma/client';

/**
 * Test database utilities
 * 
 * For unit tests, we typically mock Prisma.
 * For integration tests, you may want to use a real test database.
 * 
 * Usage:
 * - Unit tests: Mock Prisma using jest.mock('../../lib/prisma')
 * - Integration tests: Use a separate test database and clean up after tests
 */

let testPrisma: PrismaClient | null = null;

/**
 * Get a test Prisma client instance
 * Only use this for integration tests that need a real database
 * Make sure to set DATABASE_URL to a test database
 */
export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!testDbUrl) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for integration tests');
    }
    
    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: testDbUrl,
        },
      },
      log: process.env.DEBUG ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return testPrisma;
}

/**
 * Clean up test database connection
 */
export async function closeTestPrisma(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
}

/**
 * Helper to reset test database (use with caution - only in integration tests)
 * This will delete all data from all tables
 */
export async function resetTestDatabase(): Promise<void> {
  const prisma = getTestPrisma();
  
  // Delete in order to respect foreign key constraints
  // Adjust table names based on your schema
  const tables = [
    'Acknowledgment',
    'ReviewTask',
    'DocumentRisk',
    'DocumentControl',
    'RiskControl',
    'LegislationRisk',
    'Document',
    'Risk',
    'Control',
    'Asset',
    'AssetCategory',
    'InterestedParty',
    'Legislation',
    'User',
  ];
  
  for (const table of tables) {
    try {
      await (prisma as any)[table.toLowerCase()].deleteMany({});
    } catch (error) {
      // Table might not exist or might have different name
      console.warn(`Could not delete from ${table}:`, error);
    }
  }
}

/**
 * Helper to seed test database with minimal data
 */
export async function seedTestDatabase(): Promise<void> {
  const prisma = getTestPrisma();
  
  // Create test users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@paythru.com' },
    update: {},
    create: {
      email: 'admin@paythru.com',
      displayName: 'Test Admin',
      entraObjectId: 'test-admin-oid',
      role: 'ADMIN',
    },
  });
  
  const editorUser = await prisma.user.upsert({
    where: { email: 'editor@paythru.com' },
    update: {},
    create: {
      email: 'editor@paythru.com',
      displayName: 'Test Editor',
      entraObjectId: 'test-editor-oid',
      role: 'EDITOR',
    },
  });
  
  const staffUser = await prisma.user.upsert({
    where: { email: 'staff@paythru.com' },
    update: {},
    create: {
      email: 'staff@paythru.com',
      displayName: 'Test Staff',
      entraObjectId: 'test-staff-oid',
      role: 'STAFF',
    },
  });
  
  return { adminUser, editorUser, staffUser };
}

