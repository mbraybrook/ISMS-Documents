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
    "interestedParty" TEXT,
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
    CONSTRAINT "Risk_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "AssetCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Risk" ("id", "externalId", "title", "description", "dateAdded", "riskCategory", "riskNature", "ownerUserId", "assetCategory", "assetId", "assetCategoryId", "interestedParty", "threatDescription", "archived", "expiryDate", "lastReviewDate", "nextReviewDate", "confidentialityScore", "integrityScore", "availabilityScore", "riskScore", "likelihood", "calculatedScore", "initialRiskTreatmentCategory", "mitigatedConfidentialityScore", "mitigatedIntegrityScore", "mitigatedAvailabilityScore", "mitigatedRiskScore", "mitigatedLikelihood", "mitigatedScore", "mitigationImplemented", "mitigationDescription", "residualRiskTreatmentCategory", "annexAControlsRaw", "createdAt", "updatedAt")
SELECT "id", "externalId", "title", "description", "dateAdded", "riskType" as "riskCategory", NULL as "riskNature", "ownerUserId", "assetCategory", "assetId", "assetCategoryId", "interestedParty", "threatDescription", false as "archived", NULL as "expiryDate", NULL as "lastReviewDate", NULL as "nextReviewDate", "confidentialityScore", "integrityScore", "availabilityScore", "riskScore", "likelihood", "calculatedScore", "initialRiskTreatmentCategory", "mitigatedConfidentialityScore", "mitigatedIntegrityScore", "mitigatedAvailabilityScore", "mitigatedRiskScore", "mitigatedLikelihood", "mitigatedScore", "mitigationImplemented", "mitigationDescription", "residualRiskTreatmentCategory", "annexAControlsRaw", "createdAt", "updatedAt" FROM "Risk";
DROP TABLE "Risk";
ALTER TABLE "new_Risk" RENAME TO "Risk";
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

