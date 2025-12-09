/*
  Warnings:

  - You are about to drop the column `completedAt` on the `SupplierExitPlan` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `SupplierExitPlan` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `SupplierExitPlan` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `SupplierExitPlan` table. All the data in the column will be lost.
  - You are about to drop the column `targetEndDate` on the `SupplierExitPlan` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX IF EXISTS "SupplierExitPlan_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "SupplierExitPlan_startDate_idx";

-- DropIndex
DROP INDEX IF EXISTS "SupplierExitPlan_targetEndDate_idx";

-- DropIndex
DROP INDEX IF EXISTS "SupplierExitPlan_completedAt_idx";

-- AlterTable
ALTER TABLE "SupplierExitPlan" DROP COLUMN "reason",
DROP COLUMN "startDate",
DROP COLUMN "targetEndDate",
DROP COLUMN "completedAt",
DROP COLUMN "status";



