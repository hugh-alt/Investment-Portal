-- CreateTable
CREATE TABLE "CMASet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CMASet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CMAAssumption" (
    "id" TEXT NOT NULL,
    "cmaSetId" TEXT NOT NULL,
    "taxonomyNodeId" TEXT NOT NULL,
    "expReturnPct" DOUBLE PRECISION NOT NULL,
    "volPct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CMAAssumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CMAAssumption_cmaSetId_taxonomyNodeId_key" ON "CMAAssumption"("cmaSetId", "taxonomyNodeId");

-- AddForeignKey
ALTER TABLE "CMASet" ADD CONSTRAINT "CMASet_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CMAAssumption" ADD CONSTRAINT "CMAAssumption_cmaSetId_fkey" FOREIGN KEY ("cmaSetId") REFERENCES "CMASet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CMAAssumption" ADD CONSTRAINT "CMAAssumption_taxonomyNodeId_fkey" FOREIGN KEY ("taxonomyNodeId") REFERENCES "TaxonomyNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
