-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "showInTrustCenter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trustCenterCategory" TEXT,
ADD COLUMN     "trustCenterComplianceSummary" TEXT,
ADD COLUMN     "trustCenterDescription" TEXT,
ADD COLUMN     "trustCenterDisplayName" TEXT;

-- CreateTable
CREATE TABLE "SupplierExitPlan" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "reason" TEXT,
    "startDate" TIMESTAMP(3),
    "targetEndDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "impactAssessment" JSONB,
    "dataAndIpr" JSONB,
    "replacementServiceAnalysis" JSONB,
    "contractClosure" JSONB,
    "lessonsLearned" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierExitPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierExitPlan_supplierId_key" ON "SupplierExitPlan"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierExitPlan_supplierId_idx" ON "SupplierExitPlan"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierExitPlan_status_idx" ON "SupplierExitPlan"("status");

-- CreateIndex
CREATE INDEX "SupplierExitPlan_startDate_idx" ON "SupplierExitPlan"("startDate");

-- CreateIndex
CREATE INDEX "SupplierExitPlan_targetEndDate_idx" ON "SupplierExitPlan"("targetEndDate");

-- CreateIndex
CREATE INDEX "SupplierExitPlan_completedAt_idx" ON "SupplierExitPlan"("completedAt");

-- CreateIndex
CREATE INDEX "Supplier_showInTrustCenter_idx" ON "Supplier"("showInTrustCenter");

-- CreateIndex
CREATE INDEX "Supplier_trustCenterCategory_idx" ON "Supplier"("trustCenterCategory");

-- AddForeignKey
ALTER TABLE "SupplierExitPlan" ADD CONSTRAINT "SupplierExitPlan_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
