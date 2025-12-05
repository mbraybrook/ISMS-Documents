import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { parseISO27002Controls } from './parse-iso27002-controls';

// Load environment variables using the same method as the main app
import { config } from '../src/config';

// Use the configured database URL from the main app config
process.env.DATABASE_URL = config.databaseUrl;

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

interface ParsedControl {
  code: string;
  title: string;
  controlText: string;
  purpose: string;
  guidance: string;
  otherInformation: string | null;
  category: 'ORGANIZATIONAL' | 'PEOPLE' | 'PHYSICAL' | 'TECHNOLOGICAL';
}

/**
 * Seed ISO 27002 controls into the database
 */
async function seedISO27002Controls() {
  try {
    console.log('🌱 Starting ISO 27002 controls seed...');
    
    // Parse controls from markdown file
    // Try Docker path first (/docs), then fall back to relative path for local development
    const dockerPath = '/docs/ISO_IEC_27002_2022(en).md';
    const localPath = path.join(__dirname, '../../docs/ISO_IEC_27002_2022(en).md');
    const markdownPath = fs.existsSync(dockerPath) ? dockerPath : localPath;
    console.log(`📖 Parsing ISO 27002 document: ${markdownPath}`);
    
    const controls = parseISO27002Controls(markdownPath);
    console.log(`✅ Parsed ${controls.length} controls from ISO 27002`);
    
    // Process each control
    let created = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const control of controls) {
      try {
        // Check if control already exists
        const existing = await prisma.control.findUnique({
          where: { code: control.code },
        });
        
        if (existing) {
          // Always update standard controls to ensure they match the source document
          // This is important when the source document is corrected or updated
          if (existing.isStandardControl) {
            // Check if any fields have changed
            const hasChanges = 
              existing.title !== control.title ||
              existing.controlText !== control.controlText ||
              existing.purpose !== control.purpose ||
              existing.guidance !== control.guidance ||
              existing.otherInformation !== control.otherInformation ||
              existing.category !== control.category ||
              existing.description !== control.controlText.substring(0, 500);
            
            if (hasChanges) {
              await prisma.control.update({
                where: { code: control.code },
                data: {
                  title: control.title,
                  description: control.controlText.substring(0, 500), // Use control text as description
                  controlText: control.controlText,
                  purpose: control.purpose,
                  guidance: control.guidance,
                  otherInformation: control.otherInformation,
                  category: control.category,
                  updatedAt: new Date(),
                },
              });
              updated++;
              console.log(`  ↻ Updated: ${control.code} - ${control.title}`);
            } else {
              skipped++;
              console.log(`  ⊘ Skipped (no changes): ${control.code} - ${control.title}`);
            }
          } else {
            // Update non-standard control to become standard
            await prisma.control.update({
              where: { code: control.code },
              data: {
                title: control.title,
                description: control.controlText.substring(0, 500), // Use control text as description
                controlText: control.controlText,
                purpose: control.purpose,
                guidance: control.guidance,
                otherInformation: control.otherInformation,
                category: control.category,
                isStandardControl: true,
                updatedAt: new Date(),
              },
            });
            updated++;
            console.log(`  ↻ Updated: ${control.code} - ${control.title}`);
          }
        } else {
          // Create new control
          await prisma.control.create({
            data: {
              id: randomUUID(),
              code: control.code,
              title: control.title,
              description: control.controlText.substring(0, 500), // Use control text as description
              controlText: control.controlText,
              purpose: control.purpose,
              guidance: control.guidance,
              otherInformation: control.otherInformation,
              category: control.category,
              isStandardControl: true,
              selectedForRiskAssessment: false,
              selectedForContractualObligation: false,
              selectedForLegalRequirement: false,
              selectedForBusinessRequirement: false,
              updatedAt: new Date(),
            },
          });
          created++;
          console.log(`  ✨ Created: ${control.code} - ${control.title}`);
        }
      } catch (error: any) {
        console.error(`  ❌ Error processing ${control.code}:`, error.message);
      }
    }
    
    console.log('\n📊 Seed Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${controls.length}`);
    
    console.log('\n✅ ISO 27002 controls seed completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding ISO 27002 controls:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI execution
if (require.main === module) {
  seedISO27002Controls()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}

export { seedISO27002Controls };

