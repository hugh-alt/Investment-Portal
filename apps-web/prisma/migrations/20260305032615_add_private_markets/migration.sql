-- CreateEnum
CREATE TYPE "PMFundStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "PMFund" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vintageYear" INTEGER,
    "strategy" TEXT,
    "currency" TEXT DEFAULT 'AUD',
    "status" "PMFundStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PMFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PMFundProfile" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "projectedCallsJson" TEXT NOT NULL,
    "projectedDistributionsJson" TEXT NOT NULL,

    CONSTRAINT "PMFundProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PMFundApproval" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PMFundApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSleeve" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetPct" DOUBLE PRECISION,
    "cashBufferPct" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientSleeve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCommitment" (
    "id" TEXT NOT NULL,
    "clientSleeveId" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "commitmentAmount" DOUBLE PRECISION NOT NULL,
    "fundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "navAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "distributionsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleeveLiquidPosition" (
    "id" TEXT NOT NULL,
    "clientSleeveId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "marketValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SleeveLiquidPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PMFundProfile_fundId_key" ON "PMFundProfile"("fundId");

-- CreateIndex
CREATE UNIQUE INDEX "PMFundApproval_fundId_key" ON "PMFundApproval"("fundId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientSleeve_clientId_key" ON "ClientSleeve"("clientId");

-- AddForeignKey
ALTER TABLE "PMFundProfile" ADD CONSTRAINT "PMFundProfile_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "PMFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PMFundApproval" ADD CONSTRAINT "PMFundApproval_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "PMFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSleeve" ADD CONSTRAINT "ClientSleeve_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommitment" ADD CONSTRAINT "ClientCommitment_clientSleeveId_fkey" FOREIGN KEY ("clientSleeveId") REFERENCES "ClientSleeve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommitment" ADD CONSTRAINT "ClientCommitment_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "PMFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleeveLiquidPosition" ADD CONSTRAINT "SleeveLiquidPosition_clientSleeveId_fkey" FOREIGN KEY ("clientSleeveId") REFERENCES "ClientSleeve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleeveLiquidPosition" ADD CONSTRAINT "SleeveLiquidPosition_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
