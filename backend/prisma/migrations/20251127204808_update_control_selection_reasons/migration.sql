/*
  Warnings:

  - You are about to drop the column `applicabilitySource` on the `Control` table. All the data in the column will be lost.
  - You are about to drop the column `isApplicable` on the `Control` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Control" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "selectedForRiskAssessment" BOOLEAN NOT NULL DEFAULT false,
    "selectedForContractualObligation" BOOLEAN NOT NULL DEFAULT false,
    "selectedForLegalRequirement" BOOLEAN NOT NULL DEFAULT false,
    "selectedForBusinessRequirement" BOOLEAN NOT NULL DEFAULT false,
    "justification" TEXT,
    "controlText" TEXT,
    "purpose" TEXT,
    "guidance" TEXT,
    "otherInformation" TEXT,
    "category" TEXT,
    "isStandardControl" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Control" ("category", "code", "controlText", "createdAt", "description", "guidance", "id", "isStandardControl", "justification", "otherInformation", "purpose", "title", "updatedAt") SELECT "category", "code", "controlText", "createdAt", "description", "guidance", "id", "isStandardControl", "justification", "otherInformation", "purpose", "title", "updatedAt" FROM "Control";
DROP TABLE "Control";
ALTER TABLE "new_Control" RENAME TO "Control";
CREATE UNIQUE INDEX "Control_code_key" ON "Control"("code");
CREATE INDEX "Control_code_idx" ON "Control"("code");
CREATE INDEX "Control_category_idx" ON "Control"("category");
CREATE INDEX "Control_isStandardControl_idx" ON "Control"("isStandardControl");
CREATE INDEX "Control_selectedForRiskAssessment_idx" ON "Control"("selectedForRiskAssessment");
CREATE INDEX "Control_selectedForContractualObligation_idx" ON "Control"("selectedForContractualObligation");
CREATE INDEX "Control_selectedForLegalRequirement_idx" ON "Control"("selectedForLegalRequirement");
CREATE INDEX "Control_selectedForBusinessRequirement_idx" ON "Control"("selectedForBusinessRequirement");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
