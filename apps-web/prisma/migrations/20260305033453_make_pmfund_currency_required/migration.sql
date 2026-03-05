-- Backfill any NULL currencies to AUD
UPDATE "PMFund" SET "currency" = 'AUD' WHERE "currency" IS NULL;

-- Make currency required
ALTER TABLE "PMFund" ALTER COLUMN "currency" SET NOT NULL;
