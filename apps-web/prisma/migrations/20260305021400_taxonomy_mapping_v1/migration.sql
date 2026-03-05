-- CreateEnum
CREATE TYPE "MappingScope" AS ENUM ('FIRM_DEFAULT', 'ADVISER_OVERRIDE', 'CLIENT_OVERRIDE');

-- CreateTable
CREATE TABLE "ProductTaxonomyMap" (
    "id" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "scope" "MappingScope" NOT NULL DEFAULT 'FIRM_DEFAULT',
    "adviserId" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductTaxonomyMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductTaxonomyMap_taxonomyId_productId_scope_adviserId_cli_key" ON "ProductTaxonomyMap"("taxonomyId", "productId", "scope", "adviserId", "clientId");

-- AddForeignKey
ALTER TABLE "ProductTaxonomyMap" ADD CONSTRAINT "ProductTaxonomyMap_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "Taxonomy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTaxonomyMap" ADD CONSTRAINT "ProductTaxonomyMap_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTaxonomyMap" ADD CONSTRAINT "ProductTaxonomyMap_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "TaxonomyNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
