import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMigrationState() {
  try {
    console.log('Checking migration state...\n');

    // Check if RiskAsset table exists
    try {
      const riskAssetCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count FROM "RiskAsset"
      `;
      console.log('✓ RiskAsset table EXISTS');
      console.log(`  Records in RiskAsset: ${riskAssetCount[0].count}\n`);
    } catch (error: any) {
      if (error.code === '42P01') {
        console.log('✗ RiskAsset table DOES NOT EXIST\n');
      } else {
        throw error;
      }
    }

    // Check if assetId column exists on Risk table
    try {
      const columnCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'Risk' AND column_name = 'assetId'
        ) as exists
      `;
      
      if (columnCheck[0].exists) {
        console.log('✓ assetId column EXISTS on Risk table');
        
        // Count risks with assetId
        const risksWithAssetId = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint as count FROM "Risk" WHERE "assetId" IS NOT NULL
        `;
        console.log(`  Risks with assetId: ${risksWithAssetId[0].count}\n`);
      } else {
        console.log('✗ assetId column DOES NOT EXIST on Risk table\n');
      }
    } catch (error) {
      console.error('Error checking assetId column:', error);
    }

    // Summary
    console.log('\n--- Migration Status Summary ---');
    try {
      const riskAssetExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'RiskAsset'
        ) as exists
      `;
      
      const assetIdExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Risk' AND column_name = 'assetId'
        ) as exists
      `;

      if (riskAssetExists[0].exists && !assetIdExists[0].exists) {
        console.log('Status: Migration COMPLETE - RiskAsset table exists, assetId column removed');
        console.log('Action: Mark migration as applied: npx prisma migrate resolve --applied 20260123103239_add_risk_asset_many_to_many');
      } else if (riskAssetExists[0].exists && assetIdExists[0].exists) {
        console.log('Status: Migration PARTIALLY APPLIED - Both RiskAsset and assetId exist');
        console.log('Action: Run migration again - it will safely complete the migration');
      } else if (!riskAssetExists[0].exists && assetIdExists[0].exists) {
        console.log('Status: Migration NOT APPLIED - assetId exists, RiskAsset does not');
        console.log('Action: Safe to run migration: npx prisma migrate dev');
      } else {
        console.log('Status: Migration NOT APPLIED - Neither RiskAsset nor assetId exist');
        console.log('Action: Safe to run migration: npx prisma migrate dev');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  } catch (error) {
    console.error('Error checking migration state:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrationState();
