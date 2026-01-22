import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { backfillControlEmbeddings } from '../src/services/embeddingService';

const prisma = new PrismaClient();

type SeedScope = 'system' | 'reference' | 'full' | 'none';

interface SeedData {
  classifications?: Record<string, unknown>[];
  assetCategories?: Record<string, unknown>[];
  assets?: Record<string, unknown>[];
  risks?: Record<string, unknown>[];
  controls?: Record<string, unknown>[];
  documents?: Record<string, unknown>[];
  interestedParties?: Record<string, unknown>[];
  legislation?: Record<string, unknown>[];
  riskControls?: Record<string, unknown>[];
  documentRisks?: Record<string, unknown>[];
  documentControls?: Record<string, unknown>[];
  legislationRisks?: Record<string, unknown>[];
}

/**
 * Load seed data from JSON files in the seed-data directory
 */
function loadSeedData(scope: SeedScope): SeedData {
  const seedDataDir = path.join(__dirname, 'seed-data');
  const data: SeedData = {};

  if (scope === 'none') {
    return data;
  }

  // Reference data (loaded for 'system', 'reference', and 'full')
  // 'system' scope only seeds essential system data if missing (idempotent create-only)
  // 'reference' and 'full' scopes use upsert (create or update)
  const referenceFiles = [
    'classifications.json',
    'asset-categories.json',
    'controls.json',
    'legislation.json',
    'interested-parties.json',
  ];

  for (const file of referenceFiles) {
    const filePath = path.join(seedDataDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const key = file.replace('.json', '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      // Handle camelCase conversion for multi-word keys
      if (key === 'assetCategories') {
        data.assetCategories = JSON.parse(content);
      } else if (key === 'interestedParties') {
        data.interestedParties = JSON.parse(content);
      } else if (key === 'classifications') {
        data.classifications = JSON.parse(content);
      } else {
        data[key as keyof SeedData] = JSON.parse(content);
      }
    }
  }

  // Full data (only loaded for 'full' scope)
  if (scope === 'full') {
    const fullDataFiles = [
      'assets.json',
      'risks.json',
      'documents.json',
      'risk-controls.json',
      'document-risks.json',
      'document-controls.json',
      'legislation-risks.json',
    ];

    for (const file of fullDataFiles) {
      const filePath = path.join(seedDataDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const key = file.replace('.json', '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        // Handle camelCase conversion for multi-word keys
        if (key === 'riskControls') {
          data.riskControls = JSON.parse(content);
        } else if (key === 'documentRisks') {
          data.documentRisks = JSON.parse(content);
        } else if (key === 'documentControls') {
          data.documentControls = JSON.parse(content);
        } else if (key === 'legislationRisks') {
          data.legislationRisks = JSON.parse(content);
        } else {
          data[key as keyof SeedData] = JSON.parse(content);
        }
      }
    }
  }

  return data;
}

/**
 * Seed Classifications
 */
async function seedClassifications(data: Record<string, unknown>[], createOnly: boolean = false) {
  if (!data || data.length === 0) return;

  console.log(`Seeding ${data.length} classifications...`);
  let created = 0;
  let skipped = 0;
  
  for (const item of data) {
    if (createOnly) {
      // Only create if missing (system scope - preserve manual changes)
      const existing = await prisma.classification.findUnique({
        where: { id: item.id },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.classification.create({
        data: {
          id: item.id,
          name: item.name,
          description: item.description,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
      });
      created++;
    } else {
      // Upsert (reference/full scope - can update existing)
      await prisma.classification.upsert({
        where: { id: item.id },
        update: {
          name: item.name,
          description: item.description,
          updatedAt: new Date(),
        },
        create: {
          id: item.id,
          name: item.name,
          description: item.description,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
      });
      created++;
    }
  }
  if (createOnly && skipped > 0) {
    console.log(`✓ Seeded ${created} classifications (${skipped} already existed, skipped)`);
  } else {
    console.log(`✓ Seeded ${created} classifications`);
  }
}

/**
 * Seed Asset Categories
 */
async function seedAssetCategories(data: Record<string, unknown>[], createOnly: boolean = false) {
  if (!data || data.length === 0) return;

  console.log(`Seeding ${data.length} asset categories...`);
  let created = 0;
  let skipped = 0;
  
  for (const item of data) {
    if (createOnly) {
      // Only create if missing (system scope - preserve manual changes)
      const existing = await prisma.assetCategory.findUnique({
        where: { id: item.id },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.assetCategory.create({
        data: {
          id: item.id,
          name: item.name,
          description: item.description,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
      });
      created++;
    } else {
      // Upsert (reference/full scope - can update existing)
      await prisma.assetCategory.upsert({
        where: { id: item.id },
        update: {
          name: item.name,
          description: item.description,
          updatedAt: new Date(),
        },
        create: {
          id: item.id,
          name: item.name,
          description: item.description,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
      });
      created++;
    }
  }
  if (createOnly && skipped > 0) {
    console.log(`✓ Seeded ${created} asset categories (${skipped} already existed, skipped)`);
  } else {
    console.log(`✓ Seeded ${created} asset categories`);
  }
}

/**
 * Seed Assets
 */
async function seedAssets(data: Record<string, unknown>[]) {
  if (!data || data.length === 0) return;

  console.log(`Seeding ${data.length} assets...`);
  for (const item of data) {
    await prisma.asset.upsert({
      where: { id: item.id },
      update: {
        date: new Date(item.date),
        assetCategoryId: item.assetCategoryId,
        assetSubCategory: item.assetSubCategory,
        owner: item.owner,
        primaryUser: item.primaryUser,
        location: item.location,
        manufacturer: item.manufacturer,
        model: item.model,
        nameSerialNo: item.nameSerialNo,
        cdeImpacting: item.cdeImpacting ?? false,
        classificationId: item.classificationId,
        purpose: item.purpose,
        notes: item.notes,
        cost: item.cost,
        updatedAt: new Date(),
      },
      create: {
        id: item.id,
        date: new Date(item.date),
        assetCategoryId: item.assetCategoryId,
        assetSubCategory: item.assetSubCategory,
        owner: item.owner,
        primaryUser: item.primaryUser,
        location: item.location,
        manufacturer: item.manufacturer,
        model: item.model,
        nameSerialNo: item.nameSerialNo,
        cdeImpacting: item.cdeImpacting ?? false,
        classificationId: item.classificationId,
        purpose: item.purpose,
        notes: item.notes,
        cost: item.cost,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      },
    });
  }
  console.log(`✓ Seeded ${data.length} assets`);
}

/**
 * Seed Risks
 */
async function seedRisks(data: Record<string, unknown>[]) {
  if (!data || data.length === 0) return;

  console.log(`Seeding ${data.length} risks...`);
  for (const item of data) {
    // Check if owner user exists, set to null if not (since users aren't in seed data)
    let ownerUserId = null;
    if (item.ownerUserId) {
      const userExists = await prisma.user.findUnique({
        where: { id: item.ownerUserId },
      });
      ownerUserId = userExists ? item.ownerUserId : null;
    }

    await prisma.risk.upsert({
      where: { id: item.id },
      update: {
        title: item.title,
        description: item.description,
        dateAdded: item.dateAdded ? new Date(item.dateAdded) : new Date(),
        riskCategory: item.riskCategory,
        riskNature: item.riskNature,
        ownerUserId: ownerUserId,
        department: item.department,
        status: item.status ?? 'DRAFT',
        wizardData: item.wizardData,
        rejectionReason: item.rejectionReason,
        mergedIntoRiskId: item.mergedIntoRiskId,
        assetCategory: item.assetCategory,
        assetId: item.assetId,
        assetCategoryId: item.assetCategoryId,
        interestedPartyId: item.interestedPartyId,
        threatDescription: item.threatDescription,
        archived: item.archived ?? false,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        lastReviewDate: item.lastReviewDate ? new Date(item.lastReviewDate) : null,
        nextReviewDate: item.nextReviewDate ? new Date(item.nextReviewDate) : null,
        confidentialityScore: item.confidentialityScore ?? 1,
        integrityScore: item.integrityScore ?? 1,
        availabilityScore: item.availabilityScore ?? 1,
        riskScore: item.riskScore,
        likelihood: item.likelihood ?? 1,
        calculatedScore: item.calculatedScore,
        initialRiskTreatmentCategory: item.initialRiskTreatmentCategory,
        mitigatedConfidentialityScore: item.mitigatedConfidentialityScore,
        mitigatedIntegrityScore: item.mitigatedIntegrityScore,
        mitigatedAvailabilityScore: item.mitigatedAvailabilityScore,
        mitigatedRiskScore: item.mitigatedRiskScore,
        mitigatedLikelihood: item.mitigatedLikelihood,
        mitigatedScore: item.mitigatedScore,
        mitigationImplemented: item.mitigationImplemented ?? false,
        mitigationDescription: item.mitigationDescription,
        residualRiskTreatmentCategory: item.residualRiskTreatmentCategory,
        annexAControlsRaw: item.annexAControlsRaw,
        updatedAt: new Date(),
      },
      create: {
        id: item.id,
        title: item.title,
        description: item.description,
        dateAdded: item.dateAdded ? new Date(item.dateAdded) : new Date(),
        riskCategory: item.riskCategory,
        riskNature: item.riskNature,
        ownerUserId: ownerUserId,
        department: item.department,
        status: item.status ?? 'DRAFT',
        wizardData: item.wizardData,
        rejectionReason: item.rejectionReason,
        mergedIntoRiskId: item.mergedIntoRiskId,
        assetCategory: item.assetCategory,
        assetId: item.assetId,
        assetCategoryId: item.assetCategoryId,
        interestedPartyId: item.interestedPartyId,
        threatDescription: item.threatDescription,
        archived: item.archived ?? false,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        lastReviewDate: item.lastReviewDate ? new Date(item.lastReviewDate) : null,
        nextReviewDate: item.nextReviewDate ? new Date(item.nextReviewDate) : null,
        confidentialityScore: item.confidentialityScore ?? 1,
        integrityScore: item.integrityScore ?? 1,
        availabilityScore: item.availabilityScore ?? 1,
        riskScore: item.riskScore,
        likelihood: item.likelihood ?? 1,
        calculatedScore: item.calculatedScore,
        initialRiskTreatmentCategory: item.initialRiskTreatmentCategory,
        mitigatedConfidentialityScore: item.mitigatedConfidentialityScore,
        mitigatedIntegrityScore: item.mitigatedIntegrityScore,
        mitigatedAvailabilityScore: item.mitigatedAvailabilityScore,
        mitigatedRiskScore: item.mitigatedRiskScore,
        mitigatedLikelihood: item.mitigatedLikelihood,
        mitigatedScore: item.mitigatedScore,
        mitigationImplemented: item.mitigationImplemented ?? false,
        mitigationDescription: item.mitigationDescription,
        residualRiskTreatmentCategory: item.residualRiskTreatmentCategory,
        annexAControlsRaw: item.annexAControlsRaw,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      },
    });
  }
  console.log(`✓ Seeded ${data.length} risks`);
}

/**
 * Seed Controls
 */
async function seedControls(data: Record<string, unknown>[], createOnly: boolean = false) {
  if (!data || data.length === 0) return;

  console.log(`Seeding ${data.length} controls...`);
  let created = 0;
  let skipped = 0;
  
  for (const item of data) {
    if (createOnly) {
      // Only create if missing (system scope - preserve manual changes and risk associations)
      const existing = await prisma.control.findUnique({
        where: { code: item.code as string },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.control.create({
        data: {
          id: item.id,
          code: item.code,
          title: item.title,
          description: item.description,
          selectedForRiskAssessment: item.selectedForRiskAssessment ?? false,
          selectedForContractualObligation: item.selectedForContractualObligation ?? false,
          selectedForLegalRequirement: item.selectedForLegalRequirement ?? false,
          selectedForBusinessRequirement: item.selectedForBusinessRequirement ?? false,
          justification: item.justification,
          controlText: item.controlText,
          purpose: item.purpose,
          guidance: item.guidance,
          otherInformation: item.otherInformation,
          category: item.category,
          isStandardControl: item.isStandardControl ?? false,
          implemented: item.implemented ?? false,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
      });
      created++;
    } else {
      // Upsert (reference/full scope - can update existing)
      // IMPORTANT: Preserve selectedForRiskAssessment if control is linked to risks
      const existing = await prisma.control.findUnique({
        where: { code: item.code as string },
        include: {
          riskControls: true,
        },
      });
      
      // If control exists and is linked to risks, preserve selectedForRiskAssessment
      const preserveRiskAssessment = existing && existing.riskControls.length > 0 
        ? existing.selectedForRiskAssessment 
        : (item.selectedForRiskAssessment ?? false);
      
      await prisma.control.upsert({
        where: { code: item.code as string },
        update: {
          // Don't update code since it's the unique identifier
          title: item.title,
          description: item.description,
          // Preserve selectedForRiskAssessment if control is linked to risks
          selectedForRiskAssessment: preserveRiskAssessment,
          selectedForContractualObligation: item.selectedForContractualObligation ?? false,
          selectedForLegalRequirement: item.selectedForLegalRequirement ?? false,
          selectedForBusinessRequirement: item.selectedForBusinessRequirement ?? false,
          justification: item.justification,
          controlText: item.controlText,
          purpose: item.purpose,
          guidance: item.guidance,
          otherInformation: item.otherInformation,
          category: item.category,
          isStandardControl: item.isStandardControl ?? false,
          implemented: item.implemented ?? false,
          updatedAt: new Date(),
        },
        create: {
          id: item.id,
          code: item.code,
          title: item.title,
          description: item.description,
          selectedForRiskAssessment: item.selectedForRiskAssessment ?? false,
          selectedForContractualObligation: item.selectedForContractualObligation ?? false,
          selectedForLegalRequirement: item.selectedForLegalRequirement ?? false,
          selectedForBusinessRequirement: item.selectedForBusinessRequirement ?? false,
          justification: item.justification,
          controlText: item.controlText,
          purpose: item.purpose,
          guidance: item.guidance,
          otherInformation: item.otherInformation,
          category: item.category,
          isStandardControl: item.isStandardControl ?? false,
          implemented: item.implemented ?? false,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
      });
      created++;
    }
  }
  if (createOnly && skipped > 0) {
    console.log(`✓ Seeded ${created} controls (${skipped} already existed, skipped)`);
  } else {
    console.log(`✓ Seeded ${created} controls`);
  }
}

/**
 * Seed Documents
 */
async function seedDocuments(data: Record<string, unknown>[]) {
  if (!data || data.length === 0) return;

  // Create a default system user if it doesn't exist (Documents require ownerUserId)
  // Use a specific system user ID that won't interfere with real users
  const systemUserId = '00000000-0000-0000-0000-000000000000';
  let defaultUserId: string;
  
  const systemUser = await prisma.user.findUnique({
    where: { id: systemUserId },
  });
  
  if (!systemUser) {
    // Create a default system user with STAFF role (not ADMIN) so first real user becomes admin
    const defaultUser = await prisma.user.create({
      data: {
        id: systemUserId,
        displayName: 'System User',
        email: 'system@localhost',
        entraObjectId: 'system-user',
        role: 'STAFF', // Use STAFF role so first real user becomes admin
        updatedAt: new Date(),
      },
    });
    defaultUserId = defaultUser.id;
  } else {
    defaultUserId = systemUser.id;
  }

  console.log(`Seeding ${data.length} documents...`);
  for (const item of data) {
    // Check if owner user exists, use default if not (since users aren't in seed data)
    let ownerUserId = defaultUserId;
    if (item.ownerUserId) {
      const userExists = await prisma.user.findUnique({
        where: { id: item.ownerUserId },
      });
      ownerUserId = userExists ? item.ownerUserId : defaultUserId;
    }

    await prisma.document.upsert({
      where: { id: item.id },
      update: {
        title: item.title,
        type: item.type,
        storageLocation: item.storageLocation,
        sharePointSiteId: item.sharePointSiteId,
        sharePointDriveId: item.sharePointDriveId,
        sharePointItemId: item.sharePointItemId,
        confluenceSpaceKey: item.confluenceSpaceKey,
        confluencePageId: item.confluencePageId,
        version: item.version,
        status: item.status,
        ownerUserId: ownerUserId,
        lastReviewDate: item.lastReviewDate ? new Date(item.lastReviewDate) : null,
        nextReviewDate: item.nextReviewDate ? new Date(item.nextReviewDate) : null,
        requiresAcknowledgement: item.requiresAcknowledgement ?? false,
        lastChangedDate: item.lastChangedDate ? new Date(item.lastChangedDate) : null,
        documentUrl: item.documentUrl,
        updatedAt: new Date(),
      },
      create: {
        id: item.id,
        title: item.title,
        type: item.type,
        storageLocation: item.storageLocation,
        sharePointSiteId: item.sharePointSiteId,
        sharePointDriveId: item.sharePointDriveId,
        sharePointItemId: item.sharePointItemId,
        confluenceSpaceKey: item.confluenceSpaceKey,
        confluencePageId: item.confluencePageId,
        version: item.version,
        status: item.status,
        ownerUserId: ownerUserId,
        lastReviewDate: item.lastReviewDate ? new Date(item.lastReviewDate) : null,
        nextReviewDate: item.nextReviewDate ? new Date(item.nextReviewDate) : null,
        requiresAcknowledgement: item.requiresAcknowledgement ?? false,
        lastChangedDate: item.lastChangedDate ? new Date(item.lastChangedDate) : null,
        documentUrl: item.documentUrl,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      },
    });
  }
  console.log(`✓ Seeded ${data.length} documents`);
}

/**
 * Seed Interested Parties
 */
async function seedInterestedParties(data: Record<string, unknown>[], createOnly: boolean = false) {
  if (!data || data.length === 0) return;

  console.log(`Seeding ${data.length} interested parties...`);
  let created = 0;
  let skipped = 0;
  
  for (const item of data) {
    if (createOnly) {
      // Only create if missing (system scope - preserve manual changes)
      const existing = await prisma.interestedParty.findUnique({
        where: { id: item.id },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.interestedParty.create({
        data: {
          id: item.id,
          name: item.name,
          group: item.group,
          description: item.description,
          dateAdded: item.dateAdded ? new Date(item.dateAdded) : null,
          requirements: item.requirements,
          addressedThroughISMS: item.addressedThroughISMS,
          howAddressedThroughISMS: item.howAddressedThroughISMS,
          sourceLink: item.sourceLink,
          keyProductsServices: item.keyProductsServices,
          ourObligations: item.ourObligations,
          theirObligations: item.theirObligations,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
      });
      created++;
    } else {
      // Upsert (reference/full scope - can update existing)
      await prisma.interestedParty.upsert({
        where: { id: item.id },
        update: {
          name: item.name,
          group: item.group,
          description: item.description,
          dateAdded: item.dateAdded ? new Date(item.dateAdded) : null,
          requirements: item.requirements,
          addressedThroughISMS: item.addressedThroughISMS,
          howAddressedThroughISMS: item.howAddressedThroughISMS,
          sourceLink: item.sourceLink,
          keyProductsServices: item.keyProductsServices,
          ourObligations: item.ourObligations,
          theirObligations: item.theirObligations,
          updatedAt: new Date(),
        },
        create: {
          id: item.id,
          name: item.name,
          group: item.group,
          description: item.description,
          dateAdded: item.dateAdded ? new Date(item.dateAdded) : null,
          requirements: item.requirements,
          addressedThroughISMS: item.addressedThroughISMS,
          howAddressedThroughISMS: item.howAddressedThroughISMS,
          sourceLink: item.sourceLink,
          keyProductsServices: item.keyProductsServices,
          ourObligations: item.ourObligations,
          theirObligations: item.theirObligations,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
      });
      created++;
    }
  }
  if (createOnly && skipped > 0) {
    console.log(`✓ Seeded ${created} interested parties (${skipped} already existed, skipped)`);
  } else {
    console.log(`✓ Seeded ${created} interested parties`);
  }
}

/**
 * Seed Legislation
 */
async function seedLegislation(data: Record<string, unknown>[], createOnly: boolean = false) {
  if (!data || data.length === 0) return;

  console.log(`Seeding ${data.length} legislation records...`);
  let created = 0;
  let skipped = 0;
  
  for (const item of data) {
    if (createOnly) {
      // Only create if missing (system scope - preserve manual changes)
      const existing = await prisma.legislation.findUnique({
        where: { id: item.id },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.legislation.create({
        data: {
          id: item.id,
          dateAdded: item.dateAdded ? new Date(item.dateAdded) : null,
          interestedParty: item.interestedParty,
          actRegulationRequirement: item.actRegulationRequirement,
          description: item.description,
          riskOfNonCompliance: item.riskOfNonCompliance,
          howComplianceAchieved: item.howComplianceAchieved,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
      });
      created++;
    } else {
      // Upsert (reference/full scope - can update existing)
      await prisma.legislation.upsert({
        where: { id: item.id },
        update: {
          dateAdded: item.dateAdded ? new Date(item.dateAdded) : null,
          interestedParty: item.interestedParty,
          actRegulationRequirement: item.actRegulationRequirement,
          description: item.description,
          riskOfNonCompliance: item.riskOfNonCompliance,
          howComplianceAchieved: item.howComplianceAchieved,
          updatedAt: new Date(),
        },
        create: {
          id: item.id,
          dateAdded: item.dateAdded ? new Date(item.dateAdded) : null,
          interestedParty: item.interestedParty,
          actRegulationRequirement: item.actRegulationRequirement,
          description: item.description,
          riskOfNonCompliance: item.riskOfNonCompliance,
          howComplianceAchieved: item.howComplianceAchieved,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
      });
      created++;
    }
  }
  if (createOnly && skipped > 0) {
    console.log(`✓ Seeded ${created} legislation records (${skipped} already existed, skipped)`);
  } else {
    console.log(`✓ Seeded ${created} legislation records`);
  }
}

/**
 * Seed Risk-Control junction table
 */
async function seedRiskControls(data: Record<string, unknown>[]) {
  if (!data || data.length === 0) return;

  console.log(`Seeding ${data.length} risk-control links...`);
  for (const item of data) {
    await prisma.riskControl.upsert({
      where: {
        riskId_controlId: {
          riskId: item.riskId,
          controlId: item.controlId,
        },
      },
      update: {},
      create: {
        riskId: item.riskId,
        controlId: item.controlId,
      },
    });
  }
  console.log(`✓ Seeded ${data.length} risk-control links`);
}

/**
 * Seed Document-Risk junction table
 */
async function seedDocumentRisks(data: Record<string, unknown>[]) {
  if (!data || data.length === 0) return;

  console.log(`Seeding ${data.length} document-risk links...`);
  for (const item of data) {
    await prisma.documentRisk.upsert({
      where: {
        documentId_riskId: {
          documentId: item.documentId,
          riskId: item.riskId,
        },
      },
      update: {},
      create: {
        documentId: item.documentId,
        riskId: item.riskId,
      },
    });
  }
  console.log(`✓ Seeded ${data.length} document-risk links`);
}

/**
 * Seed Document-Control junction table
 */
async function seedDocumentControls(data: Record<string, unknown>[]) {
  if (!data || data.length === 0) return;

  console.log(`Seeding ${data.length} document-control links...`);
  for (const item of data) {
    await prisma.documentControl.upsert({
      where: {
        documentId_controlId: {
          documentId: item.documentId,
          controlId: item.controlId,
        },
      },
      update: {},
      create: {
        documentId: item.documentId,
        controlId: item.controlId,
      },
    });
  }
  console.log(`✓ Seeded ${data.length} document-control links`);
}

/**
 * Seed Legislation-Risk junction table
 */
async function seedLegislationRisks(data: Record<string, unknown>[]) {
  if (!data || data.length === 0) return;

  console.log(`Seeding ${data.length} legislation-risk links...`);
  for (const item of data) {
    await prisma.legislationRisk.upsert({
      where: {
        legislationId_riskId: {
          legislationId: item.legislationId,
          riskId: item.riskId,
        },
      },
      update: {},
      create: {
        legislationId: item.legislationId,
        riskId: item.riskId,
      },
    });
  }
  console.log(`✓ Seeded ${data.length} legislation-risk links`);
}

/**
 * Main seed function
 */
async function main() {
  const seedScope = (process.env.SEED_SCOPE || 'none') as SeedScope;
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Skip seeding in production unless explicitly enabled
  if (nodeEnv === 'production' && seedScope === 'none') {
    console.log('Skipping seed in production environment (set SEED_SCOPE to enable)');
    return;
  }

  if (seedScope === 'none') {
    console.log('SEED_SCOPE is set to "none", skipping seed');
    return;
  }

  console.log(`Starting seed with scope: ${seedScope} (NODE_ENV: ${nodeEnv})`);

  try {
    const seedData = loadSeedData(seedScope);
    const createOnly = seedScope === 'system'; // Only create missing records, don't update existing

    // Seed reference data (for 'system', 'reference', and 'full')
    // Seed classifications first (needed by assets)
    if (seedData.classifications) {
      await seedClassifications(seedData.classifications, createOnly);
    }
    if (seedData.assetCategories) {
      await seedAssetCategories(seedData.assetCategories, createOnly);
    }
    if (seedData.controls) {
      await seedControls(seedData.controls, createOnly);
      
      // Compute embeddings for controls after seeding
      // This is idempotent - only processes controls with NULL embeddings
      // Safe to re-run on existing infrastructure to populate missing embeddings
      console.log('Computing embeddings for controls...');
      try {
        const embeddingStats = await backfillControlEmbeddings(20, 2, false);
        console.log(
          `✓ Control embeddings computed: ${embeddingStats.succeeded} succeeded, ${embeddingStats.failed} failed (${embeddingStats.processed} total)`,
        );
      } catch (error) {
        // Embedding computation is best-effort - don't fail the seed if it errors
        console.warn(
          '⚠ Control embedding computation failed (non-fatal):',
          error instanceof Error ? error.message : String(error),
        );
        console.warn('⚠ You can manually run: npm run backfill-control-embeddings');
      }
      
      // For system scope, update control applicability to ensure selectedForRiskAssessment
      // is correctly set based on existing risk-control associations
      if (createOnly) {
        console.log('Updating control applicability based on risk associations...');
        try {
          const { updateControlApplicability } = await import('../src/services/riskService');
          await updateControlApplicability();
          console.log('✓ Control applicability updated');
        } catch (error) {
          console.warn(
            '⚠ Failed to update control applicability (non-fatal):',
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    }
    if (seedData.legislation) {
      await seedLegislation(seedData.legislation, createOnly);
    }
    if (seedData.interestedParties) {
      await seedInterestedParties(seedData.interestedParties, createOnly);
    }

    // Seed full data (only for 'full' scope)
    if (seedScope === 'full') {
      if (seedData.assets) {
        await seedAssets(seedData.assets);
      }
      if (seedData.risks) {
        await seedRisks(seedData.risks);
      }
      if (seedData.documents) {
        await seedDocuments(seedData.documents);
      }
      if (seedData.riskControls) {
        await seedRiskControls(seedData.riskControls);
      }
      if (seedData.documentRisks) {
        await seedDocumentRisks(seedData.documentRisks);
      }
      if (seedData.documentControls) {
        await seedDocumentControls(seedData.documentControls);
      }
      if (seedData.legislationRisks) {
        await seedLegislationRisks(seedData.legislationRisks);
      }
    }

    console.log('✓ Seed completed successfully');
  } catch (error) {
    console.error('✗ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Export default main function for Prisma seed
export default main;

// Execute if run directly
if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

