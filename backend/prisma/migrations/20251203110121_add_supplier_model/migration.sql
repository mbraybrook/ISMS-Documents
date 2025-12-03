-- AlterTable: Fix TrustCenterSettings drift
ALTER TABLE "TrustCenterSettings" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable: Fix Risk embedding column type
ALTER TABLE "Risk" ALTER COLUMN "embedding" SET DATA TYPE JSONB;

-- CreateTable: Supplier
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradingName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "supplierType" TEXT NOT NULL,
    "serviceSubType" TEXT,
    "serviceDescription" TEXT,
    "processesCardholderData" BOOLEAN NOT NULL DEFAULT false,
    "processesPersonalData" BOOLEAN NOT NULL DEFAULT false,
    "hostingRegions" JSONB,
    "customerFacingImpact" BOOLEAN NOT NULL DEFAULT false,
    "ciaImpact" TEXT,
    "overallRiskRating" TEXT,
    "criticality" TEXT,
    "riskRationale" TEXT,
    "criticalityRationale" TEXT,
    "lastRiskAssessmentAt" TIMESTAMP(3),
    "lastCriticalityAssessmentAt" TIMESTAMP(3),
    "pciStatus" TEXT,
    "iso27001Status" TEXT,
    "iso22301Status" TEXT,
    "iso9001Status" TEXT,
    "gdprStatus" TEXT,
    "lastComplianceReviewAt" TIMESTAMP(3),
    "complianceEvidenceLinks" JSONB,
    "relationshipOwnerUserId" TEXT,
    "primaryContacts" JSONB,
    "contractReferences" JSONB,
    "dataProcessingAgreementRef" TEXT,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "autoRenewal" BOOLEAN NOT NULL DEFAULT false,
    "performanceRating" TEXT,
    "performanceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_status_idx" ON "Supplier"("status");

-- CreateIndex
CREATE INDEX "Supplier_supplierType_idx" ON "Supplier"("supplierType");

-- CreateIndex
CREATE INDEX "Supplier_criticality_idx" ON "Supplier"("criticality");

-- CreateIndex
CREATE INDEX "Supplier_pciStatus_idx" ON "Supplier"("pciStatus");

-- CreateIndex
CREATE INDEX "Supplier_iso27001Status_idx" ON "Supplier"("iso27001Status");

-- CreateIndex
CREATE INDEX "Supplier_performanceRating_idx" ON "Supplier"("performanceRating");

-- CreateIndex
CREATE INDEX "Supplier_relationshipOwnerUserId_idx" ON "Supplier"("relationshipOwnerUserId");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_relationshipOwnerUserId_fkey" FOREIGN KEY ("relationshipOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

