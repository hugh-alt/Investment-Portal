-- AlterTable: PMFundCashflowEvent — make amount nullable, add callPct
ALTER TABLE "PMFundCashflowEvent" ALTER COLUMN "amount" DROP NOT NULL;
ALTER TABLE "PMFundCashflowEvent" ADD COLUMN "callPct" DOUBLE PRECISION;

-- CreateEnum: DistributionBasis
CREATE TYPE "DistributionBasis" AS ENUM ('PRO_RATA_COMMITMENT', 'PRO_RATA_PAIDIN');

-- CreateTable: PMFundDistributionEvent
CREATE TABLE "PMFundDistributionEvent" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "basis" "DistributionBasis" NOT NULL DEFAULT 'PRO_RATA_COMMITMENT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PMFundDistributionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PMFundDistributionAllocation
CREATE TABLE "PMFundDistributionAllocation" (
    "id" TEXT NOT NULL,
    "distributionEventId" TEXT NOT NULL,
    "clientCommitmentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "pctOfCommitment" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PMFundDistributionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PMFundKpiPoint
CREATE TABLE "PMFundKpiPoint" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "kpiDate" TIMESTAMP(3) NOT NULL,
    "tvpi" DOUBLE PRECISION NOT NULL,
    "rvpi" DOUBLE PRECISION NOT NULL,
    "dpi" DOUBLE PRECISION NOT NULL,
    "moic" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PMFundKpiPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PMFundDistributionEvent_fundId_eventDate_idx" ON "PMFundDistributionEvent"("fundId", "eventDate");
CREATE UNIQUE INDEX "PMFundDistributionAllocation_distributionEventId_clientComm_key" ON "PMFundDistributionAllocation"("distributionEventId", "clientCommitmentId");
CREATE INDEX "PMFundKpiPoint_fundId_kpiDate_idx" ON "PMFundKpiPoint"("fundId", "kpiDate");

-- AddForeignKey
ALTER TABLE "PMFundDistributionEvent" ADD CONSTRAINT "PMFundDistributionEvent_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "PMFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PMFundDistributionAllocation" ADD CONSTRAINT "PMFundDistributionAllocation_distributionEventId_fkey" FOREIGN KEY ("distributionEventId") REFERENCES "PMFundDistributionEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PMFundDistributionAllocation" ADD CONSTRAINT "PMFundDistributionAllocation_clientCommitmentId_fkey" FOREIGN KEY ("clientCommitmentId") REFERENCES "ClientCommitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PMFundKpiPoint" ADD CONSTRAINT "PMFundKpiPoint_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "PMFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
