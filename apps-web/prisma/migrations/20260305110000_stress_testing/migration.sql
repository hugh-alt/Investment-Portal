-- CreateTable
CREATE TABLE "StressScenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StressScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StressShock" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "taxonomyNodeId" TEXT NOT NULL,
    "shockPct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StressShock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StressRun" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "runByUserId" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StressRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StressResult" (
    "id" TEXT NOT NULL,
    "stressRunId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "estimatedImpactPct" DOUBLE PRECISION NOT NULL,
    "detailsJson" TEXT NOT NULL,

    CONSTRAINT "StressResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StressShock_scenarioId_taxonomyNodeId_key" ON "StressShock"("scenarioId", "taxonomyNodeId");

-- AddForeignKey
ALTER TABLE "StressScenario" ADD CONSTRAINT "StressScenario_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StressShock" ADD CONSTRAINT "StressShock_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "StressScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StressShock" ADD CONSTRAINT "StressShock_taxonomyNodeId_fkey" FOREIGN KEY ("taxonomyNodeId") REFERENCES "TaxonomyNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StressRun" ADD CONSTRAINT "StressRun_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "StressScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StressRun" ADD CONSTRAINT "StressRun_runByUserId_fkey" FOREIGN KEY ("runByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StressResult" ADD CONSTRAINT "StressResult_stressRunId_fkey" FOREIGN KEY ("stressRunId") REFERENCES "StressRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StressResult" ADD CONSTRAINT "StressResult_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
