import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Models to validate (in dependency order for reference)
const models = [
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

interface RowCount {
  model: string;
  sqliteCount: number;
  postgresCount: number;
  match: boolean;
}

/**
 * Get row count from SQLite database
 */
function getSQLiteCount(db: Database.Database, tableName: string): number {
  try {
    const result = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number };
    return result.count;
  } catch (error) {
    console.error(`Error counting rows in SQLite table ${tableName}:`, error);
    return -1;
  }
}

/**
 * Get row count from PostgreSQL database using Prisma
 */
async function getPostgresCount(modelName: string): Promise<number> {
  try {
    // Map model names to Prisma client methods
    const modelMap: Record<string, () => Promise<any[]>> = {
      AssetCategory: () => prisma.assetCategory.findMany(),
      Classification: () => prisma.classification.findMany(),
      InterestedParty: () => prisma.interestedParty.findMany(),
      Legislation: () => prisma.legislation.findMany(),
      Control: () => prisma.control.findMany(),
      Asset: () => prisma.asset.findMany(),
      Risk: () => prisma.risk.findMany(),
      Document: () => prisma.document.findMany(),
      RiskControl: () => prisma.riskControl.findMany(),
      DocumentRisk: () => prisma.documentRisk.findMany(),
      DocumentControl: () => prisma.documentControl.findMany(),
      LegislationRisk: () => prisma.legislationRisk.findMany(),
    };

    const findMany = modelMap[modelName];
    if (!findMany) {
      console.error(`Unknown model: ${modelName}`);
      return -1;
    }

    const records = await findMany();
    return records.length;
  } catch (error) {
    console.error(`Error counting rows in PostgreSQL model ${modelName}:`, error);
    return -1;
  }
}

/**
 * Main validation function
 */
async function main() {
  const sqliteDbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../prisma/dev.db');
  const postgresUrl = process.env.DATABASE_URL;

  if (!postgresUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!fs.existsSync(sqliteDbPath)) {
    console.error(`SQLite database not found at: ${sqliteDbPath}`);
    console.error('Set SQLITE_DB_PATH environment variable to point to your SQLite database file');
    process.exit(1);
  }

  console.log('Validating migration...');
  console.log(`SQLite source: ${sqliteDbPath}`);
  console.log(`PostgreSQL target: ${postgresUrl.replace(/:([^:@]+)@/, ':****@')}`);
  console.log('');

  // Open SQLite database
  const sqliteDb = new Database(sqliteDbPath, { readonly: true });

  const results: RowCount[] = [];
  let allMatch = true;

  // Validate each model
  for (const model of models) {
    const sqliteCount = getSQLiteCount(sqliteDb, model);
    const postgresCount = await getPostgresCount(model);

    const match = sqliteCount === postgresCount;
    if (!match) {
      allMatch = false;
    }

    results.push({
      model,
      sqliteCount,
      postgresCount,
      match,
    });

    const status = match ? '✓' : '✗';
    console.log(`${model}: SQLite=${sqliteCount}, PostgreSQL=${postgresCount} ${status}`);
  }

  // Close SQLite database
  sqliteDb.close();

  console.log('');

  if (allMatch) {
    console.log('All row counts match! Migration validated successfully.');
    await prisma.$disconnect();
    process.exit(0);
  } else {
    console.error('Row count mismatches detected:');
    results
      .filter((r) => !r.match)
      .forEach((r) => {
        console.error(`  ${r.model}: SQLite=${r.sqliteCount}, PostgreSQL=${r.postgresCount} (difference: ${r.postgresCount - r.sqliteCount})`);
      });
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Execute
main().catch((error) => {
  console.error('Validation failed:', error);
  process.exit(1);
});

