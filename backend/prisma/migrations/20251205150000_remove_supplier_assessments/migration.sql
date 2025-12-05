-- DropForeignKey
ALTER TABLE "Supplier" DROP CONSTRAINT IF EXISTS "Supplier_currentRiskAssessmentId_fkey";
ALTER TABLE "Supplier" DROP CONSTRAINT IF EXISTS "Supplier_currentCriticalityAssessmentId_fkey";
ALTER TABLE "SupplierRiskAssessment" DROP CONSTRAINT IF EXISTS "SupplierRiskAssessment_supplierId_fkey";
ALTER TABLE "SupplierRiskAssessment" DROP CONSTRAINT IF EXISTS "SupplierRiskAssessment_assessedByUserId_fkey";
ALTER TABLE "SupplierRiskAssessment" DROP CONSTRAINT IF EXISTS "SupplierRiskAssessment_approvedByUserId_fkey";
ALTER TABLE "SupplierCriticalityAssessment" DROP CONSTRAINT IF EXISTS "SupplierCriticalityAssessment_supplierId_fkey";
ALTER TABLE "SupplierCriticalityAssessment" DROP CONSTRAINT IF EXISTS "SupplierCriticalityAssessment_assessedByUserId_fkey";
ALTER TABLE "SupplierCriticalityAssessment" DROP CONSTRAINT IF EXISTS "SupplierCriticalityAssessment_approvedByUserId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Supplier_currentRiskAssessmentId_key";
DROP INDEX IF EXISTS "Supplier_currentCriticalityAssessmentId_key";
DROP INDEX IF EXISTS "Supplier_currentRiskAssessmentId_idx";
DROP INDEX IF EXISTS "Supplier_currentCriticalityAssessmentId_idx";
DROP INDEX IF EXISTS "SupplierRiskAssessment_supplierId_idx";
DROP INDEX IF EXISTS "SupplierRiskAssessment_status_idx";
DROP INDEX IF EXISTS "SupplierRiskAssessment_assessedByUserId_idx";
DROP INDEX IF EXISTS "SupplierRiskAssessment_approvedByUserId_idx";
DROP INDEX IF EXISTS "SupplierCriticalityAssessment_supplierId_idx";
DROP INDEX IF EXISTS "SupplierCriticalityAssessment_status_idx";
DROP INDEX IF EXISTS "SupplierCriticalityAssessment_assessedByUserId_idx";
DROP INDEX IF EXISTS "SupplierCriticalityAssessment_approvedByUserId_idx";

-- AlterTable
ALTER TABLE "Supplier" DROP COLUMN IF EXISTS "currentRiskAssessmentId";
ALTER TABLE "Supplier" DROP COLUMN IF EXISTS "currentCriticalityAssessmentId";
ALTER TABLE "Supplier" DROP COLUMN IF EXISTS "lastRiskAssessmentAt";
ALTER TABLE "Supplier" DROP COLUMN IF EXISTS "lastCriticalityAssessmentAt";

-- DropTable
DROP TABLE IF EXISTS "SupplierRiskAssessment";
DROP TABLE IF EXISTS "SupplierCriticalityAssessment";

