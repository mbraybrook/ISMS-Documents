-- AlterTable
ALTER TABLE "ExternalUser" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "ExternalUser_isActive_idx" ON "ExternalUser"("isActive");

