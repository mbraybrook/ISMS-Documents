-- AlterTable
ALTER TABLE "Control" ADD COLUMN "implemented" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Control_implemented_idx" ON "Control"("implemented");


