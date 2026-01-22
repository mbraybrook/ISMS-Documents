#!/usr/bin/env tsx

import { updateControlApplicability } from '../src/services/riskService';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Starting control applicability update...\n');

  try {
    // Get statistics before update
    const beforeStats = {
      total: await prisma.control.count(),
      selected: await prisma.control.count({
        where: { selectedForRiskAssessment: true },
      }),
      notSelected: await prisma.control.count({
        where: { selectedForRiskAssessment: false },
      }),
    };

    console.log('=== Before Update ===');
    console.log(`Total Controls: ${beforeStats.total}`);
    console.log(`Selected for Risk Assessment: ${beforeStats.selected}`);
    console.log(`Not Selected: ${beforeStats.notSelected}\n`);

    // Update control applicability
    console.log('Updating control applicability based on Risk-Control linkages...');
    await updateControlApplicability();
    console.log('Update complete.\n');

    // Get statistics after update
    const afterStats = {
      total: await prisma.control.count(),
      selected: await prisma.control.count({
        where: { selectedForRiskAssessment: true },
      }),
      notSelected: await prisma.control.count({
        where: { selectedForRiskAssessment: false },
      }),
    };

    console.log('=== After Update ===');
    console.log(`Total Controls: ${afterStats.total}`);
    console.log(`Selected for Risk Assessment: ${afterStats.selected}`);
    console.log(`Not Selected: ${afterStats.notSelected}\n`);

    const changed = Math.abs(afterStats.selected - beforeStats.selected);
    console.log(`=== Summary ===`);
    console.log(`Controls updated: ${changed}`);
    if (afterStats.selected > beforeStats.selected) {
      console.log(`✓ ${changed} controls were marked as selected`);
    } else if (afterStats.selected < beforeStats.selected) {
      console.log(`✓ ${changed} controls were unmarked (no longer linked to active risks)`);
    } else {
      console.log('✓ No changes needed - all controls already have correct status');
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\nError during update:', errorMessage);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
