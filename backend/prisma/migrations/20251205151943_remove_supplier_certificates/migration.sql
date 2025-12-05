/*
  Warnings:

  - You are about to drop the `SupplierCertificate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SupplierCertificate" DROP CONSTRAINT "SupplierCertificate_supplierId_fkey";

-- DropTable
DROP TABLE "SupplierCertificate";
