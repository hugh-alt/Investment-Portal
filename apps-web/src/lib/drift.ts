/**
 * Pure drift calculation: compare current allocation weights to SAA targets.
 * Client-safe (no DB imports).
 */

export type ToleranceStatus = "within" | "below_min" | "above_max";

export type DriftRow = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  riskBucketId: string | null;
  riskBucketName: string | null;
  currentWeight: number;  // 0–1
  targetWeight: number;   // 0–1
  minWeight: number;      // 0–1
  maxWeight: number;      // 0–1
  drift: number;          // current - target
  toleranceStatus: ToleranceStatus;
};

export type DriftResult = {
  rows: DriftRow[];
  totalCurrentWeight: number;
  totalTargetWeight: number;
  maxAbsDrift: number;
  breachCount: number;
};

export type CurrentWeightInput = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  riskBucketId: string | null;
  riskBucketName: string | null;
  weight: number; // 0–1
};

export type TargetInput = {
  nodeId: string;
  targetWeight: number; // 0–1
  minWeight: number;    // 0–1
  maxWeight: number;    // 0–1
};

export function computeDrift(
  currentWeights: CurrentWeightInput[],
  targets: TargetInput[],
): DriftResult {
  const targetMap = new Map<string, TargetInput>();
  for (const t of targets) {
    targetMap.set(t.nodeId, t);
  }

  const nodeIds = new Set<string>();
  for (const c of currentWeights) nodeIds.add(c.nodeId);
  for (const t of targets) nodeIds.add(t.nodeId);

  const currentMap = new Map<string, CurrentWeightInput>();
  for (const c of currentWeights) {
    currentMap.set(c.nodeId, c);
  }

  const rows: DriftRow[] = [];
  for (const nodeId of nodeIds) {
    const current = currentMap.get(nodeId);
    const target = targetMap.get(nodeId);
    const currentWeight = current?.weight ?? 0;
    const targetWeight = target?.targetWeight ?? 0;
    const minWeight = target?.minWeight ?? 0;
    const maxWeight = target?.maxWeight ?? 0;

    let toleranceStatus: ToleranceStatus = "within";
    if (currentWeight < minWeight - 0.0005) {
      toleranceStatus = "below_min";
    } else if (currentWeight > maxWeight + 0.0005) {
      toleranceStatus = "above_max";
    }

    rows.push({
      nodeId,
      nodeName: current?.nodeName ?? nodeId,
      nodeType: current?.nodeType ?? "ASSET_CLASS",
      riskBucketId: current?.riskBucketId ?? null,
      riskBucketName: current?.riskBucketName ?? null,
      currentWeight,
      targetWeight,
      minWeight,
      maxWeight,
      drift: currentWeight - targetWeight,
      toleranceStatus,
    });
  }

  // Sort by risk bucket, then by absolute drift desc
  rows.sort((a, b) => {
    const bucketCmp = (a.riskBucketName ?? "").localeCompare(b.riskBucketName ?? "");
    if (bucketCmp !== 0) return bucketCmp;
    return Math.abs(b.drift) - Math.abs(a.drift);
  });

  return {
    rows,
    totalCurrentWeight: rows.reduce((s, r) => s + r.currentWeight, 0),
    totalTargetWeight: rows.reduce((s, r) => s + r.targetWeight, 0),
    maxAbsDrift: rows.reduce((m, r) => Math.max(m, Math.abs(r.drift)), 0),
    breachCount: rows.filter((r) => r.toleranceStatus !== "within").length,
  };
}
