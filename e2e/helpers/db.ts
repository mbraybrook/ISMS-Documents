import { PrismaClient } from '@prisma/client';

/**
 * Database helpers for E2E tests
 * These utilities help seed and clean up test data
 */

let prisma: PrismaClient | null = null;

/**
 * Get Prisma client for E2E tests
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for E2E tests');
    }
    
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });
  }
  return prisma;
}

/**
 * Close Prisma connection
 */
export async function closePrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

/**
 * Create test users for E2E tests
 */
export async function seedTestUsers(): Promise<void> {
  const db = getPrisma();
  
  const users = [
    {
      email: 'admin@paythru.com',
      displayName: 'Test Admin',
      entraObjectId: 'test-admin-oid',
      role: 'ADMIN' as const,
    },
    {
      email: 'editor@paythru.com',
      displayName: 'Test Editor',
      entraObjectId: 'test-editor-oid',
      role: 'EDITOR' as const,
    },
    {
      email: 'staff@paythru.com',
      displayName: 'Test Staff',
      entraObjectId: 'test-staff-oid',
      role: 'STAFF' as const,
    },
    {
      email: 'contributor@paythru.com',
      displayName: 'Test Contributor',
      entraObjectId: 'test-contributor-oid',
      role: 'CONTRIBUTOR' as const,
      department: 'OPERATIONS' as const,
    },
  ];

  for (const user of users) {
    await db.user.upsert({
      where: { email: user.email },
      update: user,
      create: user,
    });
  }
}

/**
 * Create test document
 */
export async function createTestDocument(overrides?: any) {
  const db = getPrisma();
  
  // Get or create a test owner
  const owner = await db.user.upsert({
    where: { email: 'admin@paythru.com' },
    update: {},
    create: {
      email: 'admin@paythru.com',
      displayName: 'Test Admin',
      entraObjectId: 'test-admin-oid',
      role: 'ADMIN',
    },
  });

  return await db.document.create({
    data: {
      title: overrides?.title || 'Test Document',
      type: overrides?.type || 'POLICY',
      status: overrides?.status || 'APPROVED',
      version: overrides?.version || '1.0',
      ownerUserId: owner.id,
      ...overrides,
    },
  });
}

/**
 * Create test risk
 */
export async function createTestRisk(overrides?: any) {
  const db = getPrisma();
  
  // Get or create interested party
  const interestedParty = await db.interestedParty.upsert({
    where: { name: 'Test Party' },
    update: {},
    create: {
      name: 'Test Party',
      group: 'Internal',
    },
  });

  return await db.risk.create({
    data: {
      title: overrides?.title || 'Test Risk',
      description: overrides?.description || 'Test risk description',
      confidentialityScore: overrides?.confidentialityScore || 3,
      integrityScore: overrides?.integrityScore || 3,
      availabilityScore: overrides?.availabilityScore || 3,
      likelihood: overrides?.likelihood || 2,
      calculatedScore: overrides?.calculatedScore || 18,
      interestedPartyId: interestedParty.id,
      status: overrides?.status || 'DRAFT',
      ...overrides,
    },
  });
}

/**
 * Clean up test data
 */
export async function cleanupTestData(): Promise<void> {
  const db = getPrisma();
  
  // Delete in order to respect foreign key constraints
  await db.acknowledgment.deleteMany({});
  await db.reviewTask.deleteMany({});
  await db.documentRisk.deleteMany({});
  await db.documentControl.deleteMany({});
  await db.riskControl.deleteMany({});
  await db.document.deleteMany({});
  await db.risk.deleteMany({});
  
  // Keep users for now as they're needed for auth
  // await db.user.deleteMany({});
}

