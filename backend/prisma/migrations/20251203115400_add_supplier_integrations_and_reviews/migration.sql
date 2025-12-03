-- AlterTable
ALTER TABLE "ReviewTask" ADD COLUMN     "supplierId" TEXT,
ALTER COLUMN "documentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Risk" ADD COLUMN     "isSupplierRisk" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "lastReviewAt" TIMESTAMP(3),
ADD COLUMN     "nextReviewAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SupplierRiskLink" (
    "supplierId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,

    CONSTRAINT "SupplierRiskLink_pkey" PRIMARY KEY ("supplierId","riskId")
);

-- CreateTable
CREATE TABLE "SupplierControlLink" (
    "supplierId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,

    CONSTRAINT "SupplierControlLink_pkey" PRIMARY KEY ("supplierId","controlId")
);

-- CreateTable
CREATE TABLE "SupplierComplianceReview" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "checksPerformed" TEXT,
    "outcome" TEXT,
    "updatedPerformanceRating" TEXT,
    "notes" TEXT,
    "evidenceLinks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierComplianceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCertificate" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "certificateNumber" TEXT,
    "issuer" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "evidenceLink" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierRiskLink_riskId_idx" ON "SupplierRiskLink"("riskId");

-- CreateIndex
CREATE INDEX "SupplierRiskLink_supplierId_idx" ON "SupplierRiskLink"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierControlLink_controlId_idx" ON "SupplierControlLink"("controlId");

-- CreateIndex
CREATE INDEX "SupplierControlLink_supplierId_idx" ON "SupplierControlLink"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierComplianceReview_supplierId_idx" ON "SupplierComplianceReview"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierComplianceReview_reviewType_idx" ON "SupplierComplianceReview"("reviewType");

-- CreateIndex
CREATE INDEX "SupplierComplianceReview_plannedAt_idx" ON "SupplierComplianceReview"("plannedAt");

-- CreateIndex
CREATE INDEX "SupplierComplianceReview_completedAt_idx" ON "SupplierComplianceReview"("completedAt");

-- CreateIndex
CREATE INDEX "SupplierComplianceReview_outcome_idx" ON "SupplierComplianceReview"("outcome");

-- CreateIndex
CREATE INDEX "SupplierCertificate_supplierId_idx" ON "SupplierCertificate"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierCertificate_certificateType_idx" ON "SupplierCertificate"("certificateType");

-- CreateIndex
CREATE INDEX "SupplierCertificate_expiryDate_idx" ON "SupplierCertificate"("expiryDate");

-- CreateIndex
CREATE INDEX "ReviewTask_supplierId_idx" ON "ReviewTask"("supplierId");

-- CreateIndex
CREATE INDEX "Supplier_nextReviewAt_idx" ON "Supplier"("nextReviewAt");

-- CreateIndex
CREATE INDEX "Supplier_lastReviewAt_idx" ON "Supplier"("lastReviewAt");

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRiskLink" ADD CONSTRAINT "SupplierRiskLink_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRiskLink" ADD CONSTRAINT "SupplierRiskLink_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierControlLink" ADD CONSTRAINT "SupplierControlLink_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierControlLink" ADD CONSTRAINT "SupplierControlLink_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierComplianceReview" ADD CONSTRAINT "SupplierComplianceReview_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierComplianceReview" ADD CONSTRAINT "SupplierComplianceReview_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCertificate" ADD CONSTRAINT "SupplierCertificate_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

