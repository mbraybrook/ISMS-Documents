-- AlterTable
ALTER TABLE "TrustDocSetting" ADD COLUMN "certificateId" TEXT;

-- CreateIndex
CREATE INDEX "TrustDocSetting_certificateId_idx" ON "TrustDocSetting"("certificateId");

-- AddForeignKey
ALTER TABLE "TrustDocSetting" ADD CONSTRAINT "TrustDocSetting_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "TrustCenterCertification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

