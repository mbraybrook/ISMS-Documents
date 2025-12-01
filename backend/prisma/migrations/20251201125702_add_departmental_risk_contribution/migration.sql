-- AlterTable: Add department to User
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "entraObjectId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "department" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("id", "displayName", "email", "entraObjectId", "role", "createdAt", "updatedAt")
SELECT "id", "displayName", "email", "entraObjectId", "role", "createdAt", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;

-- CreateIndex for User.department
CREATE INDEX "User_department_idx" ON "User"("department");

-- AlterTable: Add new fields to Risk
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Risk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dateAdded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riskCategory" TEXT,
    "riskNature" TEXT,
    "ownerUserId" TEXT,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "wizardData" TEXT,
    "rejectionReason" TEXT,
    "mergedIntoRiskId" TEXT,
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
INSERT INTO "new_Risk" ("id", "title", "description", "dateAdded", "riskCategory", "riskNature", "ownerUserId", "assetCategory", "assetId", "assetCategoryId", "interestedPartyId", "threatDescription", "archived", "expiryDate", "lastReviewDate", "nextReviewDate", "confidentialityScore", "integrityScore", "availabilityScore", "riskScore", "likelihood", "calculatedScore", "initialRiskTreatmentCategory", "mitigatedConfidentialityScore", "mitigatedIntegrityScore", "mitigatedAvailabilityScore", "mitigatedRiskScore", "mitigatedLikelihood", "mitigatedScore", "mitigationImplemented", "mitigationDescription", "residualRiskTreatmentCategory", "annexAControlsRaw", "createdAt", "updatedAt", "status")
SELECT "id", "title", "description", "dateAdded", "riskCategory", "riskNature", "ownerUserId", "assetCategory", "assetId", "assetCategoryId", "interestedPartyId", "threatDescription", "archived", "expiryDate", "lastReviewDate", "nextReviewDate", "confidentialityScore", "integrityScore", "availabilityScore", "riskScore", "likelihood", "calculatedScore", "initialRiskTreatmentCategory", "mitigatedConfidentialityScore", "mitigatedIntegrityScore", "mitigatedAvailabilityScore", "mitigatedRiskScore", "mitigatedLikelihood", "mitigatedScore", "mitigationImplemented", "mitigationDescription", "residualRiskTreatmentCategory", "annexAControlsRaw", "createdAt", "updatedAt", 'ACTIVE' FROM "Risk";
DROP TABLE "Risk";
ALTER TABLE "new_Risk" RENAME TO "Risk";
PRAGMA foreign_keys=ON;

-- CreateIndexes for Risk
CREATE INDEX "Risk_department_idx" ON "Risk"("department");
CREATE INDEX "Risk_status_idx" ON "Risk"("status");

