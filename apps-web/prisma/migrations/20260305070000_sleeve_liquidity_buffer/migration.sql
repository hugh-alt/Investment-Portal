-- CreateEnum
CREATE TYPE "BufferMethod" AS ENUM ('VS_UNFUNDED_PCT', 'VS_PROJECTED_CALLS');
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARN', 'CRITICAL');

-- AlterTable: ClientSleeve - add buffer config
ALTER TABLE "ClientSleeve" ADD COLUMN "bufferMethod" "BufferMethod" NOT NULL DEFAULT 'VS_UNFUNDED_PCT';
ALTER TABLE "ClientSleeve" ADD COLUMN "bufferPctOfUnfunded" DOUBLE PRECISION NOT NULL DEFAULT 0.10;
ALTER TABLE "ClientSleeve" ADD COLUMN "bufferMonthsForward" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "ClientSleeve" ADD COLUMN "alertEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: SleeveAlert
CREATE TABLE "SleeveAlert" (
    "id" TEXT NOT NULL,
    "clientSleeveId" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SleeveAlert_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SleeveAlert" ADD CONSTRAINT "SleeveAlert_clientSleeveId_fkey" FOREIGN KEY ("clientSleeveId") REFERENCES "ClientSleeve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
