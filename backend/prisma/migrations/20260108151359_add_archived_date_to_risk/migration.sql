-- AlterTable
ALTER TABLE "Risk" ADD COLUMN "archivedDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Risk_archivedDate_idx" ON "Risk"("archivedDate");
