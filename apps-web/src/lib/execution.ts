/**
 * Pure order execution status transition logic.
 * No DB imports — safe for client + tests.
 */

export type ExecutionStatus =
  | "CREATED"
  | "SUBMITTED"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "REJECTED"
  | "CANCELLED";

export type OrderTransitionResult =
  | { ok: true; newStatus: ExecutionStatus }
  | { ok: false; error: string };

const VALID_ORDER_TRANSITIONS: Record<string, ExecutionStatus[]> = {
  CREATED: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["PARTIALLY_FILLED", "FILLED", "REJECTED", "CANCELLED"],
  PARTIALLY_FILLED: ["FILLED", "CANCELLED"],
  FILLED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function validateOrderTransition(
  currentStatus: ExecutionStatus,
  targetStatus: ExecutionStatus,
): OrderTransitionResult {
  const allowed = VALID_ORDER_TRANSITIONS[currentStatus];
  if (!allowed || allowed.length === 0) {
    return { ok: false, error: `Order in ${currentStatus} state cannot transition further` };
  }
  if (!allowed.includes(targetStatus)) {
    return {
      ok: false,
      error: `Cannot transition from ${currentStatus} to ${targetStatus}`,
    };
  }
  return { ok: true, newStatus: targetStatus };
}

export function canCreateOrders(
  recommendationStatus: string,
  existingOrderCount: number,
): { ok: true } | { ok: false; error: string } {
  if (recommendationStatus !== "CLIENT_APPROVED") {
    return { ok: false, error: "Orders can only be created for CLIENT_APPROVED recommendations" };
  }
  if (existingOrderCount > 0) {
    return { ok: false, error: "Orders have already been created for this recommendation" };
  }
  return { ok: true };
}

export function canSubmitOrders(
  statuses: ExecutionStatus[],
): { ok: true } | { ok: false; error: string } {
  if (statuses.length === 0) {
    return { ok: false, error: "No orders to submit" };
  }
  const submittable = statuses.filter((s) => s === "CREATED");
  if (submittable.length === 0) {
    return { ok: false, error: "No CREATED orders to submit" };
  }
  return { ok: true };
}

export function canFillOrders(
  statuses: ExecutionStatus[],
): { ok: true } | { ok: false; error: string } {
  if (statuses.length === 0) {
    return { ok: false, error: "No orders to fill" };
  }
  const fillable = statuses.filter((s) => s === "SUBMITTED" || s === "PARTIALLY_FILLED");
  if (fillable.length === 0) {
    return { ok: false, error: "No SUBMITTED or PARTIALLY_FILLED orders to fill" };
  }
  return { ok: true };
}

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatus, string> = {
  CREATED: "Created",
  SUBMITTED: "Submitted",
  PARTIALLY_FILLED: "Partially Filled",
  FILLED: "Filled",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};
