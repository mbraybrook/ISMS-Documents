-- CreateTable
CREATE TABLE "TrustCenterCertification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "TrustCenterCertification_displayOrder_idx" ON "TrustCenterCertification"("displayOrder");

