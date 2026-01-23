-- Data migration: Move existing assetId values from Risk table to RiskAsset junction table
-- This should be run AFTER the schema migration that creates the RiskAsset table
-- and BEFORE removing the assetId column from the Risk table

-- Migrate existing assetId relationships to RiskAsset table
INSERT INTO "RiskAsset" ("riskId", "assetId")
SELECT id, "assetId" 
FROM "Risk"
WHERE "assetId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Note: After this migration runs successfully, you can remove the assetId column
-- from the Risk table in a subsequent migration if desired (though keeping it
-- for backward compatibility during transition may be safer)
