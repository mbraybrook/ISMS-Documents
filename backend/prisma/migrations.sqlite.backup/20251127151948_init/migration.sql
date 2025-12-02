-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "entraObjectId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Document" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "completedDate" DATETIME,
    "changeNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewTask_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewTask_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Acknowledgment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "acknowledgedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Acknowledgment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Acknowledgment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "confidentialityScore" INTEGER NOT NULL DEFAULT 1,
    "integrityScore" INTEGER NOT NULL DEFAULT 1,
    "availabilityScore" INTEGER NOT NULL DEFAULT 1,
    "likelihood" INTEGER NOT NULL DEFAULT 1,
    "calculatedScore" INTEGER NOT NULL,
    "annexAControlsRaw" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Control" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isApplicable" BOOLEAN NOT NULL DEFAULT false,
    "applicabilitySource" TEXT,
    "justification" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RiskControl" (
    "riskId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,

    PRIMARY KEY ("riskId", "controlId"),
    CONSTRAINT "RiskControl_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RiskControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentControl" (
    "documentId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,

    PRIMARY KEY ("documentId", "controlId"),
    CONSTRAINT "DocumentControl_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentRisk" (
    "documentId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,

    PRIMARY KEY ("documentId", "riskId"),
    CONSTRAINT "DocumentRisk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentRisk_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SoAExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generatedByUserId" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportFormat" TEXT NOT NULL,
    "filePath" TEXT,
    CONSTRAINT "SoAExport_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_entraObjectId_key" ON "User"("entraObjectId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_entraObjectId_idx" ON "User"("entraObjectId");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_ownerUserId_idx" ON "Document"("ownerUserId");

-- CreateIndex
CREATE INDEX "Document_nextReviewDate_idx" ON "Document"("nextReviewDate");

-- CreateIndex
CREATE INDEX "ReviewTask_documentId_idx" ON "ReviewTask"("documentId");

-- CreateIndex
CREATE INDEX "ReviewTask_reviewerUserId_idx" ON "ReviewTask"("reviewerUserId");

-- CreateIndex
CREATE INDEX "ReviewTask_dueDate_idx" ON "ReviewTask"("dueDate");

-- CreateIndex
CREATE INDEX "ReviewTask_status_idx" ON "ReviewTask"("status");

-- CreateIndex
CREATE INDEX "Acknowledgment_userId_idx" ON "Acknowledgment"("userId");

-- CreateIndex
CREATE INDEX "Acknowledgment_documentId_idx" ON "Acknowledgment"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Acknowledgment_userId_documentId_documentVersion_key" ON "Acknowledgment"("userId", "documentId", "documentVersion");

-- CreateIndex
CREATE INDEX "Risk_calculatedScore_idx" ON "Risk"("calculatedScore");

-- CreateIndex
CREATE INDEX "Risk_externalId_idx" ON "Risk"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Control_code_key" ON "Control"("code");

-- CreateIndex
CREATE INDEX "Control_code_idx" ON "Control"("code");

-- CreateIndex
CREATE INDEX "Control_isApplicable_idx" ON "Control"("isApplicable");

-- CreateIndex
CREATE INDEX "RiskControl_riskId_idx" ON "RiskControl"("riskId");

-- CreateIndex
CREATE INDEX "RiskControl_controlId_idx" ON "RiskControl"("controlId");

-- CreateIndex
CREATE INDEX "DocumentControl_documentId_idx" ON "DocumentControl"("documentId");

-- CreateIndex
CREATE INDEX "DocumentControl_controlId_idx" ON "DocumentControl"("controlId");

-- CreateIndex
CREATE INDEX "DocumentRisk_documentId_idx" ON "DocumentRisk"("documentId");

-- CreateIndex
CREATE INDEX "DocumentRisk_riskId_idx" ON "DocumentRisk"("riskId");

-- CreateIndex
CREATE INDEX "SoAExport_generatedByUserId_idx" ON "SoAExport"("generatedByUserId");

-- CreateIndex
CREATE INDEX "SoAExport_generatedAt_idx" ON "SoAExport"("generatedAt");
