import type { WizardConfig } from "@/lib/wizard";

export const REBALANCE_WIZARD_CONFIG: WizardConfig = {
  draftKey: "rebalance-create",
  basePath: "/adviser/rebalance/new",
  steps: [
    { slug: "step-1", title: "Select Client & SAA", description: "Choose a client and their strategic asset allocation." },
    { slug: "step-2", title: "Review Drift", description: "See current vs target allocation and identify breaches." },
    { slug: "step-3", title: "Liquidity Check", description: "Check whether liquid assets can support the rebalance." },
    { slug: "step-4", title: "Proposed Trades", description: "Review and amend generated buy/sell trades." },
    { slug: "step-5", title: "Approvals", description: "Adviser and client approval workflow." },
    { slug: "step-6", title: "Execute & Export", description: "Simulate order execution and export results." },
  ],
};

// ── Drift row (matches rebalance engine output) ──────────

export interface DriftRow {
  nodeId: string;
  nodeName: string;
  currentWeight: number;
  targetWeight: number;
  minWeight: number;
  maxWeight: number;
  drift: number;
  status: "within" | "below_min" | "above_max";
}

// ── Trade row ────────────────────────────────────────────

export interface TradeRow {
  id: string;
  productId: string;
  productName: string;
  side: string;
  amount: number;
  reason: string;
  /** Whether this trade is for a sleeve liquid position */
  isSleeve?: boolean;
}

// ── Order row ────────────────────────────────────────────

export interface OrderRow {
  id: string;
  productName: string;
  side: string;
  amount: number;
  status: string;
  lastEvent: string | null;
}

// ── Event row ────────────────────────────────────────────

export interface EventRow {
  id: string;
  action: string;
  actorRole: string;
  note: string | null;
  createdAt: string;
}

// ── Liquidity bucket ─────────────────────────────────────

export interface LiquidityBucket {
  horizonLabel: string;
  horizonDays: number;
  grossValue: number;
  stressedValue: number;
  pctOfPortfolio: number;
  gatedCount: number;
  /** Breakdown: how much comes from sleeve liquid positions */
  sleeveValue?: number;
  /** Breakdown: how much comes from non-sleeve holdings */
  nonSleeveValue?: number;
}

// ── Sleeve summary (for step 2/3 when included) ──────────

export interface SleeveSummary {
  sleeveName: string;
  liquidBucketValue: number;
  pmExposure: number;
  cashBufferPct: number;
  bufferMethod: string;
  warningStatus: "OK" | "WARN" | "CRITICAL";
}

// ── Available product (for trade editing) ────────────────

export interface AvailableProduct {
  id: string;
  name: string;
  type: string;
}

// ── Wizard state ─────────────────────────────────────────

export interface RebalanceWizardData {
  // Step 1: Client + SAA selection
  planId: string;
  clientId: string;
  clientName: string;
  saaId: string;
  saaName: string;

  // Step 2: Drift data
  includeSleeve: boolean;
  sleeveSummary: SleeveSummary | null;
  totalPortfolioValue: number;
  breachesBefore: number;
  breachesAfter: number;
  beforeDrift: DriftRow[];
  afterDrift: DriftRow[];

  // Step 3: Liquidity
  liquidityChecked: boolean;
  liquidityBuckets: LiquidityBucket[];
  totalLiquid: number;
  sleeveLiquid: number;
  nonSleeveLiquid: number;
  totalTradeValue: number;
  liquidityOk: boolean;
  liquidityWarnings: string[];

  // Step 4: Trades (editable)
  trades: TradeRow[];
  /** The original generated trades (kept so we can revert) */
  originalTrades: TradeRow[];
  /** Available products for the add-trade dropdown */
  availableProducts: AvailableProduct[];
  /** Whether trades have been manually amended */
  tradesAmended: boolean;

  // Step 5: Approval status
  planStatus: string;
  events: EventRow[];

  // Step 6: Execution
  orders: OrderRow[];
}

export const REBALANCE_WIZARD_DEFAULTS: RebalanceWizardData = {
  planId: "",
  clientId: "",
  clientName: "",
  saaId: "",
  saaName: "",

  includeSleeve: false,
  sleeveSummary: null,
  totalPortfolioValue: 0,
  breachesBefore: 0,
  breachesAfter: 0,
  beforeDrift: [],
  afterDrift: [],

  liquidityChecked: false,
  liquidityBuckets: [],
  totalLiquid: 0,
  sleeveLiquid: 0,
  nonSleeveLiquid: 0,
  totalTradeValue: 0,
  liquidityOk: true,
  liquidityWarnings: [],

  trades: [],
  originalTrades: [],
  availableProducts: [],
  tradesAmended: false,

  planStatus: "DRAFT",
  events: [],

  orders: [],
};
