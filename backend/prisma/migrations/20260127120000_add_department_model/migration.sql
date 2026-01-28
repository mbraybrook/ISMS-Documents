-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Department_name_idx" ON "Department"("name");

-- Add new departmentId columns
ALTER TABLE "User" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Risk" ADD COLUMN "departmentId" TEXT;

-- Create foreign key constraints
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes for departmentId
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");
CREATE INDEX "Risk_departmentId_idx" ON "Risk"("departmentId");

-- Migrate existing string departments to Department records
-- First, create Department records for all unique department values
INSERT INTO "Department" ("id", "name", "createdAt", "updatedAt")
SELECT DISTINCT 
    gen_random_uuid()::text as "id",
    "department" as "name",
    CURRENT_TIMESTAMP as "createdAt",
    CURRENT_TIMESTAMP as "updatedAt"
FROM "User"
WHERE "department" IS NOT NULL
UNION
SELECT DISTINCT 
    gen_random_uuid()::text as "id",
    "department" as "name",
    CURRENT_TIMESTAMP as "createdAt",
    CURRENT_TIMESTAMP as "updatedAt"
FROM "Risk"
WHERE "department" IS NOT NULL
ON CONFLICT ("name") DO NOTHING;

-- Update User table to use departmentId
UPDATE "User" u
SET "departmentId" = d."id"
FROM "Department" d
WHERE u."department" = d."name" AND u."department" IS NOT NULL;

-- Update Risk table to use departmentId
UPDATE "Risk" r
SET "departmentId" = d."id"
FROM "Department" d
WHERE r."department" = d."name" AND r."department" IS NOT NULL;

-- Drop old department columns (commented out for safety - uncomment after verifying migration)
-- ALTER TABLE "User" DROP COLUMN "department";
-- ALTER TABLE "Risk" DROP COLUMN "department";
-- DROP INDEX IF EXISTS "User_department_idx";
-- DROP INDEX IF EXISTS "Risk_department_idx";
