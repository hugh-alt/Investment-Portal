import { PrismaClient } from "../src/generated/prisma/client";
import { PMFundStatus, LifecycleStage } from "../src/generated/prisma/enums";

const PM_FUNDS = [
  { id: "pmf-infra", name: "Macquarie Infrastructure Fund V", vintageYear: 2023, strategy: "Infrastructure", currency: "AUD", status: PMFundStatus.OPEN, lifecycleStage: LifecycleStage.INVESTING, firstCloseDate: new Date("2023-03-15"), investmentPeriodMonths: 48, fundTermMonths: 120 },
  { id: "pmf-pe1", name: "Pacific Equity Partners Fund VII", vintageYear: 2024, strategy: "Buyout", currency: "AUD", status: PMFundStatus.OPEN, lifecycleStage: LifecycleStage.INVESTING, firstCloseDate: new Date("2024-01-10"), investmentPeriodMonths: 60, fundTermMonths: 120 },
  { id: "pmf-vc1", name: "Blackbird Ventures Fund IV", vintageYear: 2022, strategy: "Venture Capital", currency: "AUD", status: PMFundStatus.OPEN, lifecycleStage: LifecycleStage.HARVESTING, firstCloseDate: new Date("2022-06-01"), investmentPeriodMonths: 36, fundTermMonths: 100 },
  { id: "pmf-re1", name: "Charter Hall Prime Industrial Fund", vintageYear: 2023, strategy: "Real Estate", currency: "AUD", status: PMFundStatus.OPEN, lifecycleStage: LifecycleStage.INVESTING, firstCloseDate: new Date("2023-09-01"), investmentPeriodMonths: 48, fundTermMonths: 120 },
  { id: "pmf-credit", name: "Metrics Credit Partners Fund III", vintageYear: 2024, strategy: "Private Credit", currency: "AUD", status: PMFundStatus.OPEN, lifecycleStage: LifecycleStage.INVESTING, firstCloseDate: new Date("2024-06-15"), investmentPeriodMonths: 36, fundTermMonths: 84 },
  { id: "pmf-pe2", name: "BGH Capital Fund II", vintageYear: 2021, strategy: "Buyout", currency: "AUD", status: PMFundStatus.CLOSED, lifecycleStage: LifecycleStage.HARVESTING, firstCloseDate: new Date("2021-02-01"), investmentPeriodMonths: 48, fundTermMonths: 120 },
  { id: "pmf-uspe", name: "KKR Americas Fund XIII", vintageYear: 2024, strategy: "Buyout", currency: "USD", status: PMFundStatus.OPEN, lifecycleStage: LifecycleStage.FUNDRAISING, firstCloseDate: new Date("2024-11-01"), investmentPeriodMonths: 60, fundTermMonths: 120 },
  { id: "pmf-usvc", name: "Sequoia Capital Fund XX", vintageYear: 2025, strategy: "Venture Capital", currency: "USD", status: PMFundStatus.OPEN, lifecycleStage: LifecycleStage.FUNDRAISING, firstCloseDate: null, investmentPeriodMonths: 48, fundTermMonths: 100 },
];

function monthsAhead(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Cumulative call % curves — shape depends on lifecycle stage
function callCurve(stage: LifecycleStage): { month: string; cumPct: number }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = monthsAhead(i + 1);
    let cumPct: number;
    switch (stage) {
      case LifecycleStage.FUNDRAISING:
        // Early: slow ramp up
        cumPct = i < 3 ? 0 : Math.min(0.15, (i - 2) * 0.03);
        break;
      case LifecycleStage.INVESTING:
        // Active calling: steady ramp
        cumPct = Math.min(0.80, (i + 1) * 0.07);
        break;
      case LifecycleStage.HARVESTING:
        // Mostly done calling
        cumPct = i < 2 ? (i + 1) * 0.02 : 0.04;
        break;
      case LifecycleStage.LIQUIDATING:
        cumPct = 0;
        break;
    }
    return { month, cumPct: Math.round(cumPct * 1000) / 1000 };
  });
}

// Cumulative dist % curves
function distCurve(stage: LifecycleStage): { month: string; cumPct: number }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = monthsAhead(i + 1);
    let cumPct: number;
    switch (stage) {
      case LifecycleStage.FUNDRAISING:
        cumPct = 0;
        break;
      case LifecycleStage.INVESTING:
        // Small distributions start mid-period
        cumPct = i < 6 ? 0 : Math.min(0.10, (i - 5) * 0.02);
        break;
      case LifecycleStage.HARVESTING:
        // Significant distributions
        cumPct = Math.min(0.50, (i + 1) * 0.04);
        break;
      case LifecycleStage.LIQUIDATING:
        cumPct = Math.min(0.80, (i + 1) * 0.08);
        break;
    }
    return { month, cumPct: Math.round(cumPct * 1000) / 1000 };
  });
}

export async function seedPM(prisma: PrismaClient, clientIds: string[]) {
  // Clean existing PM data for idempotency
  await prisma.sleeveLiquidPosition.deleteMany({});
  await prisma.clientCommitment.deleteMany({});
  await prisma.clientSleeve.deleteMany({});
  await prisma.pMFundProfile.deleteMany({});
  await prisma.pMFundApproval.deleteMany({});
  await prisma.pMFund.deleteMany({});

  // Create funds
  for (const f of PM_FUNDS) {
    await prisma.pMFund.create({
      data: {
        id: f.id,
        name: f.name,
        vintageYear: f.vintageYear,
        strategy: f.strategy,
        currency: f.currency,
        status: f.status,
        lifecycleStage: f.lifecycleStage,
        firstCloseDate: f.firstCloseDate,
        investmentPeriodMonths: f.investmentPeriodMonths,
        fundTermMonths: f.fundTermMonths,
      },
    });
  }

  // Approve first 6, leave last 2 unapproved
  for (let i = 0; i < PM_FUNDS.length; i++) {
    await prisma.pMFundApproval.create({
      data: {
        fundId: PM_FUNDS[i].id,
        isApproved: i < 6,
        notes: i < 6 ? "Approved by investment committee" : "Under review",
      },
    });
  }

  // Profiles for ALL funds with % curves
  for (const f of PM_FUNDS) {
    await prisma.pMFundProfile.create({
      data: {
        fundId: f.id,
        projectedCallPctCurveJson: JSON.stringify(callCurve(f.lifecycleStage)),
        projectedDistPctCurveJson: JSON.stringify(distCurve(f.lifecycleStage)),
      },
    });
  }

  // Create sleeves for first 2 clients
  if (clientIds.length < 2) return;

  // Client 1: Alice - mixed currency PM sleeve (AUD + USD)
  const sleeve1 = await prisma.clientSleeve.create({
    data: {
      clientId: clientIds[0],
      name: "Private Markets Allocation",
      targetPct: 0.15,
      cashBufferPct: 0.05,
    },
  });

  await prisma.clientCommitment.create({
    data: {
      clientSleeveId: sleeve1.id,
      fundId: "pmf-infra",
      commitmentAmount: 500000,
      fundedAmount: 200000,
      navAmount: 220000,
      distributionsAmount: 10000,
      latestNavDate: new Date("2026-02-28"),
    },
  });
  await prisma.clientCommitment.create({
    data: {
      clientSleeveId: sleeve1.id,
      fundId: "pmf-pe1",
      commitmentAmount: 300000,
      fundedAmount: 100000,
      navAmount: 105000,
      distributionsAmount: 0,
      latestNavDate: new Date("2026-02-28"),
    },
  });
  // USD commitment for Alice to trigger multi-currency display
  await prisma.clientCommitment.create({
    data: {
      clientSleeveId: sleeve1.id,
      fundId: "pmf-uspe",
      commitmentAmount: 250000,
      fundedAmount: 75000,
      navAmount: 80000,
      distributionsAmount: 0,
      latestNavDate: new Date("2026-01-31"),
    },
  });

  // Liquid positions for sleeve 1 using existing products
  await prisma.sleeveLiquidPosition.create({
    data: { clientSleeveId: sleeve1.id, productId: "prod-bhp", marketValue: 25000 },
  });
  await prisma.sleeveLiquidPosition.create({
    data: { clientSleeveId: sleeve1.id, productId: "prod-vgs", marketValue: 35000 },
  });

  // Client 2: Bob - single currency (AUD)
  const sleeve2 = await prisma.clientSleeve.create({
    data: {
      clientId: clientIds[1],
      name: "PM Sleeve",
      targetPct: 0.10,
      cashBufferPct: 0.03,
    },
  });

  await prisma.clientCommitment.create({
    data: {
      clientSleeveId: sleeve2.id,
      fundId: "pmf-vc1",
      commitmentAmount: 200000,
      fundedAmount: 150000,
      navAmount: 180000,
      distributionsAmount: 20000,
      latestNavDate: new Date("2026-02-28"),
    },
  });
  await prisma.clientCommitment.create({
    data: {
      clientSleeveId: sleeve2.id,
      fundId: "pmf-credit",
      commitmentAmount: 400000,
      fundedAmount: 400000,
      navAmount: 420000,
      distributionsAmount: 30000,
      latestNavDate: new Date("2026-02-28"),
    },
  });

  await prisma.sleeveLiquidPosition.create({
    data: { clientSleeveId: sleeve2.id, productId: "prod-vas", marketValue: 20000 },
  });
  await prisma.sleeveLiquidPosition.create({
    data: { clientSleeveId: sleeve2.id, productId: "prod-cba", marketValue: 15000 },
  });

  console.log("Created 8 PM funds with lifecycle stages + % curves, 2 client sleeves with commitments + liquid positions");
}
