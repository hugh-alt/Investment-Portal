-- PM Sleeve Lifecycle Depth v1: templates, fund truth, cashflow events, NAV points, scenario

-- CreateEnum
CREATE TYPE "PMTemplateStatus" AS ENUM ('ACTIVE', 'RETIRED');
CREATE TYPE "CashflowEventType" AS ENUM ('CALL', 'DISTRIBUTION');

-- PMProjectionTemplate
CREATE TABLE "PMProjectionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT,
    "paramsJson" TEXT NOT NULL DEFAULT '{}',
    "callCurvePctJson" TEXT NOT NULL,
    "distCurvePctJson" TEXT NOT NULL,
    "status" "PMTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PMProjectionTemplate_pkey" PRIMARY KEY ("id")
);

-- PMFundTruth
CREATE TABLE "PMFundTruth" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "defaultTemplateId" TEXT,
    "lifecycleStage" "LifecycleStage",
    "firstCloseDate" TIMESTAMP(3),
    "investmentPeriodMonths" INTEGER,
    "fundTermMonths" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PMFundTruth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PMFundTruth_fundId_key" ON "PMFundTruth"("fundId");

-- ClientFundCashflowEvent
CREATE TABLE "ClientFundCashflowEvent" (
    "id" TEXT NOT NULL,
    "clientCommitmentId" TEXT NOT NULL,
    "type" "CashflowEventType" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientFundCashflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientFundCashflowEvent_clientCommitmentId_eventDate_idx" ON "ClientFundCashflowEvent"("clientCommitmentId", "eventDate");

-- ClientFundNAVPoint
CREATE TABLE "ClientFundNAVPoint" (
    "id" TEXT NOT NULL,
    "clientCommitmentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "navAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientFundNAVPoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientFundNAVPoint_clientCommitmentId_date_idx" ON "ClientFundNAVPoint"("clientCommitmentId", "date");

-- ClientCommitmentScenario
CREATE TABLE "ClientCommitmentScenario" (
    "id" TEXT NOT NULL,
    "clientCommitmentId" TEXT NOT NULL,
    "selectedTemplateId" TEXT NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCommitmentScenario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientCommitmentScenario_clientCommitmentId_key" ON "ClientCommitmentScenario"("clientCommitmentId");

-- Foreign Keys
ALTER TABLE "PMFundTruth" ADD CONSTRAINT "PMFundTruth_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "PMFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PMFundTruth" ADD CONSTRAINT "PMFundTruth_defaultTemplateId_fkey" FOREIGN KEY ("defaultTemplateId") REFERENCES "PMProjectionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientFundCashflowEvent" ADD CONSTRAINT "ClientFundCashflowEvent_clientCommitmentId_fkey" FOREIGN KEY ("clientCommitmentId") REFERENCES "ClientCommitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientFundNAVPoint" ADD CONSTRAINT "ClientFundNAVPoint_clientCommitmentId_fkey" FOREIGN KEY ("clientCommitmentId") REFERENCES "ClientCommitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientCommitmentScenario" ADD CONSTRAINT "ClientCommitmentScenario_clientCommitmentId_fkey" FOREIGN KEY ("clientCommitmentId") REFERENCES "ClientCommitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientCommitmentScenario" ADD CONSTRAINT "ClientCommitmentScenario_selectedTemplateId_fkey" FOREIGN KEY ("selectedTemplateId") REFERENCES "PMProjectionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
