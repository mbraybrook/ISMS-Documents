-- CreateTable
CREATE TABLE "Classification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "assetCategoryId" TEXT NOT NULL,
    "assetSubCategory" TEXT,
    "owner" TEXT NOT NULL,
    "primaryUser" TEXT,
    "location" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "nameSerialNo" TEXT,
    "cdeImpacting" BOOLEAN NOT NULL DEFAULT false,
    "classificationId" TEXT NOT NULL,
    "purpose" TEXT,
    "notes" TEXT,
    "cost" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "AssetCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Asset_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "Classification" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Classification_name_key" ON "Classification"("name");

-- CreateIndex
CREATE INDEX "Classification_name_idx" ON "Classification"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_name_key" ON "AssetCategory"("name");

-- CreateIndex
CREATE INDEX "AssetCategory_name_idx" ON "AssetCategory"("name");

-- CreateIndex
CREATE INDEX "Asset_assetCategoryId_idx" ON "Asset"("assetCategoryId");

-- CreateIndex
CREATE INDEX "Asset_classificationId_idx" ON "Asset"("classificationId");

-- CreateIndex
CREATE INDEX "Asset_owner_idx" ON "Asset"("owner");

-- CreateIndex
CREATE INDEX "Asset_date_idx" ON "Asset"("date");



