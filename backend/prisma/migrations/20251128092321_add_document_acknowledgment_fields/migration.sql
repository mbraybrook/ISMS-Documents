-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storageLocation" TEXT NOT NULL,
    "sharePointSiteId" TEXT,
    "sharePointDriveId" TEXT,
    "sharePointItemId" TEXT,
    "confluenceSpaceKey" TEXT,
    "confluencePageId" TEXT,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "lastReviewDate" DATETIME,
    "nextReviewDate" DATETIME,
    "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "lastChangedDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("confluencePageId", "confluenceSpaceKey", "createdAt", "id", "lastReviewDate", "nextReviewDate", "ownerUserId", "sharePointDriveId", "sharePointItemId", "sharePointSiteId", "status", "storageLocation", "title", "type", "updatedAt", "version") SELECT "confluencePageId", "confluenceSpaceKey", "createdAt", "id", "lastReviewDate", "nextReviewDate", "ownerUserId", "sharePointDriveId", "sharePointItemId", "sharePointSiteId", "status", "storageLocation", "title", "type", "updatedAt", "version" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_type_idx" ON "Document"("type");
CREATE INDEX "Document_status_idx" ON "Document"("status");
CREATE INDEX "Document_ownerUserId_idx" ON "Document"("ownerUserId");
CREATE INDEX "Document_nextReviewDate_idx" ON "Document"("nextReviewDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill: Set requiresAcknowledgement = true for all POLICY documents
UPDATE "Document" SET "requiresAcknowledgement" = true WHERE "type" = 'POLICY';

-- Backfill: Set lastChangedDate = updatedAt for existing documents
UPDATE "Document" SET "lastChangedDate" = "updatedAt" WHERE "lastChangedDate" IS NULL;
