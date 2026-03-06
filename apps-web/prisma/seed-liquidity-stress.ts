/**
 * Seeds liquidity stress scenarios with rules.
 */
import { PrismaClient } from "../src/generated/prisma/client";

export async function seedLiquidityStress(prisma: PrismaClient, adminUserId: string) {
  // Clean up
  await prisma.liquidityStressResult.deleteMany({});
  await prisma.liquidityStressRun.deleteMany({});
  await prisma.liquidityStressRule.deleteMany({});
  await prisma.liquidityStressScenario.deleteMany({});

  // Scenario 1: Base case — PM calls + buffer only, no extra shock
  await prisma.liquidityStressScenario.create({
    data: {
      name: "PM Calls + Buffer (Base)",
      description: "Stress test against PM projected calls and sleeve buffer requirements only",
      isDefault: true,
      createdByUserId: adminUserId,
      rules: {
        create: [
          { horizonDays: 30, extraCashDemandPct: 0, extraCashDemandAmount: 0 },
          { horizonDays: 90, extraCashDemandPct: 0, extraCashDemandAmount: 0 },
          { horizonDays: 365, extraCashDemandPct: 0, extraCashDemandAmount: 0 },
        ],
      },
    },
  });

  // Scenario 2: Withdrawal shock — 5% of portfolio at 30d, 10% at 90d
  await prisma.liquidityStressScenario.create({
    data: {
      name: "Withdrawal Shock",
      description: "PM calls + buffer + sudden client withdrawal demand (5% at 30d, 10% at 90d)",
      isDefault: false,
      createdByUserId: adminUserId,
      rules: {
        create: [
          { horizonDays: 30, extraCashDemandPct: 0.05, extraCashDemandAmount: 0 },
          { horizonDays: 90, extraCashDemandPct: 0.10, extraCashDemandAmount: 0 },
          { horizonDays: 365, extraCashDemandPct: 0.10, extraCashDemandAmount: 0 },
        ],
      },
    },
  });

  console.log("Created 2 liquidity stress scenarios (1 default + 1 withdrawal shock)");
}
