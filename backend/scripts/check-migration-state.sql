-- Check the current state of the migration
-- Run this to see what's already been applied

-- Check if RiskAsset table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'RiskAsset') 
        THEN 'RiskAsset table EXISTS'
        ELSE 'RiskAsset table DOES NOT EXIST'
    END as risk_asset_table_status;

-- Check if assetId column exists on Risk table
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risk' AND column_name = 'assetId') 
        THEN 'assetId column EXISTS on Risk table'
        ELSE 'assetId column DOES NOT EXIST on Risk table'
        END as asset_id_column_status;

-- Count existing RiskAsset records
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'RiskAsset')
        THEN (SELECT COUNT(*)::text FROM "RiskAsset")
        ELSE 'N/A - table does not exist'
    END as risk_asset_count;

-- Count Risks with assetId (if column exists)
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Risk' AND column_name = 'assetId')
        THEN (SELECT COUNT(*)::text FROM "Risk" WHERE "assetId" IS NOT NULL)
        ELSE 'N/A - column does not exist'
    END as risks_with_asset_id_count;
