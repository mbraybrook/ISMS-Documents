-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Control" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isApplicable" BOOLEAN NOT NULL DEFAULT false,
    "applicabilitySource" TEXT,
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
INSERT INTO "new_Control" ("applicabilitySource", "code", "createdAt", "description", "id", "isApplicable", "justification", "title", "updatedAt") SELECT "applicabilitySource", "code", "createdAt", "description", "id", "isApplicable", "justification", "title", "updatedAt" FROM "Control";
DROP TABLE "Control";
ALTER TABLE "new_Control" RENAME TO "Control";
CREATE UNIQUE INDEX "Control_code_key" ON "Control"("code");
CREATE INDEX "Control_code_idx" ON "Control"("code");
CREATE INDEX "Control_isApplicable_idx" ON "Control"("isApplicable");
CREATE INDEX "Control_category_idx" ON "Control"("category");
CREATE INDEX "Control_isStandardControl_idx" ON "Control"("isStandardControl");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
