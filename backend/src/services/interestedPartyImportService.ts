import * as fs from 'fs';
import { prisma } from '../lib/prisma';

interface CSVRow {
  'Date Added': string;
  'Group': string;
  'Interested party': string;
  'Requirements': string;
  'Will this be addressed through ISMS: Yes/No?': string;
  'How the Requirements will be addressed through the ISMS': string;
  'Source/Link to Supporting Information': string;
  'Key products / services': string;
  'Our obligations': string;
  'Their obligations': string;
  'Risk links': string;
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
 * Parse CSV content from string
 */
function parseCSVFromContent(content: string): CSVRow[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }
  
  // Find the header row (skip empty rows at the start)
  let headerIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Date Added') && lines[i].includes('Interested party')) {
      headerIndex = i;
      break;
    }
  }
  
  const headers = parseCSVLine(lines[headerIndex]);
  const rows: CSVRow[] = [];
  
  // Start parsing from the row after the header
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => v === '')) continue;
    
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    // Only add rows that have an interested party name
    if (row['Interested party'] && row['Interested party'].trim()) {
      rows.push(row as CSVRow);
    }
  }
  
  return rows;
}

/**
 * Normalize interested party name (remove extra spaces)
 */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Convert Yes/No string to boolean
 */
function parseYesNo(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'yes' || normalized === 'y' || normalized === 'true') {
    return true;
  }
  if (normalized === 'no' || normalized === 'n' || normalized === 'false') {
    return false;
  }
  return null;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  try {
    // Try parsing DD/MM/YYYY format (common in CSV)
    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    // Try ISO format
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (e) {
    // Ignore parsing errors
  }
  return null;
}

/**
 * Import interested parties from CSV file path or file content
 */
export async function importInterestedPartiesFromCSV(csvFilePathOrContent: string | Buffer): Promise<ImportResult> {
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
    
    // Get unique interested parties (by name), preserving all field data
    interface PartyData {
      name: string;
      group: string | null;
      dateAdded: Date | null;
      requirements: string | null;
      addressedThroughISMS: boolean | null;
      howAddressedThroughISMS: string | null;
      sourceLink: string | null;
      keyProductsServices: string | null;
      ourObligations: string | null;
      theirObligations: string | null;
    }
    
    const uniqueParties = new Map<string, PartyData>();
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = normalizeName(row['Interested party'] || '');
      
      if (!name) {
        continue; // Skip rows without a name
      }
      
      // Use the first occurrence's data if multiple rows have the same name
      if (!uniqueParties.has(name)) {
        uniqueParties.set(name, {
          name,
          group: (row['Group'] || '').trim() || null,
          dateAdded: parseDate(row['Date Added']),
          requirements: (row['Requirements'] || '').trim() || null,
          addressedThroughISMS: parseYesNo(row['Will this be addressed through ISMS: Yes/No?']),
          howAddressedThroughISMS: (row['How the Requirements will be addressed through the ISMS'] || '').trim() || null,
          sourceLink: (row['Source/Link to Supporting Information'] || '').trim() || null,
          keyProductsServices: (row['Key products / services'] || '').trim() || null,
          ourObligations: (row['Our obligations'] || '').trim() || null,
          theirObligations: (row['Their obligations'] || '').trim() || null,
        });
      }
    }
    
    result.total = uniqueParties.size;
    
    // Get existing interested parties
    const existingParties = await prisma.interestedParty.findMany();
    const existingNames = new Set(existingParties.map(p => p.name));
    
    // Create new interested parties
    for (const [name, data] of uniqueParties.entries()) {
      try {
        if (existingNames.has(name)) {
          // Skip if already exists
          result.success++;
          continue;
        }
        
        await prisma.interestedParty.create({
          data: {
            name: data.name,
            group: data.group,
            description: data.requirements, // Use requirements as description for backward compatibility
            dateAdded: data.dateAdded,
            requirements: data.requirements,
            addressedThroughISMS: data.addressedThroughISMS,
            howAddressedThroughISMS: data.howAddressedThroughISMS,
            sourceLink: data.sourceLink,
            keyProductsServices: data.keyProductsServices,
            ourObligations: data.ourObligations,
            theirObligations: data.theirObligations,
          },
        });
        
        result.success++;
      } catch (error: any) {
        result.errors.push({
          row: 0, // Row number not applicable for unique aggregation
          error: `Failed to create interested party "${name}": ${error.message}`,
        });
        result.failed++;
      }
    }
    
    return result;
  } catch (error: any) {
    throw new Error(`Failed to import interested parties: ${error.message}`);
  }
}

