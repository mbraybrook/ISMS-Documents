-- DropIndex
DROP INDEX IF EXISTS "Risk_externalId_idx";

-- AlterTable
-- Note: SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Risk" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
INSERT INTO "new_Risk" ("id", "title", "description", "dateAdded", "riskCategory", "riskNature", "ownerUserId", "assetCategory", "assetId", "assetCategoryId", "interestedPartyId", "threatDescription", "archived", "expiryDate", "lastReviewDate", "nextReviewDate", "confidentialityScore", "integrityScore", "availabilityScore", "riskScore", "likelihood", "calculatedScore", "initialRiskTreatmentCategory", "mitigatedConfidentialityScore", "mitigatedIntegrityScore", "mitigatedAvailabilityScore", "mitigatedRiskScore", "mitigatedLikelihood", "mitigatedScore", "mitigationImplemented", "mitigationDescription", "residualRiskTreatmentCategory", "annexAControlsRaw", "createdAt", "updatedAt")
SELECT "id", "title", "description", "dateAdded", "riskCategory", "riskNature", "ownerUserId", "assetCategory", "assetId", "assetCategoryId", "interestedPartyId", "threatDescription", "archived", "expiryDate", "lastReviewDate", "nextReviewDate", "confidentialityScore", "integrityScore", "availabilityScore", "riskScore", "likelihood", "calculatedScore", "initialRiskTreatmentCategory", "mitigatedConfidentialityScore", "mitigatedIntegrityScore", "mitigatedAvailabilityScore", "mitigatedRiskScore", "mitigatedLikelihood", "mitigatedScore", "mitigationImplemented", "mitigationDescription", "residualRiskTreatmentCategory", "annexAControlsRaw", "createdAt", "updatedAt" FROM "Risk";
DROP TABLE "Risk";
ALTER TABLE "new_Risk" RENAME TO "Risk";
PRAGMA foreign_keys=ON;

-- Recreate indexes (excluding externalId index)
CREATE INDEX "Risk_interestedPartyId_idx" ON "Risk"("interestedPartyId");
CREATE INDEX "Risk_assetCategoryId_idx" ON "Risk"("assetCategoryId");
CREATE INDEX "Risk_assetId_idx" ON "Risk"("assetId");
CREATE INDEX "Risk_mitigationImplemented_idx" ON "Risk"("mitigationImplemented");
CREATE INDEX "Risk_residualRiskTreatmentCategory_idx" ON "Risk"("residualRiskTreatmentCategory");
CREATE INDEX "Risk_initialRiskTreatmentCategory_idx" ON "Risk"("initialRiskTreatmentCategory");
CREATE INDEX "Risk_ownerUserId_idx" ON "Risk"("ownerUserId");
CREATE INDEX "Risk_nextReviewDate_idx" ON "Risk"("nextReviewDate");
CREATE INDEX "Risk_expiryDate_idx" ON "Risk"("expiryDate");
CREATE INDEX "Risk_archived_idx" ON "Risk"("archived");
CREATE INDEX "Risk_riskNature_idx" ON "Risk"("riskNature");
CREATE INDEX "Risk_riskCategory_idx" ON "Risk"("riskCategory");
CREATE INDEX "Risk_calculatedScore_idx" ON "Risk"("calculatedScore");

