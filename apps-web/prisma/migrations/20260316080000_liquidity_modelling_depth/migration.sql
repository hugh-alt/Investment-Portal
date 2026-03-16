-- AlterTable: Add gatePeriodDays to LiquidityProfile
ALTER TABLE "LiquidityProfile" ADD COLUMN "gatePeriodDays" INTEGER;

-- CreateTable: AdviserLiquidityOverride
CREATE TABLE "AdviserLiquidityOverride" (
    "id" TEXT NOT NULL,
    "adviserId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "liquidityProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdviserLiquidityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdviserLiquidityOverride_adviserId_productId_key" ON "AdviserLiquidityOverride"("adviserId", "productId");

-- AddForeignKey
ALTER TABLE "AdviserLiquidityOverride" ADD CONSTRAINT "AdviserLiquidityOverride_adviserId_fkey" FOREIGN KEY ("adviserId") REFERENCES "Adviser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdviserLiquidityOverride" ADD CONSTRAINT "AdviserLiquidityOverride_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdviserLiquidityOverride" ADD CONSTRAINT "AdviserLiquidityOverride_liquidityProfileId_fkey" FOREIGN KEY ("liquidityProfileId") REFERENCES "LiquidityProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
