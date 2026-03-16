import type { WizardConfig } from "@/lib/wizard";

export const SLEEVE_WIZARD_CONFIG: WizardConfig = {
  draftKey: "sleeve-create",
  basePath: "/adviser/sleeve/new",
  steps: [
    { slug: "step-1", title: "Client & Basics", description: "Select a client and configure sleeve basics." },
    { slug: "step-2", title: "Liquid Bucket", description: "Add liquid positions that fund capital calls." },
    { slug: "step-3", title: "Fund Commitments", description: "Select approved PM funds and set commitment amounts." },
    { slug: "step-4", title: "Buffer Rules", description: "Configure how the liquidity buffer is calculated." },
    { slug: "step-5", title: "Waterfalls", description: "Set sell and buy priority order for liquid positions." },
    { slug: "step-6", title: "Review & Create", description: "Review the full configuration before finishing." },
  ],
};

// ── Target mode ──────────────────────────────────────────

export type TargetMode = "PCT_PORTFOLIO" | "ABS_AMOUNT";

// ── Buffer basis ─────────────────────────────────────────

export type BufferBasis = "PCT_UNFUNDED" | "PCT_LIQUID_BUCKET" | "ABS_AMOUNT";

// ── Liquid bucket mode ───────────────────────────────────

export type LiquidBucketMode = "MIRROR" | "CUSTOM";

// ── Data types ───────────────────────────────────────────

export interface LiquidEntry {
  productId: string;
  productName: string;
  marketValue: number;
  weightPct: number; // 0-100
}

export interface CommitmentEntry {
  fundId: string;
  fundName: string;
  currency: string;
  commitmentAmount: number;
}

export interface WaterfallEntry {
  productId: string;
  productName: string;
  maxPct: number; // 0-1
  excluded: boolean;
}

export interface SleeveWizardData {
  /** DB IDs set after creation */
  sleeveId: string;
  clientId: string;
  clientName: string;
  /** Basics */
  sleeveName: string;
  targetMode: TargetMode;
  targetPct: string;        // % string, e.g. "15"
  targetAmount: string;     // $ string for ABS_AMOUNT mode
  portfolioValue: number;   // loaded from client's holdings
  /** Buffer */
  bufferEnabled: boolean;
  bufferBasis: BufferBasis;
  cashBufferPct: string;    // % string, e.g. "5"
  /** Liquid bucket */
  liquidBucketMode: LiquidBucketMode;
  liquidPositions: LiquidEntry[];
  alignToRebalance: boolean;
  /** Fund commitments */
  commitments: CommitmentEntry[];
  commitmentsSkipped: boolean;
  /** Buffer rules (step 4) */
  bufferMethod: "VS_UNFUNDED_PCT" | "VS_PROJECTED_CALLS";
  bufferPctOfUnfunded: string;  // % string
  bufferMonthsForward: string;
  /** Waterfalls */
  sellWaterfall: WaterfallEntry[];
  buyWaterfall: WaterfallEntry[];
  minTradeAmount: string;
}

export const SLEEVE_WIZARD_DEFAULTS: SleeveWizardData = {
  sleeveId: "",
  clientId: "",
  clientName: "",
  sleeveName: "",
  targetMode: "PCT_PORTFOLIO",
  targetPct: "15",
  targetAmount: "",
  portfolioValue: 0,
  bufferEnabled: true,
  bufferBasis: "PCT_UNFUNDED",
  cashBufferPct: "5",
  liquidBucketMode: "MIRROR",
  liquidPositions: [],
  alignToRebalance: false,
  commitments: [],
  commitmentsSkipped: false,
  bufferMethod: "VS_UNFUNDED_PCT",
  bufferPctOfUnfunded: "10",
  bufferMonthsForward: "6",
  sellWaterfall: [],
  buyWaterfall: [],
  minTradeAmount: "1000",
};
