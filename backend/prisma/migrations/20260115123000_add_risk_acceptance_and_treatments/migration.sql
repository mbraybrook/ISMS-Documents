-- AlterTable
ALTER TABLE "Risk"
ADD COLUMN "acceptedByUserId" TEXT,
ADD COLUMN "acceptedAt" TIMESTAMP(3),
ADD COLUMN "acceptanceRationale" TEXT,
ADD COLUMN "appetiteThreshold" INTEGER,
ADD COLUMN "reviewCadenceDays" INTEGER;

-- CreateTable
CREATE TABLE "RiskTreatmentAction" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "effectivenessScore" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskTreatmentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskMetricSnapshot" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics" JSONB NOT NULL,

    CONSTRAINT "RiskMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Risk_acceptedByUserId_idx" ON "Risk"("acceptedByUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Risk_acceptedAt_idx" ON "Risk"("acceptedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RiskTreatmentAction_riskId_idx" ON "RiskTreatmentAction"("riskId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RiskTreatmentAction_ownerUserId_idx" ON "RiskTreatmentAction"("ownerUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RiskTreatmentAction_status_idx" ON "RiskTreatmentAction"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RiskTreatmentAction_dueDate_idx" ON "RiskTreatmentAction"("dueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RiskMetricSnapshot_periodStart_idx" ON "RiskMetricSnapshot"("periodStart");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RiskMetricSnapshot_periodEnd_idx" ON "RiskMetricSnapshot"("periodEnd");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RiskMetricSnapshot_capturedAt_idx" ON "RiskMetricSnapshot"("capturedAt");

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskTreatmentAction" ADD CONSTRAINT "RiskTreatmentAction_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskTreatmentAction" ADD CONSTRAINT "RiskTreatmentAction_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
