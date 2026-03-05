/**
 * Pure approval workflow logic for sleeve recommendations.
 * DRAFT → ADVISER_APPROVED → CLIENT_APPROVED
 * Any non-final state can → REJECTED
 */

export type ApprovalStatus = "DRAFT" | "ADVISER_APPROVED" | "CLIENT_APPROVED" | "REJECTED";
export type ApprovalAction = "APPROVE" | "REJECT";
export type ActorRole = "ADVISER" | "ADMIN" | "SUPER_ADMIN";

export type TransitionResult =
  | { ok: true; newStatus: ApprovalStatus }
  | { ok: false; error: string };

const VALID_TRANSITIONS: Record<string, ApprovalStatus> = {
  "DRAFT:APPROVE": "ADVISER_APPROVED",
  "ADVISER_APPROVED:APPROVE": "CLIENT_APPROVED",
  "DRAFT:REJECT": "REJECTED",
  "ADVISER_APPROVED:REJECT": "REJECTED",
};

const APPROVE_ROLES: Record<string, ActorRole[]> = {
  DRAFT: ["ADVISER", "ADMIN", "SUPER_ADMIN"],
  ADVISER_APPROVED: ["ADVISER", "ADMIN", "SUPER_ADMIN"], // simulated client approval
};

const REJECT_ROLES: Record<string, ActorRole[]> = {
  DRAFT: ["ADVISER", "ADMIN", "SUPER_ADMIN"],
  ADVISER_APPROVED: ["ADVISER", "ADMIN", "SUPER_ADMIN"],
};

export function validateTransition(
  currentStatus: ApprovalStatus,
  action: ApprovalAction,
  actorRole: ActorRole,
): TransitionResult {
  // Final states cannot transition
  if (currentStatus === "CLIENT_APPROVED" || currentStatus === "REJECTED") {
    return { ok: false, error: `Cannot ${action.toLowerCase()} a ${currentStatus.replace("_", " ").toLowerCase()} recommendation` };
  }

  const key = `${currentStatus}:${action}`;
  const newStatus = VALID_TRANSITIONS[key];
  if (!newStatus) {
    return { ok: false, error: `Invalid transition: ${action} from ${currentStatus}` };
  }

  // Check role permission
  const allowedRoles = action === "APPROVE"
    ? APPROVE_ROLES[currentStatus]
    : REJECT_ROLES[currentStatus];

  if (!allowedRoles?.includes(actorRole)) {
    return { ok: false, error: `Role ${actorRole} cannot ${action.toLowerCase()} from ${currentStatus}` };
  }

  return { ok: true, newStatus };
}

export function getAvailableActions(
  currentStatus: ApprovalStatus,
  actorRole: ActorRole,
): ApprovalAction[] {
  const actions: ApprovalAction[] = [];
  for (const action of ["APPROVE", "REJECT"] as ApprovalAction[]) {
    const result = validateTransition(currentStatus, action, actorRole);
    if (result.ok) actions.push(action);
  }
  return actions;
}

export function statusLabel(status: ApprovalStatus): string {
  switch (status) {
    case "DRAFT": return "Draft";
    case "ADVISER_APPROVED": return "Adviser Approved";
    case "CLIENT_APPROVED": return "Client Approved";
    case "REJECTED": return "Rejected";
  }
}

export function nextStepLabel(status: ApprovalStatus): string | null {
  switch (status) {
    case "DRAFT": return "Awaiting adviser approval";
    case "ADVISER_APPROVED": return "Awaiting client approval";
    case "CLIENT_APPROVED": return null;
    case "REJECTED": return null;
  }
}
