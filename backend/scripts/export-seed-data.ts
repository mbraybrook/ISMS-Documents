import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * Export seed data from PostgreSQL database to JSON files
 * Filters out environment-specific entities (users, auth tokens, logs, etc.)
 */
async function main() {
  const seedDataDir = path.join(__dirname, '../prisma/seed-data');

  // Ensure seed-data directory exists
  if (!fs.existsSync(seedDataDir)) {
    fs.mkdirSync(seedDataDir, { recursive: true });
    console.log(`Created seed-data directory: ${seedDataDir}`);
  }

  console.log('Exporting seed data from PostgreSQL database...');
  console.log(`Output directory: ${seedDataDir}`);
  console.log('');

  try {
    // Export AssetCategory (reference data)
    const assetCategories = await prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
    });
    fs.writeFileSync(
      path.join(seedDataDir, 'asset-categories.json'),
      JSON.stringify(assetCategories, null, 2)
    );
    console.log(`✓ Exported ${assetCategories.length} asset categories`);

    // Export Classification (reference data)
    const classifications = await prisma.classification.findMany({
      orderBy: { name: 'asc' },
    });
    fs.writeFileSync(
      path.join(seedDataDir, 'classifications.json'),
      JSON.stringify(classifications, null, 2)
    );
    console.log(`✓ Exported ${classifications.length} classifications`);

    // Export Assets (full data)
    const assets = await prisma.asset.findMany({
      orderBy: { createdAt: 'asc' },
    });
    fs.writeFileSync(
      path.join(seedDataDir, 'assets.json'),
      JSON.stringify(assets, null, 2)
    );
    console.log(`✓ Exported ${assets.length} assets`);

    // Export Controls (reference data)
    const controls = await prisma.control.findMany({
      orderBy: { code: 'asc' },
    });
    fs.writeFileSync(
      path.join(seedDataDir, 'controls.json'),
      JSON.stringify(controls, null, 2)
    );
    console.log(`✓ Exported ${controls.length} controls`);

    // Export Risks (full data)
    const risks = await prisma.risk.findMany({
      orderBy: { createdAt: 'asc' },
    });
    fs.writeFileSync(
      path.join(seedDataDir, 'risks.json'),
      JSON.stringify(risks, null, 2)
    );
    console.log(`✓ Exported ${risks.length} risks`);

    // Export Documents (full data)
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: 'asc' },
    });
    fs.writeFileSync(
      path.join(seedDataDir, 'documents.json'),
      JSON.stringify(documents, null, 2)
    );
    console.log(`✓ Exported ${documents.length} documents`);

    // Export InterestedParty (reference data)
    const interestedParties = await prisma.interestedParty.findMany({
      orderBy: { name: 'asc' },
    });
    fs.writeFileSync(
      path.join(seedDataDir, 'interested-parties.json'),
      JSON.stringify(interestedParties, null, 2)
    );
    console.log(`✓ Exported ${interestedParties.length} interested parties`);

    // Export Legislation (reference data)
    const legislation = await prisma.legislation.findMany({
      orderBy: { actRegulationRequirement: 'asc' },
    });
    fs.writeFileSync(
      path.join(seedDataDir, 'legislation.json'),
      JSON.stringify(legislation, null, 2)
    );
    console.log(`✓ Exported ${legislation.length} legislation records`);

    // Export junction tables (full data)
    const riskControls = await prisma.riskControl.findMany({
      orderBy: { riskId: 'asc' },
    });
    fs.writeFileSync(
      path.join(seedDataDir, 'risk-controls.json'),
      JSON.stringify(riskControls, null, 2)
    );
    console.log(`✓ Exported ${riskControls.length} risk-control links`);

    const documentRisks = await prisma.documentRisk.findMany({
      orderBy: { documentId: 'asc' },
    });
    fs.writeFileSync(
      path.join(seedDataDir, 'document-risks.json'),
      JSON.stringify(documentRisks, null, 2)
    );
    console.log(`✓ Exported ${documentRisks.length} document-risk links`);

    const documentControls = await prisma.documentControl.findMany({
      orderBy: { documentId: 'asc' },
    });
    fs.writeFileSync(
      path.join(seedDataDir, 'document-controls.json'),
      JSON.stringify(documentControls, null, 2)
    );
    console.log(`✓ Exported ${documentControls.length} document-control links`);

    const legislationRisks = await prisma.legislationRisk.findMany({
      orderBy: { legislationId: 'asc' },
    });
    fs.writeFileSync(
      path.join(seedDataDir, 'legislation-risks.json'),
      JSON.stringify(legislationRisks, null, 2)
    );
    console.log(`✓ Exported ${legislationRisks.length} legislation-risk links`);

    console.log('');
    console.log('✓ Seed data export completed successfully!');
    console.log(`All files written to: ${seedDataDir}`);
    console.log('');
    console.log('Note: Environment-specific entities were excluded:');
    console.log('  - User accounts');
    console.log('  - Acknowledgment records');
    console.log('  - ReviewTask records');
    console.log('  - SoAExport records');
    console.log('  - TrustDocSetting records');
    console.log('  - TrustDownload records');
    console.log('  - TrustAuditLog records');
    console.log('  - ExternalUser accounts');
  } catch (error) {
    console.error('✗ Export failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute
main().catch((error) => {
  console.error(error);
  process.exit(1);
});

