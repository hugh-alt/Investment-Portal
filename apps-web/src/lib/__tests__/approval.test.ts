import { describe, it, expect } from "vitest";
import {
  validateTransition,
  getAvailableActions,
  statusLabel,
  nextStepLabel,
  type ApprovalStatus,
  type ActorRole,
} from "../approval";

describe("validateTransition", () => {
  it("DRAFT + APPROVE by ADVISER → ADVISER_APPROVED", () => {
    const result = validateTransition("DRAFT", "APPROVE", "ADVISER");
    expect(result).toEqual({ ok: true, newStatus: "ADVISER_APPROVED" });
  });

  it("DRAFT + APPROVE by ADMIN → ADVISER_APPROVED", () => {
    const result = validateTransition("DRAFT", "APPROVE", "ADMIN");
    expect(result).toEqual({ ok: true, newStatus: "ADVISER_APPROVED" });
  });

  it("DRAFT + APPROVE by SUPER_ADMIN → ADVISER_APPROVED", () => {
    const result = validateTransition("DRAFT", "APPROVE", "SUPER_ADMIN");
    expect(result).toEqual({ ok: true, newStatus: "ADVISER_APPROVED" });
  });

  it("ADVISER_APPROVED + APPROVE → CLIENT_APPROVED", () => {
    const result = validateTransition("ADVISER_APPROVED", "APPROVE", "ADVISER");
    expect(result).toEqual({ ok: true, newStatus: "CLIENT_APPROVED" });
  });

  it("DRAFT + REJECT → REJECTED", () => {
    const result = validateTransition("DRAFT", "REJECT", "ADVISER");
    expect(result).toEqual({ ok: true, newStatus: "REJECTED" });
  });

  it("ADVISER_APPROVED + REJECT → REJECTED", () => {
    const result = validateTransition("ADVISER_APPROVED", "REJECT", "ADVISER");
    expect(result).toEqual({ ok: true, newStatus: "REJECTED" });
  });

  it("CLIENT_APPROVED cannot be approved again", () => {
    const result = validateTransition("CLIENT_APPROVED", "APPROVE", "ADVISER");
    expect(result.ok).toBe(false);
  });

  it("CLIENT_APPROVED cannot be rejected", () => {
    const result = validateTransition("CLIENT_APPROVED", "REJECT", "ADVISER");
    expect(result.ok).toBe(false);
  });

  it("REJECTED cannot be approved", () => {
    const result = validateTransition("REJECTED", "APPROVE", "ADVISER");
    expect(result.ok).toBe(false);
  });

  it("REJECTED cannot be rejected again", () => {
    const result = validateTransition("REJECTED", "REJECT", "ADVISER");
    expect(result.ok).toBe(false);
  });
});

describe("getAvailableActions", () => {
  it("DRAFT adviser can approve and reject", () => {
    expect(getAvailableActions("DRAFT", "ADVISER")).toEqual(["APPROVE", "REJECT"]);
  });

  it("ADVISER_APPROVED adviser can approve (client) and reject", () => {
    expect(getAvailableActions("ADVISER_APPROVED", "ADVISER")).toEqual(["APPROVE", "REJECT"]);
  });

  it("CLIENT_APPROVED has no actions", () => {
    expect(getAvailableActions("CLIENT_APPROVED", "ADVISER")).toEqual([]);
  });

  it("REJECTED has no actions", () => {
    expect(getAvailableActions("REJECTED", "ADVISER")).toEqual([]);
  });
});

describe("statusLabel", () => {
  it("returns readable labels", () => {
    expect(statusLabel("DRAFT")).toBe("Draft");
    expect(statusLabel("ADVISER_APPROVED")).toBe("Adviser Approved");
    expect(statusLabel("CLIENT_APPROVED")).toBe("Client Approved");
    expect(statusLabel("REJECTED")).toBe("Rejected");
  });
});

describe("nextStepLabel", () => {
  it("DRAFT awaits adviser", () => {
    expect(nextStepLabel("DRAFT")).toBe("Awaiting adviser approval");
  });

  it("ADVISER_APPROVED awaits client", () => {
    expect(nextStepLabel("ADVISER_APPROVED")).toBe("Awaiting client approval");
  });

  it("final states return null", () => {
    expect(nextStepLabel("CLIENT_APPROVED")).toBeNull();
    expect(nextStepLabel("REJECTED")).toBeNull();
  });
});
