-- CreateEnum
CREATE TYPE "CMASetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- AlterTable: add status, effectiveDate, updatedAt to CMASet
ALTER TABLE "CMASet" ADD COLUMN "status" "CMASetStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "CMASet" ADD COLUMN "effectiveDate" TIMESTAMP(3);
ALTER TABLE "CMASet" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable: ClientCMASelection
CREATE TABLE "ClientCMASelection" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "cmaSetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientCMASelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientCMASelection_clientId_key" ON "ClientCMASelection"("clientId");

-- AddForeignKey
ALTER TABLE "ClientCMASelection" ADD CONSTRAINT "ClientCMASelection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCMASelection" ADD CONSTRAINT "ClientCMASelection_cmaSetId_fkey" FOREIGN KEY ("cmaSetId") REFERENCES "CMASet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
