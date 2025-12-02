-- CreateTable
CREATE TABLE "InterestedParty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "group" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "InterestedParty_name_key" ON "InterestedParty"("name");

-- CreateIndex
CREATE INDEX "InterestedParty_name_idx" ON "InterestedParty"("name");

-- CreateIndex
CREATE INDEX "InterestedParty_group_idx" ON "InterestedParty"("group");

-- Step 1: Create a default "Unspecified" interested party for null/empty values
-- Using a simple UUID-like format for SQLite compatibility
INSERT INTO "InterestedParty" ("id", "name", "group", "description", "createdAt", "updatedAt")
SELECT 
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    'Unspecified',
    NULL,
    'Default interested party for risks without a specified party',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "InterestedParty" WHERE "name" = 'Unspecified');

-- Step 2: Create InterestedParty records for all unique non-null interestedParty values from Risk table
-- Use a subquery to get distinct names first, then insert them
INSERT INTO "InterestedParty" ("id", "name", "group", "description", "createdAt", "updatedAt")
SELECT 
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) as id,
    distinct_name as name,
    NULL as "group",
    NULL as description,
    CURRENT_TIMESTAMP as "createdAt",
    CURRENT_TIMESTAMP as "updatedAt"
FROM (
    SELECT DISTINCT "interestedParty" as distinct_name
    FROM "Risk"
    WHERE "interestedParty" IS NOT NULL 
      AND "interestedParty" != ''
      AND "interestedParty" NOT IN (SELECT "name" FROM "InterestedParty")
);

-- Step 3: Add interestedPartyId column (nullable initially)
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Risk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dateAdded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riskCategory" TEXT,
    "riskNature" TEXT,
    "ownerUserId" TEXT,
    "assetCategory" TEXT,
    "assetId" TEXT,
    "assetCategoryId" TEXT,
    "interestedPartyId" TEXT,
    "threatDescription" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "expiryDate" DATETIME,
    "lastReviewDate" DATETIME,
    "nextReviewDate" DATETIME,
    "confidentialityScore" INTEGER NOT NULL DEFAULT 1,
    "integrityScore" INTEGER NOT NULL DEFAULT 1,
    "availabilityScore" INTEGER NOT NULL DEFAULT 1,
    "riskScore" INTEGER,
    "likelihood" INTEGER NOT NULL DEFAULT 1,
    "calculatedScore" INTEGER NOT NULL,
    "initialRiskTreatmentCategory" TEXT,
    "mitigatedConfidentialityScore" INTEGER,
    "mitigatedIntegrityScore" INTEGER,
    "mitigatedAvailabilityScore" INTEGER,
    "mitigatedRiskScore" INTEGER,
    "mitigatedLikelihood" INTEGER,
    "mitigatedScore" INTEGER,
    "mitigationImplemented" BOOLEAN NOT NULL DEFAULT false,
    "mitigationDescription" TEXT,
    "residualRiskTreatmentCategory" TEXT,
    "annexAControlsRaw" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Risk_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Risk_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Risk_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "AssetCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Risk_interestedPartyId_fkey" FOREIGN KEY ("interestedPartyId") REFERENCES "InterestedParty" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Copy data from old table, linking to InterestedParty
INSERT INTO "new_Risk" SELECT 
    "id",
    "externalId",
    "title",
    "description",
    "dateAdded",
    "riskCategory",
    "riskNature",
    "ownerUserId",
    "assetCategory",
    "assetId",
    "assetCategoryId",
    COALESCE(
        (SELECT "id" FROM "InterestedParty" WHERE "name" = "Risk"."interestedParty" LIMIT 1),
        (SELECT "id" FROM "InterestedParty" WHERE "name" = 'Unspecified' LIMIT 1)
    ) as "interestedPartyId",
    "threatDescription",
    "archived",
    "expiryDate",
    "lastReviewDate",
    "nextReviewDate",
    "confidentialityScore",
    "integrityScore",
    "availabilityScore",
    "riskScore",
    "likelihood",
    "calculatedScore",
    "initialRiskTreatmentCategory",
    "mitigatedConfidentialityScore",
    "mitigatedIntegrityScore",
    "mitigatedAvailabilityScore",
    "mitigatedRiskScore",
    "mitigatedLikelihood",
    "mitigatedScore",
    "mitigationImplemented",
    "mitigationDescription",
    "residualRiskTreatmentCategory",
    "annexAControlsRaw",
    "createdAt",
    "updatedAt"
FROM "Risk";

DROP TABLE "Risk";
ALTER TABLE "new_Risk" RENAME TO "Risk";

-- Step 4: Make interestedPartyId NOT NULL
-- We need to recreate the table again to make the column NOT NULL
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Risk2" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dateAdded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riskCategory" TEXT,
    "riskNature" TEXT,
    "ownerUserId" TEXT,
    "assetCategory" TEXT,
    "assetId" TEXT,
    "assetCategoryId" TEXT,
    "interestedPartyId" TEXT NOT NULL,
    "threatDescription" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "expiryDate" DATETIME,
    "lastReviewDate" DATETIME,
    "nextReviewDate" DATETIME,
    "confidentialityScore" INTEGER NOT NULL DEFAULT 1,
    "integrityScore" INTEGER NOT NULL DEFAULT 1,
    "availabilityScore" INTEGER NOT NULL DEFAULT 1,
    "riskScore" INTEGER,
    "likelihood" INTEGER NOT NULL DEFAULT 1,
    "calculatedScore" INTEGER NOT NULL,
    "initialRiskTreatmentCategory" TEXT,
    "mitigatedConfidentialityScore" INTEGER,
    "mitigatedIntegrityScore" INTEGER,
    "mitigatedAvailabilityScore" INTEGER,
    "mitigatedRiskScore" INTEGER,
    "mitigatedLikelihood" INTEGER,
    "mitigatedScore" INTEGER,
    "mitigationImplemented" BOOLEAN NOT NULL DEFAULT false,
    "mitigationDescription" TEXT,
    "residualRiskTreatmentCategory" TEXT,
    "annexAControlsRaw" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Risk_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Risk_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Risk_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "AssetCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Risk_interestedPartyId_fkey" FOREIGN KEY ("interestedPartyId") REFERENCES "InterestedParty" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Risk2" SELECT * FROM "Risk";
DROP TABLE "Risk";
ALTER TABLE "new_Risk2" RENAME TO "Risk";

-- Recreate indexes
CREATE INDEX "Risk_calculatedScore_idx" ON "Risk"("calculatedScore");
CREATE INDEX "Risk_externalId_idx" ON "Risk"("externalId");
CREATE INDEX "Risk_riskCategory_idx" ON "Risk"("riskCategory");
CREATE INDEX "Risk_riskNature_idx" ON "Risk"("riskNature");
CREATE INDEX "Risk_archived_idx" ON "Risk"("archived");
CREATE INDEX "Risk_expiryDate_idx" ON "Risk"("expiryDate");
CREATE INDEX "Risk_nextReviewDate_idx" ON "Risk"("nextReviewDate");
CREATE INDEX "Risk_ownerUserId_idx" ON "Risk"("ownerUserId");
CREATE INDEX "Risk_initialRiskTreatmentCategory_idx" ON "Risk"("initialRiskTreatmentCategory");
CREATE INDEX "Risk_residualRiskTreatmentCategory_idx" ON "Risk"("residualRiskTreatmentCategory");
CREATE INDEX "Risk_mitigationImplemented_idx" ON "Risk"("mitigationImplemented");
CREATE INDEX "Risk_assetId_idx" ON "Risk"("assetId");
CREATE INDEX "Risk_assetCategoryId_idx" ON "Risk"("assetCategoryId");
CREATE INDEX "Risk_interestedPartyId_idx" ON "Risk"("interestedPartyId");

PRAGMA foreign_keys=ON;

