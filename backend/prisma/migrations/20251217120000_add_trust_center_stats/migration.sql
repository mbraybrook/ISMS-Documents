-- AlterTable
ALTER TABLE "TrustCenterSettings" ADD COLUMN IF NOT EXISTS "uptimeSLA" TEXT,
ADD COLUMN IF NOT EXISTS "activeCertifications" INTEGER;

