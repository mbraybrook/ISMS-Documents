-- CreateTable
CREATE TABLE "Legislation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dateAdded" DATETIME,
    "interestedParty" TEXT,
    "actRegulationRequirement" TEXT NOT NULL,
    "description" TEXT,
    "riskOfNonCompliance" TEXT,
    "howComplianceAchieved" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LegislationRisk" (
    "legislationId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    CONSTRAINT "LegislationRisk_legislationId_fkey" FOREIGN KEY ("legislationId") REFERENCES "Legislation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LegislationRisk_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("legislationId", "riskId")
);

-- CreateIndex
CREATE INDEX "Legislation_actRegulationRequirement_idx" ON "Legislation"("actRegulationRequirement");

-- CreateIndex
CREATE INDEX "Legislation_interestedParty_idx" ON "Legislation"("interestedParty");

-- CreateIndex
CREATE INDEX "LegislationRisk_riskId_idx" ON "LegislationRisk"("riskId");

-- CreateIndex
CREATE INDEX "LegislationRisk_legislationId_idx" ON "LegislationRisk"("legislationId");



