-- AlterTable
ALTER TABLE "InterestedParty" ADD COLUMN "dateAdded" DATETIME;
ALTER TABLE "InterestedParty" ADD COLUMN "requirements" TEXT;
ALTER TABLE "InterestedParty" ADD COLUMN "addressedThroughISMS" BOOLEAN;
ALTER TABLE "InterestedParty" ADD COLUMN "howAddressedThroughISMS" TEXT;
ALTER TABLE "InterestedParty" ADD COLUMN "sourceLink" TEXT;
ALTER TABLE "InterestedParty" ADD COLUMN "keyProductsServices" TEXT;
ALTER TABLE "InterestedParty" ADD COLUMN "ourObligations" TEXT;
ALTER TABLE "InterestedParty" ADD COLUMN "theirObligations" TEXT;

-- Set dateAdded to createdAt for existing records
UPDATE "InterestedParty" SET "dateAdded" = "createdAt" WHERE "dateAdded" IS NULL;

