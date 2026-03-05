-- CreateEnum
CREATE TYPE "LiquidityTier" AS ENUM ('LISTED', 'FUND_LIQUID', 'FUND_SEMI_LIQUID', 'PRIVATE', 'LOCKED');

-- CreateEnum
CREATE TYPE "LiquidityOverrideSource" AS ENUM ('PLATFORM_SUPER_ADMIN');

-- CreateTable
CREATE TABLE "LiquidityProfile" (
    "id" TEXT NOT NULL,
    "tier" "LiquidityTier" NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "stressedHaircutPct" DOUBLE PRECISION NOT NULL,
    "noticeDays" INTEGER,
    "redeemFrequency" TEXT,
    "gatePctPerPeriod" DOUBLE PRECISION,
    "lockupEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquidityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxonomyLiquidityDefault" (
    "id" TEXT NOT NULL,
    "taxonomyNodeId" TEXT NOT NULL,
    "liquidityProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxonomyLiquidityDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductLiquidityOverride" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "liquidityProfileId" TEXT NOT NULL,
    "source" "LiquidityOverrideSource" NOT NULL DEFAULT 'PLATFORM_SUPER_ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductLiquidityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyLiquidityDefault_taxonomyNodeId_key" ON "TaxonomyLiquidityDefault"("taxonomyNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductLiquidityOverride_productId_key" ON "ProductLiquidityOverride"("productId");

-- AddForeignKey
ALTER TABLE "TaxonomyLiquidityDefault" ADD CONSTRAINT "TaxonomyLiquidityDefault_taxonomyNodeId_fkey" FOREIGN KEY ("taxonomyNodeId") REFERENCES "TaxonomyNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxonomyLiquidityDefault" ADD CONSTRAINT "TaxonomyLiquidityDefault_liquidityProfileId_fkey" FOREIGN KEY ("liquidityProfileId") REFERENCES "LiquidityProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLiquidityOverride" ADD CONSTRAINT "ProductLiquidityOverride_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLiquidityOverride" ADD CONSTRAINT "ProductLiquidityOverride_liquidityProfileId_fkey" FOREIGN KEY ("liquidityProfileId") REFERENCES "LiquidityProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
