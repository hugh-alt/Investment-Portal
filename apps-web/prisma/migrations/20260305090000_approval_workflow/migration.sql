-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'ADVISER_APPROVED', 'CLIENT_APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('APPROVE', 'REJECT');

-- AlterTable: add approval fields to SleeveRecommendation
ALTER TABLE "SleeveRecommendation" ADD COLUMN "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "SleeveRecommendation" ADD COLUMN "adviserApprovedAt" TIMESTAMP(3);
ALTER TABLE "SleeveRecommendation" ADD COLUMN "clientApprovedAt" TIMESTAMP(3);
ALTER TABLE "SleeveRecommendation" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "SleeveRecommendation" ADD COLUMN "rejectionReason" TEXT;

-- CreateTable
CREATE TABLE "ApprovalEvent" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ApprovalEvent" ADD CONSTRAINT "ApprovalEvent_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "SleeveRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
