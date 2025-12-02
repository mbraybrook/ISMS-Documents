-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Risk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dateAdded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riskType" TEXT,
    "ownerUserId" TEXT,
    "assetCategory" TEXT,
    "interestedParty" TEXT,
    "threatDescription" TEXT,
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
    "residualRiskTreatmentCategory" TEXT,
    "annexAControlsRaw" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Risk_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Risk" ("annexAControlsRaw", "availabilityScore", "calculatedScore", "confidentialityScore", "createdAt", "description", "externalId", "id", "integrityScore", "likelihood", "title", "updatedAt") SELECT "annexAControlsRaw", "availabilityScore", "calculatedScore", "confidentialityScore", "createdAt", "description", "externalId", "id", "integrityScore", "likelihood", "title", "updatedAt" FROM "Risk";
DROP TABLE "Risk";
ALTER TABLE "new_Risk" RENAME TO "Risk";
CREATE INDEX "Risk_calculatedScore_idx" ON "Risk"("calculatedScore");
CREATE INDEX "Risk_externalId_idx" ON "Risk"("externalId");
CREATE INDEX "Risk_riskType_idx" ON "Risk"("riskType");
CREATE INDEX "Risk_ownerUserId_idx" ON "Risk"("ownerUserId");
CREATE INDEX "Risk_initialRiskTreatmentCategory_idx" ON "Risk"("initialRiskTreatmentCategory");
CREATE INDEX "Risk_residualRiskTreatmentCategory_idx" ON "Risk"("residualRiskTreatmentCategory");
CREATE INDEX "Risk_mitigationImplemented_idx" ON "Risk"("mitigationImplemented");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
