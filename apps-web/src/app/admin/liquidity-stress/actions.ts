"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MappingScope } from "@/generated/prisma/enums";
import {
  computeClientStress,
  type StressRule,
  type PMCallInput,
  type BufferInput,
} from "@/lib/liquidity-stress";
import type {
  LiquidityProfileData,
  ProductMapping as LPProductMapping,
  TaxonomyNode as LPTaxNode,
  ExposureInput,
} from "@/lib/liquidity-profile";
import { curveCumToIncremental, scaleIncrementalPctToDollars, type CurvePoint } from "@/lib/pm-curves";
import { groupByCurrency, type CommitmentInput } from "@/lib/sleeve";

// ── Create scenario ──

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function createScenarioAction(
  _prev: { error?: string } | null,
  formData: FormData,
) {
  const user = await requireRole("ADMIN");
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.liquidityStressScenario.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      createdByUserId: user.id,
      rules: {
        create: [
          { horizonDays: 30, extraCashDemandPct: 0, extraCashDemandAmount: 0 },
          { horizonDays: 90, extraCashDemandPct: 0, extraCashDemandAmount: 0 },
          { horizonDays: 365, extraCashDemandPct: 0, extraCashDemandAmount: 0 },
        ],
      },
    },
  });

  revalidatePath("/admin/liquidity-stress");
  return null;
}

// ── Update rule ──

const ruleSchema = z.object({
  ruleId: z.string().min(1),
  extraCashDemandPct: z.coerce.number().min(0).max(100),
  extraCashDemandAmount: z.coerce.number().min(0),
});

export async function updateRuleAction(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  await requireRole("ADMIN");
  const parsed = ruleSchema.safeParse({
    ruleId: formData.get("ruleId"),
    extraCashDemandPct: formData.get("extraCashDemandPct"),
    extraCashDemandAmount: formData.get("extraCashDemandAmount"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.liquidityStressRule.update({
    where: { id: parsed.data.ruleId },
    data: {
      extraCashDemandPct: parsed.data.extraCashDemandPct / 100,
      extraCashDemandAmount: parsed.data.extraCashDemandAmount,
    },
  });

  revalidatePath("/admin/liquidity-stress");
  return { success: true };
}

// ── Set default ──

export async function setDefaultScenarioAction(scenarioId: string) {
  await requireRole("ADMIN");
  await prisma.liquidityStressScenario.updateMany({
    where: { isDefault: true },
    data: { isDefault: false },
  });
  await prisma.liquidityStressScenario.update({
    where: { id: scenarioId },
    data: { isDefault: true },
  });
  revalidatePath("/admin/liquidity-stress");
}

// ── Delete scenario ──

export async function deleteScenarioAction(scenarioId: string) {
  await requireRole("ADMIN");
  await prisma.liquidityStressScenario.delete({ where: { id: scenarioId } });
  revalidatePath("/admin/liquidity-stress");
}

// ── Run scenario ──

export async function runScenarioAction(scenarioId: string) {
  const user = await requireRole("ADMIN");

  const scenario = await prisma.liquidityStressScenario.findUnique({
    where: { id: scenarioId },
    include: { rules: true },
  });
  if (!scenario) return;

  const rules: StressRule[] = scenario.rules.map((r) => ({
    horizonDays: r.horizonDays,
    extraCashDemandPct: r.extraCashDemandPct,
    extraCashDemandAmount: r.extraCashDemandAmount,
  }));

  // Fetch all clients with holdings, sleeves, and PM data
  const clients = await prisma.client.findMany({
    include: {
      accounts: {
        include: {
          holdings: {
            include: {
              product: { select: { name: true, type: true } },
              lookthroughHoldings: {
                include: { underlyingProduct: { select: { name: true } } },
              },
            },
          },
        },
      },
      clientSleeve: {
        include: {
          commitments: {
            include: { fund: { select: { name: true, currency: true, profile: true } } },
          },
        },
      },
    },
  });

  // Fetch liquidity profiles data
  const productOverridesRaw = await prisma.productLiquidityOverride.findMany({
    include: { profile: true },
  });
  const lpOverrides = new Map<string, LiquidityProfileData>(
    productOverridesRaw.map((o) => [
      o.productId,
      { tier: o.profile.tier, horizonDays: o.profile.horizonDays, stressedHaircutPct: o.profile.stressedHaircutPct, gateOrSuspendRisk: o.profile.gateOrSuspendRisk },
    ]),
  );

  const taxDefaultsRaw = await prisma.taxonomyLiquidityDefault.findMany({
    include: { profile: true },
  });
  const lpTaxDefaults = new Map<string, LiquidityProfileData>(
    taxDefaultsRaw.map((d) => [
      d.taxonomyNodeId,
      { tier: d.profile.tier, horizonDays: d.profile.horizonDays, stressedHaircutPct: d.profile.stressedHaircutPct, gateOrSuspendRisk: d.profile.gateOrSuspendRisk },
    ]),
  );

  const govTaxonomy = await prisma.taxonomy.findFirst({
    include: { nodes: true, productMaps: { where: { scope: MappingScope.FIRM_DEFAULT } } },
    orderBy: { createdAt: "asc" },
  });
  const lpNodes = new Map<string, LPTaxNode>(
    (govTaxonomy?.nodes ?? []).map((n) => [n.id, { id: n.id, parentId: n.parentId }]),
  );
  const lpMappings: LPProductMapping[] = (govTaxonomy?.productMaps ?? []).map((m) => ({
    productId: m.productId,
    nodeId: m.nodeId,
  }));

  // Create the run
  const run = await prisma.liquidityStressRun.create({
    data: {
      scenarioId,
      runByUserId: user.id,
    },
  });

  // Compute stress for each client
  for (const client of clients) {
    // Build exposures using look-through
    const exposures: ExposureInput[] = [];
    for (const account of client.accounts) {
      for (const h of account.holdings) {
        if (h.product.type === "MANAGED_PORTFOLIO" && h.lookthroughHoldings.length > 0) {
          for (const lt of h.lookthroughHoldings) {
            exposures.push({
              productId: lt.underlyingProductId,
              productName: lt.underlyingProduct.name,
              marketValue: lt.underlyingMarketValue,
            });
          }
        } else {
          exposures.push({
            productId: h.productId,
            productName: h.product.name,
            marketValue: h.marketValue,
          });
        }
      }
    }

    // Aggregate by product
    const byProduct = new Map<string, ExposureInput>();
    for (const e of exposures) {
      const existing = byProduct.get(e.productId);
      if (existing) existing.marketValue += e.marketValue;
      else byProduct.set(e.productId, { ...e });
    }
    const aggregated = [...byProduct.values()];

    // Build PM calls from sleeve commitments
    const pmCalls: PMCallInput[] = [];
    let bufferInput: BufferInput | null = null;

    if (client.clientSleeve) {
      const sleeve = client.clientSleeve;
      const commitmentInputs: CommitmentInput[] = sleeve.commitments.map((c) => ({
        fundId: c.fundId,
        fundName: c.fund.name,
        currency: c.fund.currency,
        commitmentAmount: c.commitmentAmount,
        fundedAmount: c.fundedAmount,
        navAmount: c.navAmount,
        distributionsAmount: c.distributionsAmount,
      }));

      // Extract projected calls
      for (const c of sleeve.commitments) {
        if (c.fund.profile) {
          try {
            const callCurve: CurvePoint[] = JSON.parse(c.fund.profile.projectedCallPctCurveJson);
            const incCalls = curveCumToIncremental(callCurve);
            const dollarCalls = scaleIncrementalPctToDollars(incCalls, c.commitmentAmount);
            for (const dc of dollarCalls) {
              pmCalls.push({ currency: c.fund.currency, month: dc.month, amount: dc.amount });
            }
          } catch { /* empty */ }
        }
      }

      // Build buffer input
      const currencyTotals = groupByCurrency(commitmentInputs);
      const audTotal = currencyTotals.find((ct) => ct.currency === "AUD");
      const audUnfunded = audTotal?.totalUnfunded ?? 0;

      // Pre-compute AUD calls within buffer months
      const bufferMonths = sleeve.bufferMonthsForward;
      const audCalls = pmCalls.filter((c) => c.currency === "AUD");
      const allAudMonths = [...new Set(audCalls.map((c) => c.month))].sort();
      const relevantMonths = new Set(allAudMonths.slice(0, bufferMonths));
      let projectedCallsAUD = 0;
      for (const call of audCalls) {
        if (relevantMonths.has(call.month)) projectedCallsAUD += call.amount;
      }

      bufferInput = {
        method: sleeve.bufferMethod as "VS_UNFUNDED_PCT" | "VS_PROJECTED_CALLS",
        unfundedAUD: audUnfunded,
        bufferPctOfUnfunded: sleeve.bufferPctOfUnfunded,
        projectedCallsWithinMonths: bufferMonths,
        projectedCallsAUD,
      };
    }

    const stress = computeClientStress(
      client.id, aggregated, lpMappings, lpOverrides, lpTaxDefaults, lpNodes,
      rules, pmCalls, bufferInput,
    );

    // Persist results
    for (const h of stress.horizons) {
      await prisma.liquidityStressResult.create({
        data: {
          runId: run.id,
          clientId: client.id,
          horizonDays: h.horizonDays,
          availableLiquidity: h.availableLiquidity,
          requiredLiquidity: h.requiredLiquidity,
          coverageRatio: h.coverageRatio,
          shortfall: h.shortfall,
          detailsJson: JSON.stringify(h.details),
        },
      });
    }
  }

  revalidatePath("/admin/liquidity-stress");
  revalidatePath("/admin/governance");
}
