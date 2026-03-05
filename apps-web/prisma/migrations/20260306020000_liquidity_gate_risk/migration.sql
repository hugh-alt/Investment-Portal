-- AlterTable: add gateOrSuspendRisk to LiquidityProfile
ALTER TABLE "LiquidityProfile" ADD COLUMN "gateOrSuspendRisk" BOOLEAN NOT NULL DEFAULT false;
