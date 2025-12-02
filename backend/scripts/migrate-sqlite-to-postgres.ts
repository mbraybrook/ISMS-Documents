/**
 * Migrate data from SQLite to PostgreSQL using Prisma
 * This script reads from SQLite and writes to PostgreSQL, preserving relationships
 */
import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';

const sqliteDb = new Database(path.join(__dirname, '../prisma/dev.db'), { readonly: true });
const prisma = new PrismaClient();

// Models to migrate in dependency order
// Note: User is migrated first since Documents require ownerUserId
const models = [
  'User', // Migrate users first for foreign key constraints
  'AssetCategory',
  'Classification',
  'InterestedParty',
  'Legislation',
  'Control',
  'Asset',
  'Risk',
  'Document',
  'RiskControl',
  'DocumentRisk',
  'DocumentControl',
  'LegislationRisk',
] as const;

interface MigrationStats {
  model: string;
  count: number;
  errors: number;
}

async function migrateTable(tableName: string): Promise<MigrationStats> {
  const stats: MigrationStats = { model: tableName, count: 0, errors: 0 };

  try {
    const rows = sqliteDb.prepare(`SELECT * FROM "${tableName}"`).all() as any[];

    for (const row of rows) {
      try {
        // Convert SQLite row to Prisma format
        const data: any = { ...row };

        // Handle type conversions - SQLite stores some types differently
        for (const [key, value] of Object.entries(data)) {
          if (value === null || value === undefined) {
            continue;
          }
          
          // Convert boolean fields (SQLite stores as 0/1)
          const booleanFields = [
            'requiresAcknowledgement',
            'cdeImpacting',
            'archived',
            'mitigationImplemented',
            'selectedForRiskAssessment',
            'selectedForContractualObligation',
            'selectedForLegalRequirement',
            'selectedForBusinessRequirement',
            'isStandardControl',
            'implemented',
            'addressedThroughISMS',
          ];
          if (booleanFields.includes(key)) {
            data[key] = value === 1 || value === true || value === '1' || value === 'true';
            continue;
          }
          
          // Check if this is a date field (ends with Date, At, or is createdAt/updatedAt)
          const isDateField = /(Date|At)$/i.test(key) || key === 'dateAdded' || key === 'expiryDate' || key === 'date';
          
          if (isDateField) {
            if (typeof value === 'number') {
              // SQLite stores dates as milliseconds
              data[key] = new Date(value);
            } else if (typeof value === 'string') {
              // Try to parse as ISO string or milliseconds
              if (/^\d{13,}$/.test(value)) {
                data[key] = new Date(parseInt(value));
              } else if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
                data[key] = new Date(value);
              } else {
                // Try to parse as date
                const parsed = new Date(value);
                if (!isNaN(parsed.getTime())) {
                  data[key] = parsed;
                }
              }
            }
          }
        }

        // Use upsert to handle conflicts
        switch (tableName) {
          case 'User':
            await prisma.user.upsert({
              where: { id: data.id },
              update: data,
              create: data,
            });
            break;
          case 'AssetCategory':
            await prisma.assetCategory.upsert({
              where: { id: data.id },
              update: data,
              create: data,
            });
            break;
          case 'Classification':
            await prisma.classification.upsert({
              where: { id: data.id },
              update: data,
              create: data,
            });
            break;
          case 'InterestedParty':
            await prisma.interestedParty.upsert({
              where: { id: data.id },
              update: data,
              create: data,
            });
            break;
          case 'Legislation':
            await prisma.legislation.upsert({
              where: { id: data.id },
              update: data,
              create: data,
            });
            break;
          case 'Control':
            await prisma.control.upsert({
              where: { id: data.id },
              update: data,
              create: data,
            });
            break;
          case 'Asset':
            await prisma.asset.upsert({
              where: { id: data.id },
              update: data,
              create: data,
            });
            break;
          case 'Risk':
            await prisma.risk.upsert({
              where: { id: data.id },
              update: data,
              create: data,
            });
            break;
          case 'Document':
            await prisma.document.upsert({
              where: { id: data.id },
              update: data,
              create: data,
            });
            break;
          case 'RiskControl':
            await prisma.riskControl.upsert({
              where: {
                riskId_controlId: {
                  riskId: data.riskId,
                  controlId: data.controlId,
                },
              },
              update: {},
              create: {
                riskId: data.riskId,
                controlId: data.controlId,
              },
            });
            break;
          case 'DocumentRisk':
            await prisma.documentRisk.upsert({
              where: {
                documentId_riskId: {
                  documentId: data.documentId,
                  riskId: data.riskId,
                },
              },
              update: {},
              create: {
                documentId: data.documentId,
                riskId: data.riskId,
              },
            });
            break;
          case 'DocumentControl':
            await prisma.documentControl.upsert({
              where: {
                documentId_controlId: {
                  documentId: data.documentId,
                  controlId: data.controlId,
                },
              },
              update: {},
              create: {
                documentId: data.documentId,
                controlId: data.controlId,
              },
            });
            break;
          case 'LegislationRisk':
            await prisma.legislationRisk.upsert({
              where: {
                legislationId_riskId: {
                  legislationId: data.legislationId,
                  riskId: data.riskId,
                },
              },
              update: {},
              create: {
                legislationId: data.legislationId,
                riskId: data.riskId,
              },
            });
            break;
        }
        stats.count++;
      } catch (error: any) {
        console.error(`Error migrating row in ${tableName}:`, error.message);
        stats.errors++;
      }
    }
  } catch (error: any) {
    console.error(`Error reading ${tableName}:`, error.message);
    stats.errors++;
  }

  return stats;
}

async function main() {
  console.log('Starting SQLite to PostgreSQL migration...');
  console.log('');

  const allStats: MigrationStats[] = [];

  for (const model of models) {
    console.log(`Migrating ${model}...`);
    const stats = await migrateTable(model);
    allStats.push(stats);
    console.log(`  ✓ ${stats.count} rows migrated, ${stats.errors} errors`);
  }

  console.log('');
  console.log('Migration Summary:');
  console.log('------------------');
  let totalRows = 0;
  let totalErrors = 0;
  for (const stat of allStats) {
    console.log(`${stat.model}: ${stat.count} rows, ${stat.errors} errors`);
    totalRows += stat.count;
    totalErrors += stat.errors;
  }
  console.log(`Total: ${totalRows} rows migrated, ${totalErrors} errors`);

  sqliteDb.close();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

