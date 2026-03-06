-- CreateTable
CREATE TABLE "LiquidityStressScenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquidityStressScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidityStressRule" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "extraCashDemandPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extraCashDemandAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "LiquidityStressRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidityStressRun" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "runByUserId" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquidityStressRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidityStressResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "availableLiquidity" DOUBLE PRECISION NOT NULL,
    "requiredLiquidity" DOUBLE PRECISION NOT NULL,
    "coverageRatio" DOUBLE PRECISION NOT NULL,
    "shortfall" DOUBLE PRECISION NOT NULL,
    "detailsJson" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "LiquidityStressResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiquidityStressRule_scenarioId_horizonDays_key" ON "LiquidityStressRule"("scenarioId", "horizonDays");

-- CreateIndex
CREATE INDEX "LiquidityStressResult_runId_clientId_idx" ON "LiquidityStressResult"("runId", "clientId");

-- AddForeignKey
ALTER TABLE "LiquidityStressScenario" ADD CONSTRAINT "LiquidityStressScenario_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityStressRule" ADD CONSTRAINT "LiquidityStressRule_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "LiquidityStressScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityStressRun" ADD CONSTRAINT "LiquidityStressRun_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "LiquidityStressScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityStressRun" ADD CONSTRAINT "LiquidityStressRun_runByUserId_fkey" FOREIGN KEY ("runByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityStressResult" ADD CONSTRAINT "LiquidityStressResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LiquidityStressRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityStressResult" ADD CONSTRAINT "LiquidityStressResult_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
