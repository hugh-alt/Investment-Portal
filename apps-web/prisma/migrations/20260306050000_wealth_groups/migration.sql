-- CreateTable
CREATE TABLE "WealthGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WealthGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN "wealthGroupId" TEXT;

-- AlterTable: Adviser
ALTER TABLE "Adviser" ADD COLUMN "wealthGroupId" TEXT;

-- AlterTable: Client
ALTER TABLE "Client" ADD COLUMN "wealthGroupId" TEXT;

-- AlterTable: Taxonomy
ALTER TABLE "Taxonomy" ADD COLUMN "wealthGroupId" TEXT;

-- AlterTable: CMASet
ALTER TABLE "CMASet" ADD COLUMN "wealthGroupId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_wealthGroupId_fkey" FOREIGN KEY ("wealthGroupId") REFERENCES "WealthGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adviser" ADD CONSTRAINT "Adviser_wealthGroupId_fkey" FOREIGN KEY ("wealthGroupId") REFERENCES "WealthGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_wealthGroupId_fkey" FOREIGN KEY ("wealthGroupId") REFERENCES "WealthGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Taxonomy" ADD CONSTRAINT "Taxonomy_wealthGroupId_fkey" FOREIGN KEY ("wealthGroupId") REFERENCES "WealthGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CMASet" ADD CONSTRAINT "CMASet_wealthGroupId_fkey" FOREIGN KEY ("wealthGroupId") REFERENCES "WealthGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
