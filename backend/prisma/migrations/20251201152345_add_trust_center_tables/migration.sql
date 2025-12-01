-- CreateTable
CREATE TABLE "ExternalUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "passwordResetToken" TEXT,
    "passwordResetExpires" DATETIME,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "termsAcceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TrustDocSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "visibilityLevel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sharePointUrl" TEXT,
    "sharePointSiteId" TEXT,
    "sharePointDriveId" TEXT,
    "sharePointItemId" TEXT,
    "publicDescription" TEXT,
    "displayOrder" INTEGER,
    "requiresNda" BOOLEAN NOT NULL DEFAULT false,
    "maxFileSizeMB" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrustDocSetting_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrustDownload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalUserId" TEXT,
    "docId" TEXT NOT NULL,
    "downloadToken" TEXT,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustDownload_externalUserId_fkey" FOREIGN KEY ("externalUserId") REFERENCES "ExternalUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrustDownload_docId_fkey" FOREIGN KEY ("docId") REFERENCES "TrustDocSetting" ("documentId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrustAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "performedByUserId" TEXT,
    "performedByExternalUserId" TEXT,
    "targetUserId" TEXT,
    "targetDocumentId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustAuditLog_performedByExternalUserId_fkey" FOREIGN KEY ("performedByExternalUserId") REFERENCES "ExternalUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrustAuditLog_targetDocumentId_fkey" FOREIGN KEY ("targetDocumentId") REFERENCES "TrustDocSetting" ("documentId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalUser_email_key" ON "ExternalUser"("email");

-- CreateIndex
CREATE INDEX "ExternalUser_email_idx" ON "ExternalUser"("email");

-- CreateIndex
CREATE INDEX "ExternalUser_isApproved_idx" ON "ExternalUser"("isApproved");

-- CreateIndex
CREATE UNIQUE INDEX "TrustDocSetting_documentId_key" ON "TrustDocSetting"("documentId");

-- CreateIndex
CREATE INDEX "TrustDocSetting_visibilityLevel_idx" ON "TrustDocSetting"("visibilityLevel");

-- CreateIndex
CREATE INDEX "TrustDocSetting_category_idx" ON "TrustDocSetting"("category");

-- CreateIndex
CREATE INDEX "TrustDocSetting_displayOrder_idx" ON "TrustDocSetting"("displayOrder");

-- CreateIndex
CREATE INDEX "TrustDownload_externalUserId_idx" ON "TrustDownload"("externalUserId");

-- CreateIndex
CREATE INDEX "TrustDownload_docId_idx" ON "TrustDownload"("docId");

-- CreateIndex
CREATE INDEX "TrustDownload_timestamp_idx" ON "TrustDownload"("timestamp");

-- CreateIndex
CREATE INDEX "TrustAuditLog_action_idx" ON "TrustAuditLog"("action");

-- CreateIndex
CREATE INDEX "TrustAuditLog_timestamp_idx" ON "TrustAuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "TrustAuditLog_performedByUserId_idx" ON "TrustAuditLog"("performedByUserId");

-- CreateIndex
CREATE INDEX "TrustAuditLog_targetDocumentId_idx" ON "TrustAuditLog"("targetDocumentId");

