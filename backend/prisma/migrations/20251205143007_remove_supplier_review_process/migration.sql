/*
  Warnings:

  - You are about to drop the column `supplierId` on the `ReviewTask` table. All the data in the column will be lost.
  - You are about to drop the column `lastReviewAt` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `nextReviewAt` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the `SupplierComplianceReview` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ReviewTask" DROP CONSTRAINT "ReviewTask_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "SupplierComplianceReview" DROP CONSTRAINT "SupplierComplianceReview_reviewedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "SupplierComplianceReview" DROP CONSTRAINT "SupplierComplianceReview_supplierId_fkey";

-- DropIndex
DROP INDEX "ReviewTask_supplierId_idx";

-- DropIndex
DROP INDEX "Supplier_lastReviewAt_idx";

-- DropIndex
DROP INDEX "Supplier_nextReviewAt_idx";

-- AlterTable
ALTER TABLE "ReviewTask" DROP COLUMN "supplierId";

-- AlterTable: Add reviewDate column first
ALTER TABLE "Supplier" ADD COLUMN "reviewDate" TIMESTAMP(3);

-- Copy data from lastReviewAt to reviewDate
UPDATE "Supplier" SET "reviewDate" = "lastReviewAt" WHERE "lastReviewAt" IS NOT NULL;

-- Drop old columns
ALTER TABLE "Supplier" DROP COLUMN "lastReviewAt";
ALTER TABLE "Supplier" DROP COLUMN "nextReviewAt";

-- DropTable
DROP TABLE "SupplierComplianceReview";

-- CreateIndex
CREATE INDEX "Supplier_reviewDate_idx" ON "Supplier"("reviewDate");
