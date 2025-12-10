-- CreateTable
CREATE TABLE "DocumentVersionHistory" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "version" TEXT NOT NULL,
    "notes" TEXT,
    "sharePointSiteId" TEXT,
    "sharePointDriveId" TEXT,
    "sharePointItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "DocumentVersionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentVersionHistory_documentId_idx" ON "DocumentVersionHistory"("documentId");

-- CreateIndex
CREATE INDEX "DocumentVersionHistory_version_idx" ON "DocumentVersionHistory"("version");

-- CreateIndex
CREATE INDEX "DocumentVersionHistory_sharePointSiteId_sharePointDriveId_sharePointItemId_idx" ON "DocumentVersionHistory"("sharePointSiteId", "sharePointDriveId", "sharePointItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersionHistory_documentId_version_key" ON "DocumentVersionHistory"("documentId", "version");

-- AddForeignKey
ALTER TABLE "DocumentVersionHistory" ADD CONSTRAINT "DocumentVersionHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;


