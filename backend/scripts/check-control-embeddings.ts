#!/usr/bin/env tsx

import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    // Get total count of controls
    const totalControls = await prisma.control.count();
    
    // Get count of controls with embeddings
    const controlsWithEmbeddings = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Control"
      WHERE embedding IS NOT NULL
    `;
    
    // Get count of controls without embeddings
    const controlsWithoutEmbeddings = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Control"
      WHERE embedding IS NULL
    `;
    
    const withEmbeddings = Number(controlsWithEmbeddings[0]?.count || 0);
    const withoutEmbeddings = Number(controlsWithoutEmbeddings[0]?.count || 0);
    
    console.log('\n=== Control Embedding Status ===');
    console.log(`Total Controls: ${totalControls}`);
    console.log(`Controls WITH embeddings: ${withEmbeddings}`);
    console.log(`Controls WITHOUT embeddings: ${withoutEmbeddings}`);
    console.log(`\nTo backfill remaining controls, run:`);
    console.log(`  npm run backfill-control-embeddings\n`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('Error checking control embeddings:', error.message);
    process.exit(1);
  }
}

main();



