-- Drop old department string columns after migration to Department model is verified
-- This migration removes the legacy string columns that have been replaced by departmentId foreign keys

ALTER TABLE "User" DROP COLUMN IF EXISTS "department";
ALTER TABLE "Risk" DROP COLUMN IF EXISTS "department";
DROP INDEX IF EXISTS "User_department_idx";
DROP INDEX IF EXISTS "Risk_department_idx";
