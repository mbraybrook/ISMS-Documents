-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "cisoExemptionGranted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentCriticalityAssessmentId" TEXT,
ADD COLUMN     "currentRiskAssessmentId" TEXT,
ADD COLUMN     "lifecycleState" TEXT NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "SupplierRiskAssessment" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "ciaImpact" TEXT NOT NULL,
    "supplierType" TEXT NOT NULL,
    "riskRating" TEXT NOT NULL,
    "rationale" TEXT,
    "assessedByUserId" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierRiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCriticalityAssessment" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "criticality" TEXT NOT NULL,
    "rationale" TEXT,
    "supportingEvidenceLinks" JSONB,
    "assessedByUserId" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCriticalityAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierRiskAssessment_supplierId_idx" ON "SupplierRiskAssessment"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierRiskAssessment_status_idx" ON "SupplierRiskAssessment"("status");

-- CreateIndex
CREATE INDEX "SupplierRiskAssessment_assessedByUserId_idx" ON "SupplierRiskAssessment"("assessedByUserId");

-- CreateIndex
CREATE INDEX "SupplierRiskAssessment_approvedByUserId_idx" ON "SupplierRiskAssessment"("approvedByUserId");

-- CreateIndex
CREATE INDEX "SupplierCriticalityAssessment_supplierId_idx" ON "SupplierCriticalityAssessment"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierCriticalityAssessment_status_idx" ON "SupplierCriticalityAssessment"("status");

-- CreateIndex
CREATE INDEX "SupplierCriticalityAssessment_assessedByUserId_idx" ON "SupplierCriticalityAssessment"("assessedByUserId");

-- CreateIndex
CREATE INDEX "SupplierCriticalityAssessment_approvedByUserId_idx" ON "SupplierCriticalityAssessment"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_currentRiskAssessmentId_key" ON "Supplier"("currentRiskAssessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_currentCriticalityAssessmentId_key" ON "Supplier"("currentCriticalityAssessmentId");

-- CreateIndex
CREATE INDEX "Supplier_lifecycleState_idx" ON "Supplier"("lifecycleState");

-- CreateIndex
CREATE INDEX "Supplier_currentRiskAssessmentId_idx" ON "Supplier"("currentRiskAssessmentId");

-- CreateIndex
CREATE INDEX "Supplier_currentCriticalityAssessmentId_idx" ON "Supplier"("currentCriticalityAssessmentId");

-- AddForeignKey
ALTER TABLE "SupplierRiskAssessment" ADD CONSTRAINT "SupplierRiskAssessment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRiskAssessment" ADD CONSTRAINT "SupplierRiskAssessment_assessedByUserId_fkey" FOREIGN KEY ("assessedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRiskAssessment" ADD CONSTRAINT "SupplierRiskAssessment_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCriticalityAssessment" ADD CONSTRAINT "SupplierCriticalityAssessment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCriticalityAssessment" ADD CONSTRAINT "SupplierCriticalityAssessment_assessedByUserId_fkey" FOREIGN KEY ("assessedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCriticalityAssessment" ADD CONSTRAINT "SupplierCriticalityAssessment_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_currentRiskAssessmentId_fkey" FOREIGN KEY ("currentRiskAssessmentId") REFERENCES "SupplierRiskAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_currentCriticalityAssessmentId_fkey" FOREIGN KEY ("currentCriticalityAssessmentId") REFERENCES "SupplierCriticalityAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;


