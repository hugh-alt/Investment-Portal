-- PMFundApproval: Add wealthGroupId, change unique constraint from fundId to (wealthGroupId, fundId)
ALTER TABLE "PMFundApproval" DROP CONSTRAINT IF EXISTS "PMFundApproval_fundId_key";
ALTER TABLE "PMFundApproval" ADD COLUMN "wealthGroupId" TEXT;
ALTER TABLE "PMFundApproval" ADD CONSTRAINT "PMFundApproval_wealthGroupId_fundId_key" UNIQUE ("wealthGroupId", "fundId");
ALTER TABLE "PMFundApproval" ADD CONSTRAINT "PMFundApproval_wealthGroupId_fkey" FOREIGN KEY ("wealthGroupId") REFERENCES "WealthGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TaxonomyLiquidityDefault: Add wealthGroupId, change unique from taxonomyNodeId to (taxonomyNodeId, wealthGroupId)
ALTER TABLE "TaxonomyLiquidityDefault" DROP CONSTRAINT IF EXISTS "TaxonomyLiquidityDefault_taxonomyNodeId_key";
ALTER TABLE "TaxonomyLiquidityDefault" ADD COLUMN "wealthGroupId" TEXT;
ALTER TABLE "TaxonomyLiquidityDefault" ADD CONSTRAINT "TaxonomyLiquidityDefault_taxonomyNodeId_wealthGroupId_key" UNIQUE ("taxonomyNodeId", "wealthGroupId");
ALTER TABLE "TaxonomyLiquidityDefault" ADD CONSTRAINT "TaxonomyLiquidityDefault_wealthGroupId_fkey" FOREIGN KEY ("wealthGroupId") REFERENCES "WealthGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
