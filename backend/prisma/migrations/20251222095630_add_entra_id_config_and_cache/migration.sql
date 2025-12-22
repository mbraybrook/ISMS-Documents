-- CreateTable
CREATE TABLE "EntraIdConfig" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntraIdConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntraIdUserCache" (
    "id" TEXT NOT NULL,
    "entraObjectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntraIdUserCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntraIdConfig_groupId_key" ON "EntraIdConfig"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "EntraIdUserCache_entraObjectId_key" ON "EntraIdUserCache"("entraObjectId");

-- CreateIndex
CREATE INDEX "EntraIdUserCache_email_idx" ON "EntraIdUserCache"("email");

