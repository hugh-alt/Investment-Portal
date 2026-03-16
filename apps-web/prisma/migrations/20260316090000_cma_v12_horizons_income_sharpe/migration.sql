-- AlterTable: Add riskFreeRatePct to CMASet
ALTER TABLE "CMASet" ADD COLUMN "riskFreeRatePct" DOUBLE PRECISION NOT NULL DEFAULT 0.03;

-- AlterTable: Add incomeYieldPct to CMAAssumption
ALTER TABLE "CMAAssumption" ADD COLUMN "incomeYieldPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
