/**
 * Seed helper: creates accounts, products, holdings, and look-through data
 * for the 5 demo clients. Called from seed.ts.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { Platform, ProductType } from "../src/generated/prisma/enums";

// ── Static product catalogue ─────────────────────────────

const DIRECT_PRODUCTS = [
  { id: "prod-bhp", name: "BHP Group", type: ProductType.DIRECT },
  { id: "prod-cba", name: "CBA", type: ProductType.DIRECT },
  { id: "prod-csl", name: "CSL Ltd", type: ProductType.DIRECT },
  { id: "prod-wbc", name: "Westpac", type: ProductType.DIRECT },
  { id: "prod-nab", name: "NAB", type: ProductType.DIRECT },
  { id: "prod-anz", name: "ANZ", type: ProductType.DIRECT },
  { id: "prod-rio", name: "Rio Tinto", type: ProductType.DIRECT },
  { id: "prod-mqg", name: "Macquarie Group", type: ProductType.DIRECT },
  { id: "prod-wes", name: "Wesfarmers", type: ProductType.DIRECT },
  { id: "prod-tls", name: "Telstra", type: ProductType.DIRECT },
];

const ETF_PRODUCTS = [
  { id: "prod-vgs", name: "Vanguard Intl Shares ETF", type: ProductType.ETF },
  { id: "prod-vas", name: "Vanguard Aus Shares ETF", type: ProductType.ETF },
  { id: "prod-vae", name: "Vanguard Asia ETF", type: ProductType.ETF },
];

const MANAGED_PRODUCTS = [
  { id: "prod-mp1", name: "Magellan Global Fund", type: ProductType.MANAGED_PORTFOLIO },
  { id: "prod-mp2", name: "Platinum International Fund", type: ProductType.MANAGED_PORTFOLIO },
];

const FUND_PRODUCTS = [
  { id: "prod-f1", name: "Australian Foundation Fund", type: ProductType.FUND },
  { id: "prod-f2", name: "Hyperion Small Growth Fund", type: ProductType.FUND },
];

const CASH_PRODUCTS = [
  { id: "__AUD_CASH__", name: "AUD Cash", type: ProductType.DIRECT },
  { id: "__USD_CASH__", name: "USD Cash", type: ProductType.DIRECT },
];

const ALL_PRODUCTS = [
  ...DIRECT_PRODUCTS,
  ...ETF_PRODUCTS,
  ...MANAGED_PRODUCTS,
  ...FUND_PRODUCTS,
  ...CASH_PRODUCTS,
];

// Underlying holdings for each managed portfolio
const MANAGED_UNDERLYINGS: Record<
  string,
  { productId: string; weight: number }[]
> = {
  "prod-mp1": [
    { productId: "prod-bhp", weight: 0.12 },
    { productId: "prod-cba", weight: 0.10 },
    { productId: "prod-csl", weight: 0.15 },
    { productId: "prod-vgs", weight: 0.18 },
    { productId: "prod-rio", weight: 0.08 },
    { productId: "prod-mqg", weight: 0.10 },
    { productId: "prod-tls", weight: 0.07 },
    { productId: "prod-wes", weight: 0.05 },
    { productId: "prod-nab", weight: 0.06 },
    { productId: "prod-anz", weight: 0.09 },
  ],
  "prod-mp2": [
    { productId: "prod-csl", weight: 0.20 },
    { productId: "prod-bhp", weight: 0.15 },
    { productId: "prod-vgs", weight: 0.12 },
    { productId: "prod-vas", weight: 0.10 },
    { productId: "prod-cba", weight: 0.08 },
    { productId: "prod-wbc", weight: 0.08 },
    { productId: "prod-rio", weight: 0.07 },
    { productId: "prod-mqg", weight: 0.05 },
    { productId: "prod-tls", weight: 0.05 },
    { productId: "prod-nab", weight: 0.04 },
    { productId: "prod-anz", weight: 0.03 },
    { productId: "prod-wes", weight: 0.03 },
  ],
};

// ── Per-client account templates ─────────────────────────

const PLATFORMS = [Platform.HUB24, Platform.NETWEALTH, Platform.CFS];

type HoldingTemplate = {
  productId: string;
  marketValue: number;
};

function clientHoldings(clientIndex: number): HoldingTemplate[] {
  // Each client gets a slightly different mix of 6–10 holdings
  const base: HoldingTemplate[][] = [
    [
      { productId: "prod-bhp", marketValue: 25000 },
      { productId: "prod-cba", marketValue: 30000 },
      { productId: "prod-vgs", marketValue: 45000 },
      { productId: "prod-mp1", marketValue: 80000 },
      { productId: "prod-mp2", marketValue: 60000 },
      { productId: "prod-f1", marketValue: 20000 },
      { productId: "prod-vas", marketValue: 15000 },
      { productId: "prod-tls", marketValue: 10000 },
    ],
    [
      { productId: "prod-csl", marketValue: 40000 },
      { productId: "prod-mp1", marketValue: 100000 },
      { productId: "prod-vgs", marketValue: 35000 },
      { productId: "prod-wbc", marketValue: 20000 },
      { productId: "prod-f2", marketValue: 25000 },
      { productId: "prod-mp2", marketValue: 50000 },
    ],
    [
      { productId: "prod-bhp", marketValue: 15000 },
      { productId: "prod-nab", marketValue: 22000 },
      { productId: "prod-mp1", marketValue: 70000 },
      { productId: "prod-vae", marketValue: 18000 },
      { productId: "prod-mqg", marketValue: 30000 },
      { productId: "prod-mp2", marketValue: 45000 },
      { productId: "prod-f1", marketValue: 12000 },
      { productId: "prod-rio", marketValue: 8000 },
      { productId: "prod-vas", marketValue: 20000 },
    ],
    [
      { productId: "prod-cba", marketValue: 35000 },
      { productId: "prod-mp2", marketValue: 90000 },
      { productId: "prod-vgs", marketValue: 50000 },
      { productId: "prod-anz", marketValue: 18000 },
      { productId: "prod-wes", marketValue: 12000 },
      { productId: "prod-f2", marketValue: 15000 },
      { productId: "prod-mp1", marketValue: 55000 },
    ],
    [
      { productId: "prod-mp1", marketValue: 120000 },
      { productId: "prod-mp2", marketValue: 80000 },
      { productId: "prod-bhp", marketValue: 20000 },
      { productId: "prod-csl", marketValue: 35000 },
      { productId: "prod-vgs", marketValue: 40000 },
      { productId: "prod-vas", marketValue: 25000 },
      { productId: "prod-tls", marketValue: 10000 },
      { productId: "prod-nab", marketValue: 15000 },
      { productId: "prod-f1", marketValue: 18000 },
      { productId: "prod-wbc", marketValue: 12000 },
    ],
  ];
  return base[clientIndex % base.length];
}

// ── Main seed function ───────────────────────────────────

export async function seedHoldings(
  prisma: PrismaClient,
  clientIds: string[],
) {
  // Upsert all products
  for (const p of ALL_PRODUCTS) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { name: p.name, type: p.type },
      create: { id: p.id, name: p.name, type: p.type },
    });
  }

  for (let i = 0; i < clientIds.length; i++) {
    const clientId = clientIds[i];
    const platform = PLATFORMS[i % PLATFORMS.length];
    const accountId = `acct-${clientId}`;

    // Upsert account
    await prisma.account.upsert({
      where: { id: accountId },
      update: {},
      create: {
        id: accountId,
        clientId,
        platform,
        accountName: `${platform} Investment Account`,
      },
    });

    // Delete old holdings for idempotency
    await prisma.holding.deleteMany({ where: { accountId } });

    const holdings = clientHoldings(i);
    for (const h of holdings) {
      const holding = await prisma.holding.create({
        data: {
          accountId,
          productId: h.productId,
          marketValue: h.marketValue,
          units: Math.round(h.marketValue / (10 + Math.random() * 90)),
          price: +(h.marketValue / Math.max(1, Math.round(h.marketValue / 50))).toFixed(2),
          asAtDate: new Date(),
        },
      });

      // Create look-through for managed portfolios
      const underlyings = MANAGED_UNDERLYINGS[h.productId];
      if (underlyings) {
        for (const u of underlyings) {
          await prisma.lookthroughHolding.create({
            data: {
              holdingId: holding.id,
              underlyingProductId: u.productId,
              weight: u.weight,
              underlyingMarketValue: +(h.marketValue * u.weight).toFixed(2),
            },
          });
        }
      }
    }
  }
}

/** Exported for testing */
export { MANAGED_UNDERLYINGS };
