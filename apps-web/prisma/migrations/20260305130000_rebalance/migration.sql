-- CreateEnum
CREATE TYPE "RebalanceStatus" AS ENUM ('DRAFT', 'ADVISER_APPROVED', 'CLIENT_APPROVED', 'REJECTED');
CREATE TYPE "RebalanceSide" AS ENUM ('BUY', 'SELL');
CREATE TYPE "RebalanceApprovalAction" AS ENUM ('APPROVE', 'REJECT');

-- CreateTable
CREATE TABLE "RebalancePlan" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "saaId" TEXT NOT NULL,
    "status" "RebalanceStatus" NOT NULL DEFAULT 'DRAFT',
    "summaryJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RebalancePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RebalanceTrade" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "side" "RebalanceSide" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "RebalanceTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RebalanceApprovalEvent" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "action" "RebalanceApprovalAction" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RebalanceApprovalEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RebalancePlan" ADD CONSTRAINT "RebalancePlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RebalancePlan" ADD CONSTRAINT "RebalancePlan_saaId_fkey" FOREIGN KEY ("saaId") REFERENCES "SAA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebalanceTrade" ADD CONSTRAINT "RebalanceTrade_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RebalancePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RebalanceTrade" ADD CONSTRAINT "RebalanceTrade_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebalanceApprovalEvent" ADD CONSTRAINT "RebalanceApprovalEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RebalancePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
