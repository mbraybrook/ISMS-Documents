/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';

interface CSVRow {
  Date: string;
  'Asset Category': string;
  'Asset Sub-category': string;
  Owner: string;
  '[Primary] User': string;
  Location: string;
  'Manufacturer / Supplier': string;
  'Model / Version': string;
  'Name / Serial No.': string;
  'Paythru Classification': string;
  Purpose: string;
  Notes: string;
  Cost: string;
}

interface ImportResult {
  success: number;
  failed: number;
  total: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Parse date from DD/MM/YYYY format to Date object
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const year = parseInt(parts[2], 10);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  
  return new Date(year, month, day);
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
  
  const headers = parseCSVLine(lines[0]);
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => v === '')) continue;
    
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row as CSVRow);
  }
  
  return rows;
}

/**
 * Parse CSV file and return rows
 */
function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseCSVFromContent(content);
}

/**
 * Normalize classification name (remove extra spaces)
 */
function normalizeClassification(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Import assets from CSV file path or file content
 */
export async function importAssetsFromCSV(csvFilePathOrContent: string | Buffer): Promise<ImportResult> {
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
      rows = parseCSV(csvFilePathOrContent);
    }
    result.total = rows.length;
    
    // First, ensure all classifications exist
    const classificationMap = new Map<string, string>();
    const classifications = await prisma.classification.findMany();
    classifications.forEach(c => {
      classificationMap.set(c.name, c.id);
    });
    
    // Create missing classifications
    const uniqueClassifications = new Set<string>();
    rows.forEach(row => {
      const classificationName = normalizeClassification(row['Paythru Classification'] || '');
      if (classificationName) {
        uniqueClassifications.add(classificationName);
      }
    });
    
    for (const classificationName of uniqueClassifications) {
      if (!classificationMap.has(classificationName)) {
        const newClassification = await prisma.classification.create({
          data: {
            id: randomUUID(),
            name: classificationName,
            updatedAt: new Date(),
          },
        });
        classificationMap.set(classificationName, newClassification.id);
      }
    }
    
    // Ensure all asset categories exist
    const categoryMap = new Map<string, string>();
    const categories = await prisma.assetCategory.findMany();
    categories.forEach(c => {
      categoryMap.set(c.name, c.id);
    });
    
    const uniqueCategories = new Set<string>();
    rows.forEach(row => {
      const categoryName = (row['Asset Category'] || '').trim();
      if (categoryName) {
        uniqueCategories.add(categoryName);
      }
    });
    
    for (const categoryName of uniqueCategories) {
      if (!categoryMap.has(categoryName)) {
        const newCategory = await prisma.assetCategory.create({
          data: {
            id: randomUUID(),
            name: categoryName,
            updatedAt: new Date(),
          },
        });
        categoryMap.set(categoryName, newCategory.id);
      }
    }
    
    // Import assets
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because header is row 1, and we're 0-indexed
      
      try {
        const date = parseDate(row.Date);
        if (!date) {
          result.errors.push({
            row: rowNumber,
            error: `Invalid date format: ${row.Date}`,
          });
          result.failed++;
          continue;
        }
        
        const categoryName = (row['Asset Category'] || '').trim();
        if (!categoryName) {
          result.errors.push({
            row: rowNumber,
            error: 'Asset Category is required',
          });
          result.failed++;
          continue;
        }
        
        const categoryId = categoryMap.get(categoryName);
        if (!categoryId) {
          result.errors.push({
            row: rowNumber,
            error: `Asset Category not found: ${categoryName}`,
          });
          result.failed++;
          continue;
        }
        
        const classificationName = normalizeClassification(row['Paythru Classification'] || '');
        if (!classificationName) {
          result.errors.push({
            row: rowNumber,
            error: 'Paythru Classification is required',
          });
          result.failed++;
          continue;
        }
        
        const classificationId = classificationMap.get(classificationName);
        if (!classificationId) {
          result.errors.push({
            row: rowNumber,
            error: `Classification not found: ${classificationName}`,
          });
          result.failed++;
          continue;
        }
        
        await prisma.asset.create({
          data: {
            id: randomUUID(),
            date,
            assetCategoryId: categoryId,
            assetSubCategory: (row['Asset Sub-category'] || '').trim() || null,
            owner: (row.Owner || '').trim(),
            primaryUser: (row['[Primary] User'] || '').trim() || null,
            location: (row.Location || '').trim() || null,
            manufacturer: (row['Manufacturer / Supplier'] || '').trim() || null,
            model: (row['Model / Version'] || '').trim() || null,
            nameSerialNo: (row['Name / Serial No.'] || '').trim() || null,
            classificationId,
            purpose: (row.Purpose || '').trim() || null,
            notes: (row.Notes || '').trim() || null,
            cost: (row.Cost || '').trim() || null,
            updatedAt: new Date(),
          },
        });
        
        result.success++;
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          error: error.message || 'Unknown error',
        });
        result.failed++;
      }
    }
    
    return result;
  } catch (error: any) {
    throw new Error(`Failed to import assets: ${error.message}`);
  }
}

