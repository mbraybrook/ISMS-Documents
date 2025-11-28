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
    
    // Get unique interested parties (by name)
    const uniqueParties = new Map<string, { name: string; group: string | null }>();
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = normalizeName(row['Interested party'] || '');
      const group = (row['Group'] || '').trim() || null;
      
      if (!name) {
        continue; // Skip rows without a name
      }
      
      // Use the first occurrence's group if multiple rows have the same name
      if (!uniqueParties.has(name)) {
        uniqueParties.set(name, { name, group });
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
            description: null, // Could be populated from Requirements column if needed
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

