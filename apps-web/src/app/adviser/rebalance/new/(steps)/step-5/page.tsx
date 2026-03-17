"use client";

import { useState } from "react";
import { useRebalanceWizard } from "../../wizard-context";
import { approveRebalanceWizardAction, rejectRebalanceWizardAction } from "../../wizard-actions";
import { statusLabel, nextStepLabel, type ApprovalStatus } from "@/lib/approval";

export default function Step5Page() {
  const { data, update } = useRebalanceWizard();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  if (!data.planId) {
    return <p className="text-sm text-zinc-500">Complete Step 1 first.</p>;
  }

  const status = data.planStatus as ApprovalStatus;
  const canAct = status === "DRAFT" || status === "ADVISER_APPROVED";
  const isFullyApproved = status === "CLIENT_APPROVED";
  const isRejected = status === "REJECTED";
  const step = nextStepLabel(status);

  const statusColor: Record<string, string> = {
    DRAFT: "bg-yellow-50 text-yellow-700 border-yellow-200",
    ADVISER_APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
    CLIENT_APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
  };

  async function handleApprove() {
    setPending(true);
    setError(null);
    const result = await approveRebalanceWizardAction(data.planId);
    setPending(false);
    if (result.error) {
      setError(result.error);
    } else {
      update({ planStatus: result.newStatus ?? data.planStatus, events: result.events ?? data.events });
    }
  }

  async function handleReject() {
    setPending(true);
    setError(null);
    const result = await rejectRebalanceWizardAction(data.planId, rejectNote || undefined);
    setPending(false);
    if (result.error) {
      setError(result.error);
    } else {
      update({ planStatus: result.newStatus ?? data.planStatus, events: result.events ?? data.events });
    }
  }

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <div className={`rounded-lg border p-4 ${statusColor[status] ?? ""}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{statusLabel(status)}</span>
        </div>
        {step && <p className="mt-1 text-xs opacity-75">{step}</p>}
      </div>

      {/* Approval timeline */}
      <div>
        <h3 className="text-sm font-medium text-zinc-700 mb-2">Approval Timeline</h3>
        <div className="space-y-2">
          {/* Step 1: Adviser */}
          <TimelineStep
            label="Adviser Approval"
            completed={status === "ADVISER_APPROVED" || status === "CLIENT_APPROVED"}
            active={status === "DRAFT"}
            rejected={isRejected && !data.events.some((e) => e.action === "APPROVE")}
          />
          {/* Step 2: Client */}
          <TimelineStep
            label="Client Approval"
            completed={status === "CLIENT_APPROVED"}
            active={status === "ADVISER_APPROVED"}
            rejected={isRejected && data.events.some((e) => e.action === "APPROVE")}
          />
        </div>
      </div>

      {/* Event history */}
      {data.events.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-medium text-zinc-700 mb-2">History</h3>
          <div className="space-y-1">
            {data.events.map((e) => (
              <p key={e.id} className="text-xs text-zinc-500">
                <span className={e.action === "APPROVE" ? "text-emerald-600" : "text-red-600"}>{e.action}</span>
                {" "}by {e.actorRole} on {new Date(e.createdAt).toLocaleDateString()}
                {e.note && <span className="text-zinc-400"> — {e.note}</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {canAct && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={pending}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 cursor-pointer disabled:cursor-not-allowed"
            >
              {pending ? "..." : status === "DRAFT" ? "Adviser Approve" : "Client Approve"}
            </button>
            <button
              onClick={handleReject}
              disabled={pending}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              Reject
            </button>
          </div>
          <div>
            <input
              type="text"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Rejection note (optional)"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {isFullyApproved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-700">Fully approved.</p>
          <p className="mt-1 text-xs text-emerald-600">Click Next to simulate order execution and export.</p>
        </div>
      )}

      {isRejected && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-700">Plan rejected.</p>
          <p className="mt-1 text-xs text-red-600">Go back to Step 1 to generate a new plan.</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function TimelineStep({
  label,
  completed,
  active,
  rejected,
}: {
  label: string;
  completed: boolean;
  active: boolean;
  rejected: boolean;
}) {
  let dotColor = "bg-zinc-200";
  let textColor = "text-zinc-400";
  if (completed) { dotColor = "bg-emerald-500"; textColor = "text-emerald-700"; }
  else if (active) { dotColor = "bg-amber-400"; textColor = "text-amber-700"; }
  else if (rejected) { dotColor = "bg-red-500"; textColor = "text-red-700"; }

  return (
    <div className="flex items-center gap-3">
      <div className={`h-3 w-3 rounded-full ${dotColor}`} />
      <span className={`text-sm font-medium ${textColor}`}>
        {label}
        {completed && " — Done"}
        {active && " — Pending"}
        {rejected && " — Rejected"}
      </span>
    </div>
  );
}
