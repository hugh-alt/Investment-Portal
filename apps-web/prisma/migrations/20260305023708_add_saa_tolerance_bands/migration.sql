-- Add tolerance band columns with defaults for backfill
ALTER TABLE "SAAAllocation"
  ADD COLUMN "minWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "maxWeight" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill existing allocations: ±2% around target, clamped to 0–1
UPDATE "SAAAllocation"
SET "minWeight" = GREATEST(0, "targetWeight" - 0.02),
    "maxWeight" = LEAST(1, "targetWeight" + 0.02);

-- Remove defaults now that backfill is done
ALTER TABLE "SAAAllocation"
  ALTER COLUMN "minWeight" DROP DEFAULT,
  ALTER COLUMN "maxWeight" DROP DEFAULT;
