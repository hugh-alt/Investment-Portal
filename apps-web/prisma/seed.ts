import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Role, TaxonomyNodeType } from "../src/generated/prisma/enums";
import { seedHoldings } from "./seed-holdings";
import { seedMappings } from "./seed-mappings";
import { seedSAA } from "./seed-saa";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CLIENT_NAMES = [
  "Alice Johnson",
  "Bob Williams",
  "Carol Davis",
  "David Martinez",
  "Emily Chen",
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "mcchugh@gmail.com" },
    update: {},
    create: {
      email: "mcchugh@gmail.com",
      name: "Hugh McCaffery",
      role: Role.ADMIN,
    },
  });

  const adviser = await prisma.adviser.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      firmName: "Demo Advice Co",
    },
  });

  for (const name of CLIENT_NAMES) {
    await prisma.client.upsert({
      where: { id: `seed-${name.toLowerCase().replace(/\s/g, "-")}` },
      update: {},
      create: {
        id: `seed-${name.toLowerCase().replace(/\s/g, "-")}`,
        adviserId: adviser.id,
        name,
      },
    });
  }

  // ── Default Taxonomy ──
  const existingTaxonomy = await prisma.taxonomy.findFirst({
    where: { name: "Default SAA Taxonomy" },
  });
  if (!existingTaxonomy) {
    await prisma.taxonomy.create({
      data: {
        name: "Default SAA Taxonomy",
        description: "Standard risk-bucket classification",
        createdByUserId: user.id,
        nodes: {
          create: [
            { name: "Growth", nodeType: TaxonomyNodeType.RISK, sortOrder: 0 },
            { name: "Defensive", nodeType: TaxonomyNodeType.RISK, sortOrder: 1 },
          ],
        },
      },
    });
  }

  // ── Cleanup: remove any leftover LIQUIDITY nodes ──
  const deleted = await prisma.taxonomyNode.deleteMany({
    where: { nodeType: TaxonomyNodeType.LIQUIDITY },
  });
  if (deleted.count > 0) {
    console.log(`Cleaned up ${deleted.count} LIQUIDITY node(s)`);
  }

  // ── Platform holdings ──
  const clientIds = CLIENT_NAMES.map(
    (name) => `seed-${name.toLowerCase().replace(/\s/g, "-")}`,
  );
  await seedHoldings(prisma, clientIds);

  // ── Taxonomy mappings ──
  await seedMappings(prisma);

  // ── SAA ──
  await seedSAA(prisma, adviser.id, clientIds);

  console.log("Seeded: admin, adviser, 5 clients, taxonomy, holdings, mappings, SAAs");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
