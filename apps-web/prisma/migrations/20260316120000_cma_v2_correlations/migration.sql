-- CMA v2: Correlation matrix for portfolio volatility
CREATE TABLE "CMACorrelation" (
    "id" TEXT NOT NULL,
    "cmaSetId" TEXT NOT NULL,
    "nodeIdA" TEXT NOT NULL,
    "nodeIdB" TEXT NOT NULL,
    "corr" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CMACorrelation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CMACorrelation_cmaSetId_idx" ON "CMACorrelation"("cmaSetId");
CREATE UNIQUE INDEX "CMACorrelation_cmaSetId_nodeIdA_nodeIdB_key" ON "CMACorrelation"("cmaSetId", "nodeIdA", "nodeIdB");

ALTER TABLE "CMACorrelation" ADD CONSTRAINT "CMACorrelation_cmaSetId_fkey" FOREIGN KEY ("cmaSetId") REFERENCES "CMASet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
