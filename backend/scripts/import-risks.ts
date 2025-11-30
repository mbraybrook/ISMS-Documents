import { importRisksFromCSV } from '../src/services/riskImportService';
import * as path from 'path';

async function main() {
  const csvPath = path.join(__dirname, '../../docs/Risks.csv');
  
  console.log('Importing risks from CSV...');
  console.log(`File: ${csvPath}`);
  
  try {
    const result = await importRisksFromCSV(csvPath);
    
    console.log('\nImport completed!');
    console.log(`Total rows: ${result.total}`);
    console.log(`Success: ${result.success}`);
    console.log(`Failed: ${result.failed}`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(error => {
        console.log(`  Row ${error.row}: ${error.error}`);
      });
    }
    
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('Import failed:', error.message);
    process.exit(1);
  }
}

main();

