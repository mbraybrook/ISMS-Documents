import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { config } from '../src/config';

// Load environment variables using the same method as the main app
process.env.DATABASE_URL = config.databaseUrl;

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

const classifications = [
  {
    name: 'Public',
    description: null,
  },
  {
    name: 'Paythru Sensitive',
    description: null,
  },
  {
    name: 'Paythru Confidential',
    description: null,
  },
  {
    name: 'Paythru Proprietary',
    description: null,
  },
];

async function seedClassifications() {
  try {
    console.log('🌱 Starting classification seed...');

    let created = 0;
    let skipped = 0;

    for (const classification of classifications) {
      try {
        const existing = await prisma.classification.findUnique({
          where: { name: classification.name },
        });

        if (existing) {
          console.log(`⏭️  Classification "${classification.name}" already exists, skipping...`);
          skipped++;
          continue;
        }

        await prisma.classification.create({
          data: classification,
        });

        console.log(`✅ Created classification: ${classification.name}`);
        created++;
      } catch (error: any) {
        console.error(`❌ Error creating classification "${classification.name}":`, error.message);
      }
    }

    console.log(`\n✨ Seed complete! Created: ${created}, Skipped: ${skipped}`);
  } catch (error) {
    console.error('❌ Error seeding classifications:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedClassifications();

