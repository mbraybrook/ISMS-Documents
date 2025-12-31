-- AlterTable
ALTER TABLE "Document" ADD COLUMN "hasChanged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastChecked" TIMESTAMP(3),
ADD COLUMN "lastModified" TIMESTAMP(3);

