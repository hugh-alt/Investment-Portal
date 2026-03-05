-- CreateEnum
CREATE TYPE "SAAScope" AS ENUM ('FIRM', 'ADVISER');

-- CreateTable
CREATE TABLE "SAA" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,
    "ownerScope" "SAAScope" NOT NULL DEFAULT 'ADVISER',
    "adviserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SAA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SAAAllocation" (
    "id" TEXT NOT NULL,
    "saaId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "targetWeight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SAAAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSAA" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "saaId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientSAA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SAAAllocation_saaId_nodeId_key" ON "SAAAllocation"("saaId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientSAA_clientId_key" ON "ClientSAA"("clientId");

-- AddForeignKey
ALTER TABLE "SAA" ADD CONSTRAINT "SAA_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "Taxonomy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SAA" ADD CONSTRAINT "SAA_adviserId_fkey" FOREIGN KEY ("adviserId") REFERENCES "Adviser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SAAAllocation" ADD CONSTRAINT "SAAAllocation_saaId_fkey" FOREIGN KEY ("saaId") REFERENCES "SAA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SAAAllocation" ADD CONSTRAINT "SAAAllocation_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "TaxonomyNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSAA" ADD CONSTRAINT "ClientSAA_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSAA" ADD CONSTRAINT "ClientSAA_saaId_fkey" FOREIGN KEY ("saaId") REFERENCES "SAA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
