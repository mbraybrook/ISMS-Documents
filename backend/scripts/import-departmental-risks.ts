import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '../src/lib/prisma';
import { calculateRiskScore } from '../src/services/riskService';
import { Department } from '../src/types/enums';

interface DepartmentalRiskRow {
  'Threat Description': string;
  'Risk Description': string;
  'Impact Score (1-5)': string;
  'Likelihood Score (1-5)': string;
  'Risk Score': string;
  'Impact Categories': string;
  'Existing Controls': string;
  'Potential Additional Controls': string;
}

/**
 * Map filename to department code
 */
function getDepartmentFromFilename(filename: string): Department | null {
  const lowerFilename = filename.toLowerCase();
  
  if (lowerFilename.includes('finance')) {
    return 'FINANCE';
  } else if (lowerFilename.includes('business-strategy') || lowerFilename.includes('business-stategy')) {
    return 'BUSINESS_STRATEGY';
  } else if (lowerFilename.includes('product')) {
    return 'PRODUCT';
  } else if (lowerFilename.includes('marketing')) {
    return 'MARKETING';
  } else if (lowerFilename.includes('operations')) {
    return 'OPERATIONS';
  } else if (lowerFilename.includes('hr')) {
    return 'HR';
  }
  
  return null;
}

/**
 * Parse CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Parse CSV from content string
 */
function parseDepartmentalRiskCSV(content: string): DepartmentalRiskRow[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file does not contain enough lines');
  }
  
  // First line is header
  const headers = parseCSVLine(lines[0]);
  const rows: DepartmentalRiskRow[] = [];
  
  // Process data rows (starting from line 2)
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    // Skip empty rows
    if (values.every(v => !v || v.trim() === '')) {
      continue;
    }
    
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row as DepartmentalRiskRow);
  }
  
  return rows;
}

/**
 * Parse integer from string
 */
function parseIntSafe(value: string | undefined): number | null {
  if (!value || !value.trim()) {
    return null;
  }
  
  const parsed = parseInt(value.trim(), 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Map Impact Categories string to CIA scores
 * For simplicity, use the Impact Score for all three (C, I, A)
 */
function mapImpactCategoriesToCIA(impactCategories: string, impactScore: number): {
  confidentiality: number;
  integrity: number;
  availability: number;
} {
  // Default: use impact score for all three
  let confidentiality = impactScore;
  let integrity = impactScore;
  let availability = impactScore;
  
  // Try to parse impact categories if provided
  if (impactCategories) {
    const lower = impactCategories.toLowerCase();
    // If specific categories are mentioned, we could adjust, but for now use same value
    // This is a simplified mapping - in reality, you might want more sophisticated logic
  }
  
  return { confidentiality, integrity, availability };
}

/**
 * Import risks from a single CSV file
 */
async function importDepartmentalRisksFromFile(filePath: string): Promise<{
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}> {
  const result = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ row: number; error: string }>,
  };
  
  const filename = path.basename(filePath);
  const department = getDepartmentFromFilename(filename);
  
  if (!department) {
    throw new Error(`Could not determine department from filename: ${filename}`);
  }
  
  console.log(`\nProcessing ${filename} -> Department: ${department}`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseDepartmentalRiskCSV(content);
  
  // Get or create "Unspecified" interested party
  let unspecifiedParty = await prisma.interestedParty.findUnique({
    where: { name: 'Unspecified' },
  });
  if (!unspecifiedParty) {
    unspecifiedParty = await prisma.interestedParty.create({
      data: {
        id: randomUUID(),
        name: 'Unspecified',
        updatedAt: new Date(),
      },
    });
  }
  
  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 because header is on line 1, and we're 0-indexed
    
    try {
      // Skip if no risk description
      const riskDescription = (row['Risk Description'] || '').trim();
      if (!riskDescription) {
        continue; // Skip empty rows
      }
      
      const threatDescription = (row['Threat Description'] || '').trim();
      const impactScore = parseIntSafe(row['Impact Score (1-5)']) || 1;
      const likelihood = parseIntSafe(row['Likelihood Score (1-5)']) || 1;
      const riskScore = parseIntSafe(row['Risk Score']);
      const impactCategories = (row['Impact Categories'] || '').trim();
      const existingControls = (row['Existing Controls'] || '').trim();
      const potentialAdditionalControls = (row['Potential Additional Controls'] || '').trim();
      
      // Map impact categories to CIA scores
      const { confidentiality, integrity, availability } = mapImpactCategoriesToCIA(
        impactCategories,
        impactScore
      );
      
      // Calculate risk score
      const calculatedScore = calculateRiskScore(
        confidentiality,
        integrity,
        availability,
        likelihood
      );
      
      // Combine existing and potential controls for mitigation description
      let mitigationDescription = '';
      if (existingControls) {
        mitigationDescription = `Existing Controls: ${existingControls}`;
      }
      if (potentialAdditionalControls) {
        if (mitigationDescription) {
          mitigationDescription += `\n\nPotential Additional Controls: ${potentialAdditionalControls}`;
        } else {
          mitigationDescription = `Potential Additional Controls: ${potentialAdditionalControls}`;
        }
      }
      
      // Create risk
      const riskId = randomUUID();
      await prisma.risk.create({
        data: {
          id: riskId,
          title: riskDescription,
          description: riskDescription,
          dateAdded: new Date(),
          riskCategory: null,
          riskNature: 'STATIC',
          ownerUserId: null,
          department: department,
          status: 'ACTIVE', // Set as ACTIVE since these are existing assessments
          wizardData: null,
          rejectionReason: null,
          mergedIntoRiskId: null,
          assetCategory: null,
          assetId: null,
          assetCategoryId: null,
          interestedPartyId: unspecifiedParty.id,
          threatDescription: threatDescription || null,
          archived: false,
          expiryDate: null,
          lastReviewDate: null,
          nextReviewDate: null,
          confidentialityScore: confidentiality,
          integrityScore: integrity,
          availabilityScore: availability,
          riskScore: riskScore || calculatedScore,
          likelihood: likelihood,
          calculatedScore: calculatedScore,
          initialRiskTreatmentCategory: null,
          mitigatedConfidentialityScore: null,
          mitigatedIntegrityScore: null,
          mitigatedAvailabilityScore: null,
          mitigatedRiskScore: null,
          mitigatedLikelihood: null,
          mitigatedScore: null,
          mitigationImplemented: false,
          mitigationDescription: mitigationDescription || null,
          residualRiskTreatmentCategory: null,
          annexAControlsRaw: null,
          updatedAt: new Date(),
        },
      });
      
      result.success++;
      console.log(`  ✓ Row ${rowNumber}: ${riskDescription.substring(0, 50)}...`);
    } catch (error: any) {
      result.errors.push({
        row: rowNumber,
        error: `Failed to import risk: ${error.message}`,
      });
      result.failed++;
      console.error(`  ✗ Row ${rowNumber}: ${error.message}`);
    }
  }
  
  return result;
}

/**
 * Main function to import all departmental risk assessments
 */
async function main() {
  const docsDir = path.join(__dirname, '../../docs/Departmental Risk Assessments');
  
  console.log('Importing departmental risk assessments...');
  console.log(`Directory: ${docsDir}`);
  
  if (!fs.existsSync(docsDir)) {
    console.error(`Directory does not exist: ${docsDir}`);
    process.exit(1);
  }
  
  // Find all CSV files in the directory
  const files = fs.readdirSync(docsDir)
    .filter(file => file.endsWith('.csv') && file.includes('CLEANED'));
  
  if (files.length === 0) {
    console.error('No CSV files found in the directory');
    process.exit(1);
  }
  
  console.log(`\nFound ${files.length} CSV file(s):`);
  files.forEach(file => console.log(`  - ${file}`));
  
  const totalResult = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ file: string; row: number; error: string }>,
  };
  
  // Process each file
  for (const file of files) {
    const filePath = path.join(docsDir, file);
    try {
      const result = await importDepartmentalRisksFromFile(filePath);
      totalResult.success += result.success;
      totalResult.failed += result.failed;
      result.errors.forEach(error => {
        totalResult.errors.push({
          file,
          row: error.row,
          error: error.error,
        });
      });
    } catch (error: any) {
      console.error(`\nFailed to process ${file}: ${error.message}`);
      totalResult.failed++;
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Import Summary');
  console.log('='.repeat(60));
  console.log(`Total files processed: ${files.length}`);
  console.log(`Total risks imported: ${totalResult.success}`);
  console.log(`Total failures: ${totalResult.failed}`);
  
  if (totalResult.errors.length > 0) {
    console.log('\nErrors:');
    totalResult.errors.forEach(error => {
      console.log(`  ${error.file} (Row ${error.row}): ${error.error}`);
    });
  }
  
  console.log('\nImport completed!');
  process.exit(totalResult.failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


