-- CreateEnum: CloseType
CREATE TYPE "CloseType" AS ENUM ('FIRST', 'SECOND', 'FINAL', 'OTHER');

-- AlterTable: Add extensionMonths to PMFundTruth
ALTER TABLE "PMFundTruth" ADD COLUMN "extensionMonths" INTEGER;

-- CreateTable: PMFundClose
CREATE TABLE "PMFundClose" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "closeType" "CloseType" NOT NULL,
    "closeDate" TIMESTAMP(3) NOT NULL,
    "capitalRaised" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PMFundClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PMFundNAVPoint (fund-level)
CREATE TABLE "PMFundNAVPoint" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "navDate" TIMESTAMP(3) NOT NULL,
    "navAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PMFundNAVPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PMFundCashflowEvent (fund-level)
CREATE TABLE "PMFundCashflowEvent" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "type" "CashflowEventType" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PMFundCashflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PMFundClose_fundId_closeDate_idx" ON "PMFundClose"("fundId", "closeDate");
CREATE INDEX "PMFundNAVPoint_fundId_navDate_idx" ON "PMFundNAVPoint"("fundId", "navDate");
CREATE INDEX "PMFundCashflowEvent_fundId_eventDate_idx" ON "PMFundCashflowEvent"("fundId", "eventDate");

-- AddForeignKey
ALTER TABLE "PMFundClose" ADD CONSTRAINT "PMFundClose_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "PMFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PMFundNAVPoint" ADD CONSTRAINT "PMFundNAVPoint_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "PMFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PMFundCashflowEvent" ADD CONSTRAINT "PMFundCashflowEvent_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "PMFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
