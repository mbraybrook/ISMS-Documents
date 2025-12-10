#!/usr/bin/env tsx

import { backfillControlEmbeddings } from '../src/services/embeddingService';

const args = process.argv.slice(2);

// Parse CLI arguments
let batchSize = 10;
let concurrency = 2;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--batch-size' && i + 1 < args.length) {
    batchSize = parseInt(args[i + 1], 10);
    if (isNaN(batchSize) || batchSize < 1) {
      console.error('Error: --batch-size must be a positive integer');
      process.exit(1);
    }
    i++;
  } else if (arg === '--concurrency' && i + 1 < args.length) {
    concurrency = parseInt(args[i + 1], 10);
    if (isNaN(concurrency) || concurrency < 1) {
      console.error('Error: --concurrency must be a positive integer');
      process.exit(1);
    }
    i++;
  } else if (arg === '--dry-run') {
    dryRun = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: npm run backfill-control-embeddings [options]

Options:
  --batch-size <number>    Number of controls to process per batch (default: 10)
  --concurrency <number>   Maximum concurrent embedding computations (default: 2)
  --dry-run                Show how many rows would be affected without writing
  --help, -h               Show this help message

Examples:
  npm run backfill-control-embeddings
  npm run backfill-control-embeddings -- --batch-size 20 --concurrency 4
  npm run backfill-control-embeddings -- --dry-run
`);
    process.exit(0);
  }
}

async function main() {
  console.log('Starting control embedding backfill...');
  console.log(`Configuration: batchSize=${batchSize}, concurrency=${concurrency}, dryRun=${dryRun}\n`);

  try {
    const stats = await backfillControlEmbeddings(batchSize, concurrency, dryRun);

    console.log('\n=== Backfill Complete ===');
    console.log(`Processed: ${stats.processed}`);
    console.log(`Succeeded: ${stats.succeeded}`);
    console.log(`Failed: ${stats.failed}`);

    if (dryRun) {
      console.log('\n(Dry run mode - no embeddings were actually computed)');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('\nError during backfill:', error.message);
    process.exit(1);
  }
}

main();




