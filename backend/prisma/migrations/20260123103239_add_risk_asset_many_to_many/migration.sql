/*
  Warnings:

  - You are about to drop the column `assetId` on the `Risk` table. All the data in the column will be lost.

*/
-- Safe migration: Check for existing state before making changes
-- This migration is idempotent and can be safely run on existing databases

-- Step 1: Create the RiskAsset junction table (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'RiskAsset') THEN
        CREATE TABLE "RiskAsset" (
            "riskId" TEXT NOT NULL,
            "assetId" TEXT NOT NULL,
            CONSTRAINT "RiskAsset_pkey" PRIMARY KEY ("riskId","assetId")
        );

        CREATE INDEX "RiskAsset_assetId_idx" ON "RiskAsset"("assetId");
        CREATE INDEX "RiskAsset_riskId_idx" ON "RiskAsset"("riskId");

        ALTER TABLE "RiskAsset" ADD CONSTRAINT "RiskAsset_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        ALTER TABLE "RiskAsset" ADD CONSTRAINT "RiskAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 2: Migrate existing assetId relationships to RiskAsset table
-- This must happen BEFORE dropping the assetId column
-- Only migrate if assetId column still exists and there's data to migrate
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Risk' AND column_name = 'assetId'
    ) THEN
        -- Migrate data that hasn't been migrated yet
        INSERT INTO "RiskAsset" ("riskId", "assetId")
        SELECT r.id, r."assetId" 
        FROM "Risk" r
        WHERE r."assetId" IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM "RiskAsset" ra 
            WHERE ra."riskId" = r.id AND ra."assetId" = r."assetId"
        );
    END IF;
END $$;

-- Step 3: Drop the old assetId column and its constraints (only if column exists)
DO $$
BEGIN
    -- Drop foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'Risk_assetId_fkey' 
        AND table_name = 'Risk'
    ) THEN
        ALTER TABLE "Risk" DROP CONSTRAINT "Risk_assetId_fkey";
    END IF;

    -- Drop index if it exists
    IF EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'Risk_assetId_idx'
    ) THEN
        DROP INDEX "Risk_assetId_idx";
    END IF;

    -- Drop column if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Risk' AND column_name = 'assetId'
    ) THEN
        ALTER TABLE "Risk" DROP COLUMN "assetId";
    END IF;
END $$;
