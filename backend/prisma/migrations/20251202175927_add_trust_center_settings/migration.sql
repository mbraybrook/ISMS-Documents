-- CreateTable
CREATE TABLE "TrustCenterSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "watermarkPrefix" TEXT NOT NULL DEFAULT 'Paythru Confidential',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrustCenterSettings_key_key" UNIQUE ("key")
);

-- CreateIndex
CREATE INDEX "TrustCenterSettings_key_idx" ON "TrustCenterSettings"("key");
