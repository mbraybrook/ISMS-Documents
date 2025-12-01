import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { calculateRiskScore, calculateMitigatedScore, parseControlCodes, updateRiskControls } from './riskService';

interface CSVRow {
  '#': string;
  'Date Added': string;
  'Risk Type': string;
  'Owner': string;
  'Asset / Asset Category': string;
  'Interested Party': string;
  'Threat Description': string;
  'Risk Description': string;
  'Existing Controls': string;
  'C': string;
  'I': string;
  'A': string;
  'R': string;
  'L': string;
  'Score': string;
  'Initial Risk Treatment Category': string;
  'Additional Controls': string;
  'MC': string;
  'MI': string;
  'MA': string;
  'MR': string;
  'ML': string;
  'Mitigated Score': string;
  'Mitigation Implemented': string;
  'Residual Risk Treatment Category': string;
  'Annex A Applicable Controls (ISO 27001:2022)': string;
}

interface ImportResult {
  success: number;
  failed: number;
  total: number;
  errors: Array<{ row: number; error: string }>;
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
function parseCSVFromContent(content: string): CSVRow[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  // Find header row (line 4, index 3)
  const headerIndex = 3;
  if (lines.length <= headerIndex) {
    throw new Error('CSV file does not contain enough lines');
  }
  
  const headers = parseCSVLine(lines[headerIndex]);
  const rows: CSVRow[] = [];
  
  // Process data rows (starting from line 5, index 4)
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    // Skip empty rows
    if (values.every(v => !v || v.trim() === '')) {
      continue;
    }
    
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row as CSVRow);
  }
  
  return rows;
}

/**
 * Parse date string (e.g., "May-18", "Oct-25", "Apr-23")
 */
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr || !dateStr.trim()) {
    return null;
  }
  
  try {
    const trimmed = dateStr.trim();
    
    // Handle formats like "May-18", "Oct-25", "Apr-23"
    const monthMap: { [key: string]: number } = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const parts = trimmed.split('-');
    if (parts.length === 2) {
      const monthName = parts[0].substring(0, 3);
      const yearStr = parts[1];
      
      const month = monthMap[monthName];
      if (month !== undefined) {
        // Assume 20xx for years < 50, 19xx otherwise
        const year = parseInt(yearStr) < 50 ? 2000 + parseInt(yearStr) : 1900 + parseInt(yearStr);
        return new Date(year, month, 1);
      }
    }
    
    // Try standard date parsing
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (e) {
    // Ignore parsing errors
  }
  return null;
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
 * Normalize interested party name
 */
function normalizeInterestedParty(name: string): string {
  if (!name || !name.trim()) {
    return '';
  }
  return name.trim();
}

/**
 * Normalize owner name (MD, CISO, etc.)
 */
function normalizeOwner(name: string): string {
  if (!name || !name.trim()) {
    return '';
  }
  return name.trim().toUpperCase();
}

/**
 * Import risks from CSV file path or file content
 */
export async function importRisksFromCSV(csvFilePathOrContent: string | Buffer): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    total: 0,
    errors: [],
  };
  
  try {
    let rows: CSVRow[];
    if (Buffer.isBuffer(csvFilePathOrContent)) {
      // Parse from buffer content
      const content = csvFilePathOrContent.toString('utf-8');
      rows = parseCSVFromContent(content);
    } else {
      // Parse from file path
      const content = fs.readFileSync(csvFilePathOrContent, 'utf-8');
      rows = parseCSVFromContent(content);
    }
    result.total = rows.length;
    
    // Get or create interested parties
    const interestedPartyMap = new Map<string, string>();
    const existingParties = await prisma.interestedParty.findMany();
    existingParties.forEach(party => {
      interestedPartyMap.set(party.name.toLowerCase(), party.id);
    });
    
    // Get users for owners
    const userMap = new Map<string, string>();
    const users = await prisma.user.findMany();
    users.forEach(user => {
      // Map by display name or email
      userMap.set(user.displayName.toUpperCase(), user.id);
      userMap.set(user.email.toUpperCase(), user.id);
    });
    
    // Get or create asset categories
    const assetCategoryMap = new Map<string, string>();
    const existingCategories = await prisma.assetCategory.findMany();
    existingCategories.forEach(cat => {
      assetCategoryMap.set(cat.name.toLowerCase(), cat.id);
    });
    
    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 5; // +5 because header is on line 4, and we're 0-indexed
      
      try {
        // Skip if no risk number or description
        const riskNumber = (row['#'] || '').trim();
        const riskDescription = (row['Risk Description'] || '').trim();
        
        if (!riskNumber && !riskDescription) {
          continue; // Skip empty rows
        }
        
        // Get or create interested party (use "Unspecified" if empty)
        let interestedPartyName = normalizeInterestedParty(row['Interested Party'] || '');
        if (!interestedPartyName) {
          interestedPartyName = 'Unspecified';
        }
        
        let interestedPartyId = interestedPartyMap.get(interestedPartyName.toLowerCase());
        if (!interestedPartyId) {
          const newParty = await prisma.interestedParty.create({
            data: {
              id: randomUUID(),
              name: interestedPartyName,
              updatedAt: new Date(),
            },
          });
          interestedPartyId = newParty.id;
          interestedPartyMap.set(interestedPartyName.toLowerCase(), interestedPartyId);
        }
        
        // Get owner user ID (optional)
        let ownerUserId: string | null = null;
        const ownerName = normalizeOwner(row['Owner'] || '');
        if (ownerName) {
          ownerUserId = userMap.get(ownerName) || null;
          // If not found, we'll leave it null (owner is optional)
        }
        
        // Get or create asset category (optional)
        let assetCategoryId: string | null = null;
        const assetCategoryName = (row['Asset / Asset Category'] || '').trim();
        if (assetCategoryName) {
          let categoryId = assetCategoryMap.get(assetCategoryName.toLowerCase());
          if (!categoryId) {
            const newCategory = await prisma.assetCategory.create({
              data: {
                id: randomUUID(),
                name: assetCategoryName,
                updatedAt: new Date(),
              },
            });
            categoryId = newCategory.id;
            assetCategoryMap.set(assetCategoryName.toLowerCase(), categoryId);
          }
          assetCategoryId = categoryId;
        }
        
        // Parse risk scores
        const confidentialityScore = parseIntSafe(row['C']) || 1;
        const integrityScore = parseIntSafe(row['I']) || 1;
        const availabilityScore = parseIntSafe(row['A']) || 1;
        const likelihood = parseIntSafe(row['L']) || 1;
        
        // Calculate risk score
        const calculatedScore = calculateRiskScore(
          confidentialityScore,
          integrityScore,
          availabilityScore,
          likelihood
        );
        
        // Parse mitigated scores
        const mitigatedConfidentiality = parseIntSafe(row['MC']);
        const mitigatedIntegrity = parseIntSafe(row['MI']);
        const mitigatedAvailability = parseIntSafe(row['MA']);
        const mitigatedLikelihood = parseIntSafe(row['ML']);
        
        // Calculate mitigated score
        const mitigatedScore = calculateMitigatedScore(
          mitigatedConfidentiality,
          mitigatedIntegrity,
          mitigatedAvailability,
          mitigatedLikelihood
        );
        
        // Parse mitigation implemented (Y/N)
        const mitigationImplemented = (row['Mitigation Implemented'] || '').trim().toUpperCase() === 'Y';
        
        // Parse risk nature (Static/Instance)
        const riskNature = (row['Risk Type'] || '').trim().toUpperCase() === 'INSTANCE' ? 'INSTANCE' : 'STATIC';
        
        // Create risk
        const riskId = randomUUID();
        const risk = await prisma.risk.create({
          data: {
            id: riskId,
            title: riskDescription || `Risk ${riskNumber}`,
            description: riskDescription || null,
            dateAdded: parseDate(row['Date Added']) || new Date(),
            riskCategory: null, // Not in CSV
            riskNature,
            ownerUserId,
            assetCategory: assetCategoryName || null,
            assetCategoryId,
            assetId: null,
            interestedPartyId,
            threatDescription: (row['Threat Description'] || '').trim() || null,
            archived: false,
            expiryDate: null,
            lastReviewDate: null,
            nextReviewDate: null,
            confidentialityScore,
            integrityScore,
            availabilityScore,
            riskScore: parseIntSafe(row['R']),
            likelihood,
            calculatedScore,
            initialRiskTreatmentCategory: (row['Initial Risk Treatment Category'] || '').trim().toUpperCase() || null,
            mitigatedConfidentialityScore: mitigatedConfidentiality,
            mitigatedIntegrityScore: mitigatedIntegrity,
            mitigatedAvailabilityScore: mitigatedAvailability,
            mitigatedRiskScore: parseIntSafe(row['MR']),
            mitigatedLikelihood: mitigatedLikelihood,
            mitigatedScore,
            mitigationImplemented,
            mitigationDescription: (row['Additional Controls'] || '').trim() || null,
            residualRiskTreatmentCategory: (row['Residual Risk Treatment Category'] || '').trim().toUpperCase() || null,
            annexAControlsRaw: (row['Annex A Applicable Controls (ISO 27001:2022)'] || '').trim() || null,
            updatedAt: new Date(),
          },
        });
        
        // Link controls if Annex A controls are specified
        const annexAControls = row['Annex A Applicable Controls (ISO 27001:2022)'] || '';
        if (annexAControls.trim()) {
          const controlCodes = parseControlCodes(annexAControls);
          if (controlCodes.length > 0) {
            await updateRiskControls(riskId, controlCodes);
          }
        }
        
        result.success++;
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          error: `Failed to import risk: ${error.message}`,
        });
        result.failed++;
      }
    }
    
    return result;
  } catch (error: any) {
    throw new Error(`Failed to import risks: ${error.message}`);
  }
}

