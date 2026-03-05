-- CreateEnum
CREATE TYPE "RecommendationKind" AS ENUM ('RAISE_LIQUIDITY', 'INVEST_EXCESS');
CREATE TYPE "RecommendationAction" AS ENUM ('SELL', 'BUY');

-- AlterTable: ClientSleeve - add waterfall config
ALTER TABLE "ClientSleeve" ADD COLUMN "sellWaterfallJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ClientSleeve" ADD COLUMN "buyWaterfallJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ClientSleeve" ADD COLUMN "minTradeAmount" DOUBLE PRECISION NOT NULL DEFAULT 1000;

-- CreateTable: SleeveRecommendation
CREATE TABLE "SleeveRecommendation" (
    "id" TEXT NOT NULL,
    "clientSleeveId" TEXT NOT NULL,
    "kind" "RecommendationKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SleeveRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SleeveRecommendationLeg
CREATE TABLE "SleeveRecommendationLeg" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "action" "RecommendationAction" NOT NULL,
    "productId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "SleeveRecommendationLeg_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SleeveRecommendation" ADD CONSTRAINT "SleeveRecommendation_clientSleeveId_fkey" FOREIGN KEY ("clientSleeveId") REFERENCES "ClientSleeve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SleeveRecommendationLeg" ADD CONSTRAINT "SleeveRecommendationLeg_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "SleeveRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SleeveRecommendationLeg" ADD CONSTRAINT "SleeveRecommendationLeg_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
