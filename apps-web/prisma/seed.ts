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
import { seedLiquidityStress } from "./seed-liquidity-stress";

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
  // ── Wealth Groups ──
  const wg1 = await prisma.wealthGroup.upsert({
    where: { id: "wg-demo-advice-co" },
    update: {},
    create: { id: "wg-demo-advice-co", name: "Demo Advice Co" },
  });

  const wg2 = await prisma.wealthGroup.upsert({
    where: { id: "wg-second-demo" },
    update: {},
    create: { id: "wg-second-demo", name: "Second Demo Group" },
  });

  // ── Demo users ──

  // 1. SUPER_ADMIN — platform owner (no wealth group)
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@reachalts.com.au" },
    update: { role: Role.SUPER_ADMIN, wealthGroupId: null },
    create: {
      email: "superadmin@reachalts.com.au",
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
      wealthGroupId: null,
    },
  });

  // 2. ADMIN — Demo Advice Co
  const admin = await prisma.user.upsert({
    where: { email: "admin@reachalts.com.au" },
    update: { role: Role.ADMIN, wealthGroupId: wg1.id },
    create: {
      email: "admin@reachalts.com.au",
      name: "Wealth Group Admin",
      role: Role.ADMIN,
      wealthGroupId: wg1.id,
    },
  });

  // 3. ADVISER — Demo Advice Co
  const adviserUser = await prisma.user.upsert({
    where: { email: "adviser@reachalts.com.au" },
    update: { role: Role.ADVISER, wealthGroupId: wg1.id },
    create: {
      email: "adviser@reachalts.com.au",
      name: "Demo Adviser",
      role: Role.ADVISER,
      wealthGroupId: wg1.id,
    },
  });

  // 4. ADMIN (dual-role demo) — Demo Advice Co
  const adminAdviser = await prisma.user.upsert({
    where: { email: "adminadviser@reachalts.com.au" },
    update: { role: Role.ADMIN, wealthGroupId: wg1.id },
    create: {
      email: "adminadviser@reachalts.com.au",
      name: "Admin Adviser",
      role: Role.ADMIN,
      wealthGroupId: wg1.id,
    },
  });

  // 5. ADMIN for Second Demo Group
  const admin2 = await prisma.user.upsert({
    where: { email: "admin2@reachalts.com.au" },
    update: { role: Role.ADMIN, wealthGroupId: wg2.id },
    create: {
      email: "admin2@reachalts.com.au",
      name: "Second Group Admin",
      role: Role.ADMIN,
      wealthGroupId: wg2.id,
    },
  });

  // 6. ADVISER for Second Demo Group
  const adviser2User = await prisma.user.upsert({
    where: { email: "adviser2@reachalts.com.au" },
    update: { role: Role.ADVISER, wealthGroupId: wg2.id },
    create: {
      email: "adviser2@reachalts.com.au",
      name: "Second Group Adviser",
      role: Role.ADVISER,
      wealthGroupId: wg2.id,
    },
  });

  // ── Adviser profiles ──

  // Primary adviser (Demo Advice Co)
  const adviser = await prisma.adviser.upsert({
    where: { userId: adviserUser.id },
    update: { wealthGroupId: wg1.id },
    create: {
      userId: adviserUser.id,
      firmName: "Demo Advice Co",
      wealthGroupId: wg1.id,
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

  // Admin-adviser also gets an adviser profile (Demo Advice Co)
  await prisma.adviser.upsert({
    where: { userId: adminAdviser.id },
    update: { wealthGroupId: wg1.id },
    create: {
      userId: adminAdviser.id,
      firmName: "Demo Advice Co",
      wealthGroupId: wg1.id,
    },
  });

  // Adviser for Second Demo Group
  const adviser2 = await prisma.adviser.upsert({
    where: { userId: adviser2User.id },
    update: { wealthGroupId: wg2.id },
    create: {
      userId: adviser2User.id,
      firmName: "Second Demo Group",
      wealthGroupId: wg2.id,
    },
  });

  // ── Clients (Demo Advice Co) ──
  for (const name of CLIENT_NAMES) {
    await prisma.client.upsert({
      where: { id: `seed-${name.toLowerCase().replace(/\s/g, "-")}` },
      update: { adviserId: adviser.id, wealthGroupId: wg1.id },
      create: {
        id: `seed-${name.toLowerCase().replace(/\s/g, "-")}`,
        adviserId: adviser.id,
        wealthGroupId: wg1.id,
        name,
      },
    });
  }

  // ── Client for Second Demo Group ──
  await prisma.client.upsert({
    where: { id: "seed-frank-second" },
    update: { adviserId: adviser2.id, wealthGroupId: wg2.id },
    create: {
      id: "seed-frank-second",
      adviserId: adviser2.id,
      wealthGroupId: wg2.id,
      name: "Frank Thompson",
    },
  });

  // ── Default Taxonomy (scoped to Demo Advice Co) ──
  const existingTaxonomy = await prisma.taxonomy.findFirst({
    where: { name: "Default SAA Taxonomy" },
  });
  if (!existingTaxonomy) {
    await prisma.taxonomy.create({
      data: {
        name: "Default SAA Taxonomy",
        description: "Standard risk-bucket classification",
        wealthGroupId: wg1.id,
        createdByUserId: superAdmin.id,
        nodes: {
          create: [
            { name: "Growth", nodeType: TaxonomyNodeType.RISK, sortOrder: 0 },
            { name: "Defensive", nodeType: TaxonomyNodeType.RISK, sortOrder: 1 },
          ],
        },
      },
    });
  } else if (!existingTaxonomy.wealthGroupId) {
    await prisma.taxonomy.update({
      where: { id: existingTaxonomy.id },
      data: { wealthGroupId: wg1.id },
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

  // ── CMA (scoped to Demo Advice Co) ──
  await seedCMA(prisma, admin.id, wg1.id);

  // ── Rebalance (CLIENT_APPROVED plan for demo) ──
  await seedRebalance(prisma, clientIds[0], adviserUser.id);

  // ── Liquidity Profiles ──
  await seedLiquidityProfiles(prisma);

  // ── Liquidity Stress Scenarios ──
  await seedLiquidityStress(prisma, admin.id);

  console.log("Seeded 2 wealth groups:");
  console.log("  Demo Advice Co    (primary)");
  console.log("  Second Demo Group (secondary)");
  console.log("");
  console.log("Seeded 6 demo users:");
  console.log("  SUPER_ADMIN  : superadmin@reachalts.com.au  (no group - platform-wide)");
  console.log("  ADMIN        : admin@reachalts.com.au       (Demo Advice Co)");
  console.log("  ADVISER      : adviser@reachalts.com.au     (Demo Advice Co)");
  console.log("  ADMIN+Adviser: adminadviser@reachalts.com.au (Demo Advice Co)");
  console.log("  ADMIN        : admin2@reachalts.com.au      (Second Demo Group)");
  console.log("  ADVISER      : adviser2@reachalts.com.au    (Second Demo Group)");
  console.log("");
  console.log("Plus 5 clients (Demo Advice Co), 1 client (Second Demo Group), taxonomy, holdings, mappings, SAAs, PM funds + sleeves, stress tests, CMA, rebalance, liquidity profiles");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
