-- CreateTable
CREATE TABLE "Acknowledgment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Acknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "assetCategoryId" TEXT NOT NULL,
    "assetSubCategory" TEXT,
    "owner" TEXT NOT NULL,
    "primaryUser" TEXT,
    "location" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "nameSerialNo" TEXT,
    "cdeImpacting" BOOLEAN NOT NULL DEFAULT false,
    "classificationId" TEXT NOT NULL,
    "purpose" TEXT,
    "notes" TEXT,
    "cost" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classification" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Control" (
    "id" TEXT NOT NULL,
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
    "implemented" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
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
    "lastReviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "lastChangedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "documentUrl" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentControl" (
    "documentId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,

    CONSTRAINT "DocumentControl_pkey" PRIMARY KEY ("documentId","controlId")
);

-- CreateTable
CREATE TABLE "DocumentRisk" (
    "documentId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,

    CONSTRAINT "DocumentRisk_pkey" PRIMARY KEY ("documentId","riskId")
);

-- CreateTable
CREATE TABLE "InterestedParty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT,
    "description" TEXT,
    "dateAdded" TIMESTAMP(3),
    "requirements" TEXT,
    "addressedThroughISMS" BOOLEAN,
    "howAddressedThroughISMS" TEXT,
    "sourceLink" TEXT,
    "keyProductsServices" TEXT,
    "ourObligations" TEXT,
    "theirObligations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterestedParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Legislation" (
    "id" TEXT NOT NULL,
    "dateAdded" TIMESTAMP(3),
    "interestedParty" TEXT,
    "actRegulationRequirement" TEXT NOT NULL,
    "description" TEXT,
    "riskOfNonCompliance" TEXT,
    "howComplianceAchieved" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Legislation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTask" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "changeNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riskCategory" TEXT,
    "riskNature" TEXT,
    "ownerUserId" TEXT,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "wizardData" TEXT,
    "rejectionReason" TEXT,
    "mergedIntoRiskId" TEXT,
    "assetCategory" TEXT,
    "assetId" TEXT,
    "assetCategoryId" TEXT,
    "interestedPartyId" TEXT NOT NULL,
    "threatDescription" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "expiryDate" TIMESTAMP(3),
    "lastReviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskControl" (
    "riskId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,

    CONSTRAINT "RiskControl_pkey" PRIMARY KEY ("riskId","controlId")
);

-- CreateTable
CREATE TABLE "LegislationRisk" (
    "legislationId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,

    CONSTRAINT "LegislationRisk_pkey" PRIMARY KEY ("legislationId","riskId")
);

-- CreateTable
CREATE TABLE "SoAExport" (
    "id" TEXT NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportFormat" TEXT NOT NULL,
    "filePath" TEXT,

    CONSTRAINT "SoAExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "entraObjectId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "termsAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustDocSetting" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustDocSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustDownload" (
    "id" TEXT NOT NULL,
    "externalUserId" TEXT,
    "docId" TEXT NOT NULL,
    "downloadToken" TEXT,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustDownload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedByUserId" TEXT,
    "performedByExternalUserId" TEXT,
    "targetUserId" TEXT,
    "targetDocumentId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Acknowledgment_documentId_idx" ON "Acknowledgment"("documentId");

-- CreateIndex
CREATE INDEX "Acknowledgment_userId_idx" ON "Acknowledgment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Acknowledgment_userId_documentId_documentVersion_key" ON "Acknowledgment"("userId", "documentId", "documentVersion");

-- CreateIndex
CREATE INDEX "Asset_date_idx" ON "Asset"("date");

-- CreateIndex
CREATE INDEX "Asset_owner_idx" ON "Asset"("owner");

-- CreateIndex
CREATE INDEX "Asset_classificationId_idx" ON "Asset"("classificationId");

-- CreateIndex
CREATE INDEX "Asset_assetCategoryId_idx" ON "Asset"("assetCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_name_key" ON "AssetCategory"("name");

-- CreateIndex
CREATE INDEX "AssetCategory_name_idx" ON "AssetCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Classification_name_key" ON "Classification"("name");

-- CreateIndex
CREATE INDEX "Classification_name_idx" ON "Classification"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Control_code_key" ON "Control"("code");

-- CreateIndex
CREATE INDEX "Control_selectedForBusinessRequirement_idx" ON "Control"("selectedForBusinessRequirement");

-- CreateIndex
CREATE INDEX "Control_selectedForLegalRequirement_idx" ON "Control"("selectedForLegalRequirement");

-- CreateIndex
CREATE INDEX "Control_selectedForContractualObligation_idx" ON "Control"("selectedForContractualObligation");

-- CreateIndex
CREATE INDEX "Control_selectedForRiskAssessment_idx" ON "Control"("selectedForRiskAssessment");

-- CreateIndex
CREATE INDEX "Control_isStandardControl_idx" ON "Control"("isStandardControl");

-- CreateIndex
CREATE INDEX "Control_category_idx" ON "Control"("category");

-- CreateIndex
CREATE INDEX "Control_code_idx" ON "Control"("code");

-- CreateIndex
CREATE INDEX "Control_implemented_idx" ON "Control"("implemented");

-- CreateIndex
CREATE INDEX "Document_nextReviewDate_idx" ON "Document"("nextReviewDate");

-- CreateIndex
CREATE INDEX "Document_ownerUserId_idx" ON "Document"("ownerUserId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "DocumentControl_controlId_idx" ON "DocumentControl"("controlId");

-- CreateIndex
CREATE INDEX "DocumentControl_documentId_idx" ON "DocumentControl"("documentId");

-- CreateIndex
CREATE INDEX "DocumentRisk_riskId_idx" ON "DocumentRisk"("riskId");

-- CreateIndex
CREATE INDEX "DocumentRisk_documentId_idx" ON "DocumentRisk"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "InterestedParty_name_key" ON "InterestedParty"("name");

-- CreateIndex
CREATE INDEX "InterestedParty_group_idx" ON "InterestedParty"("group");

-- CreateIndex
CREATE INDEX "InterestedParty_name_idx" ON "InterestedParty"("name");

-- CreateIndex
CREATE INDEX "Legislation_actRegulationRequirement_idx" ON "Legislation"("actRegulationRequirement");

-- CreateIndex
CREATE INDEX "Legislation_interestedParty_idx" ON "Legislation"("interestedParty");

-- CreateIndex
CREATE INDEX "ReviewTask_status_idx" ON "ReviewTask"("status");

-- CreateIndex
CREATE INDEX "ReviewTask_dueDate_idx" ON "ReviewTask"("dueDate");

-- CreateIndex
CREATE INDEX "ReviewTask_reviewerUserId_idx" ON "ReviewTask"("reviewerUserId");

-- CreateIndex
CREATE INDEX "ReviewTask_documentId_idx" ON "ReviewTask"("documentId");

-- CreateIndex
CREATE INDEX "Risk_interestedPartyId_idx" ON "Risk"("interestedPartyId");

-- CreateIndex
CREATE INDEX "Risk_assetCategoryId_idx" ON "Risk"("assetCategoryId");

-- CreateIndex
CREATE INDEX "Risk_assetId_idx" ON "Risk"("assetId");

-- CreateIndex
CREATE INDEX "Risk_mitigationImplemented_idx" ON "Risk"("mitigationImplemented");

-- CreateIndex
CREATE INDEX "Risk_residualRiskTreatmentCategory_idx" ON "Risk"("residualRiskTreatmentCategory");

-- CreateIndex
CREATE INDEX "Risk_initialRiskTreatmentCategory_idx" ON "Risk"("initialRiskTreatmentCategory");

-- CreateIndex
CREATE INDEX "Risk_ownerUserId_idx" ON "Risk"("ownerUserId");

-- CreateIndex
CREATE INDEX "Risk_nextReviewDate_idx" ON "Risk"("nextReviewDate");

-- CreateIndex
CREATE INDEX "Risk_expiryDate_idx" ON "Risk"("expiryDate");

-- CreateIndex
CREATE INDEX "Risk_archived_idx" ON "Risk"("archived");

-- CreateIndex
CREATE INDEX "Risk_riskNature_idx" ON "Risk"("riskNature");

-- CreateIndex
CREATE INDEX "Risk_riskCategory_idx" ON "Risk"("riskCategory");

-- CreateIndex
CREATE INDEX "Risk_calculatedScore_idx" ON "Risk"("calculatedScore");

-- CreateIndex
CREATE INDEX "Risk_department_idx" ON "Risk"("department");

-- CreateIndex
CREATE INDEX "Risk_status_idx" ON "Risk"("status");

-- CreateIndex
CREATE INDEX "RiskControl_controlId_idx" ON "RiskControl"("controlId");

-- CreateIndex
CREATE INDEX "RiskControl_riskId_idx" ON "RiskControl"("riskId");

-- CreateIndex
CREATE INDEX "LegislationRisk_riskId_idx" ON "LegislationRisk"("riskId");

-- CreateIndex
CREATE INDEX "LegislationRisk_legislationId_idx" ON "LegislationRisk"("legislationId");

-- CreateIndex
CREATE INDEX "SoAExport_generatedAt_idx" ON "SoAExport"("generatedAt");

-- CreateIndex
CREATE INDEX "SoAExport_generatedByUserId_idx" ON "SoAExport"("generatedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_entraObjectId_key" ON "User"("entraObjectId");

-- CreateIndex
CREATE INDEX "User_entraObjectId_idx" ON "User"("entraObjectId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_department_idx" ON "User"("department");

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

-- AddForeignKey
ALTER TABLE "Acknowledgment" ADD CONSTRAINT "Acknowledgment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acknowledgment" ADD CONSTRAINT "Acknowledgment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "Classification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentControl" ADD CONSTRAINT "DocumentControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentControl" ADD CONSTRAINT "DocumentControl_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRisk" ADD CONSTRAINT "DocumentRisk_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRisk" ADD CONSTRAINT "DocumentRisk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_interestedPartyId_fkey" FOREIGN KEY ("interestedPartyId") REFERENCES "InterestedParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "AssetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegislationRisk" ADD CONSTRAINT "LegislationRisk_legislationId_fkey" FOREIGN KEY ("legislationId") REFERENCES "Legislation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegislationRisk" ADD CONSTRAINT "LegislationRisk_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoAExport" ADD CONSTRAINT "SoAExport_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustDocSetting" ADD CONSTRAINT "TrustDocSetting_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustDownload" ADD CONSTRAINT "TrustDownload_externalUserId_fkey" FOREIGN KEY ("externalUserId") REFERENCES "ExternalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustDownload" ADD CONSTRAINT "TrustDownload_docId_fkey" FOREIGN KEY ("docId") REFERENCES "TrustDocSetting"("documentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustAuditLog" ADD CONSTRAINT "TrustAuditLog_performedByExternalUserId_fkey" FOREIGN KEY ("performedByExternalUserId") REFERENCES "ExternalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustAuditLog" ADD CONSTRAINT "TrustAuditLog_targetDocumentId_fkey" FOREIGN KEY ("targetDocumentId") REFERENCES "TrustDocSetting"("documentId") ON DELETE CASCADE ON UPDATE CASCADE;
