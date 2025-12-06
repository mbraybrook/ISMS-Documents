/*
  Warnings:

  - You are about to drop the column `ciaImpact` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `ciaImpact` on the `SupplierRiskAssessment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Supplier" DROP COLUMN "ciaImpact";

-- AlterTable
ALTER TABLE "SupplierRiskAssessment" DROP COLUMN "ciaImpact";



