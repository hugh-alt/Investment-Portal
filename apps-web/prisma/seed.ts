import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Role, TaxonomyNodeType } from "../src/generated/prisma/enums";
import { seedHoldings } from "./seed-holdings";
import { seedMappings } from "./seed-mappings";
import { seedSAA } from "./seed-saa";
import { seedPM } from "./seed-pm";
import { seedStress } from "./seed-stress";
import { seedCMA } from "./seed-cma";
import { seedRebalance } from "./seed-rebalance";
import { seedLiquidityProfiles } from "./seed-liquidity-profiles";

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
  // ── Demo users ──

  // 1. SUPER_ADMIN — platform owner
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@reachalts.com.au" },
    update: { role: Role.SUPER_ADMIN },
    create: {
      email: "superadmin@reachalts.com.au",
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
    },
  });

  // 2. ADMIN — wealth group admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@reachalts.com.au" },
    update: { role: Role.ADMIN },
    create: {
      email: "admin@reachalts.com.au",
      name: "Wealth Group Admin",
      role: Role.ADMIN,
    },
  });

  // 3. ADVISER — financial adviser
  const adviserUser = await prisma.user.upsert({
    where: { email: "adviser@reachalts.com.au" },
    update: { role: Role.ADVISER },
    create: {
      email: "adviser@reachalts.com.au",
      name: "Demo Adviser",
      role: Role.ADVISER,
    },
  });

  // 4. ADMIN (dual-role demo) — has admin privileges + adviser profile
  const adminAdviser = await prisma.user.upsert({
    where: { email: "adminadviser@reachalts.com.au" },
    update: { role: Role.ADMIN },
    create: {
      email: "adminadviser@reachalts.com.au",
      name: "Admin Adviser",
      role: Role.ADMIN,
    },
  });

  // ── Adviser profiles ──

  // Primary adviser (linked to clients)
  const adviser = await prisma.adviser.upsert({
    where: { userId: adviserUser.id },
    update: {},
    create: {
      userId: adviserUser.id,
      firmName: "ReachAlts Advisory",
    },
  });

  // Clean up old demo user if present
  const oldUser = await prisma.user.findUnique({ where: { email: "mcchugh@gmail.com" } });
  if (oldUser) {
    await prisma.taxonomy.updateMany({
      where: { createdByUserId: oldUser.id },
      data: { createdByUserId: superAdmin.id },
    });
    const oldAdviser = await prisma.adviser.findUnique({ where: { userId: oldUser.id } });
    if (oldAdviser) {
      // Reassign clients to the new adviser, then remove old adviser + SAAs
      await prisma.client.updateMany({
        where: { adviserId: oldAdviser.id },
        data: { adviserId: adviser.id },
      });
      await prisma.sAA.updateMany({
        where: { adviserId: oldAdviser.id },
        data: { adviserId: adviser.id },
      });
      await prisma.adviser.delete({ where: { id: oldAdviser.id } });
    }
    await prisma.user.delete({ where: { id: oldUser.id } });
  }

  // Admin-adviser also gets an adviser profile for demo
  const adviserForAdmin = await prisma.adviser.upsert({
    where: { userId: adminAdviser.id },
    update: {},
    create: {
      userId: adminAdviser.id,
      firmName: "ReachAlts Advisory",
    },
  });

  // ── Clients (linked to the primary adviser) ──

  for (const name of CLIENT_NAMES) {
    await prisma.client.upsert({
      where: { id: `seed-${name.toLowerCase().replace(/\s/g, "-")}` },
      update: { adviserId: adviser.id },
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
        createdByUserId: superAdmin.id,
        nodes: {
          create: [
            { name: "Growth", nodeType: TaxonomyNodeType.RISK, sortOrder: 0 },
            { name: "Defensive", nodeType: TaxonomyNodeType.RISK, sortOrder: 1 },
          ],
        },
      },
    });
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

  // ── Private Markets ──
  await seedPM(prisma, clientIds, adviserUser.id);

  // ── Stress Tests ──
  await seedStress(prisma, admin.id);

  // ── CMA ──
  await seedCMA(prisma, admin.id);

  // ── Rebalance (CLIENT_APPROVED plan for demo) ──
  await seedRebalance(prisma, clientIds[0], adviserUser.id);

  // ── Liquidity Profiles ──
  await seedLiquidityProfiles(prisma);

  console.log("Seeded 4 demo users:");
  console.log("  SUPER_ADMIN : superadmin@reachalts.com.au");
  console.log("  ADMIN       : admin@reachalts.com.au");
  console.log("  ADVISER     : adviser@reachalts.com.au");
  console.log("  ADMIN+Adviser: adminadviser@reachalts.com.au");
  console.log("Plus 5 clients, taxonomy, holdings, mappings, SAAs, PM funds + sleeves, stress tests, CMA, rebalance, liquidity profiles");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
