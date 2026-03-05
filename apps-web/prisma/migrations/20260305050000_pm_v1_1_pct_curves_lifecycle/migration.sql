-- CreateEnum
CREATE TYPE "LifecycleStage" AS ENUM ('FUNDRAISING', 'INVESTING', 'HARVESTING', 'LIQUIDATING');

-- AlterTable: PMFund - add lifecycle fields
ALTER TABLE "PMFund" ADD COLUMN "lifecycleStage" "LifecycleStage";
ALTER TABLE "PMFund" ADD COLUMN "firstCloseDate" TIMESTAMP(3);
ALTER TABLE "PMFund" ADD COLUMN "investmentPeriodMonths" INTEGER;
ALTER TABLE "PMFund" ADD COLUMN "fundTermMonths" INTEGER;

-- AlterTable: PMFundProfile - replace $ projections with % curves
-- Step 1: Add new columns with defaults so existing rows survive
ALTER TABLE "PMFundProfile" ADD COLUMN "projectedCallPctCurveJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "PMFundProfile" ADD COLUMN "projectedDistPctCurveJson" TEXT NOT NULL DEFAULT '[]';

-- Step 2: Drop old columns
ALTER TABLE "PMFundProfile" DROP COLUMN "projectedCallsJson";
ALTER TABLE "PMFundProfile" DROP COLUMN "projectedDistributionsJson";

-- Step 3: Remove defaults (columns are required going forward)
ALTER TABLE "PMFundProfile" ALTER COLUMN "projectedCallPctCurveJson" DROP DEFAULT;
ALTER TABLE "PMFundProfile" ALTER COLUMN "projectedDistPctCurveJson" DROP DEFAULT;

-- AlterTable: ClientCommitment - add latestNavDate
ALTER TABLE "ClientCommitment" ADD COLUMN "latestNavDate" TIMESTAMP(3);
