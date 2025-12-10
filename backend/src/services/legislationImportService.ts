/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';

interface CSVRow {
  'Date Added': string;
  'Interested party': string;
  'Act / Regulation / Requirement': string;
  'Description': string;
  'Risk of non-compliance': string;
  'How compliance is achieved': string;
  'Risk Links': string;
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
    if (lines[i].includes('Date Added') && lines[i].includes('Act / Regulation / Requirement')) {
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
    
    // Only add rows that have an act/regulation/requirement name
    if (row['Act / Regulation / Requirement'] && row['Act / Regulation / Requirement'].trim()) {
      rows.push(row as CSVRow);
    }
  }
  
  return rows;
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
 * Parse risk links string (comma-separated risk IDs or external IDs)
 */
async function parseRiskLinks(riskLinksStr: string | undefined): Promise<string[]> {
  if (!riskLinksStr || !riskLinksStr.trim()) return [];
  
  const riskIds: string[] = [];
  const parts = riskLinksStr.split(',').map(p => p.trim()).filter(p => p);
  
  for (const part of parts) {
    // Try to find risk by id
    const risk = await prisma.risk.findFirst({
      where: {
        id: part,
      },
      select: { id: true },
    });
    
    if (risk) {
      riskIds.push(risk.id);
    }
  }
  
  return riskIds;
}

/**
 * Import legislation from CSV file path or file content
 */
export async function importLegislationFromCSV(csvFilePathOrContent: string | Buffer): Promise<ImportResult> {
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
    
    // Get existing legislation by act/regulation/requirement name
    const existingLegislation = await prisma.legislation.findMany();
    const existingNames = new Set(existingLegislation.map(l => l.actRegulationRequirement));
    
    // Create new legislation records
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const actRegulationRequirement = (row['Act / Regulation / Requirement'] || '').trim();
      
      if (!actRegulationRequirement) {
        result.errors.push({
          row: i + 2, // +2 for header and 1-based indexing
          error: 'Missing Act / Regulation / Requirement',
        });
        result.failed++;
        continue;
      }
      
      try {
        if (existingNames.has(actRegulationRequirement)) {
          // Skip if already exists
          result.success++;
          continue;
        }
        
        // Parse risk links
        const riskIds = await parseRiskLinks(row['Risk Links']);
        
        await prisma.legislation.create({
          data: {
            id: randomUUID(),
            dateAdded: parseDate(row['Date Added']),
            interestedParty: (row['Interested party'] || '').trim() || null,
            actRegulationRequirement,
            description: (row['Description'] || '').trim() || null,
            riskOfNonCompliance: (row['Risk of non-compliance'] || '').trim() || null,
            howComplianceAchieved: (row['How compliance is achieved'] || '').trim() || null,
            updatedAt: new Date(),
            risks: riskIds.length > 0 ? {
              create: riskIds.map(riskId => ({ riskId })),
            } : undefined,
          },
        });
        
        existingNames.add(actRegulationRequirement);
        result.success++;
      } catch (error: any) {
        result.errors.push({
          row: i + 2,
          error: `Failed to create legislation "${actRegulationRequirement}": ${error.message}`,
        });
        result.failed++;
      }
    }
    
    return result;
  } catch (error: any) {
    throw new Error(`Failed to import legislation: ${error.message}`);
  }
}

