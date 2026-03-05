import { describe, it, expect } from "vitest";
import {
  validateOrderTransition,
  canCreateOrders,
  canSubmitOrders,
  canFillOrders,
  type ExecutionStatus,
} from "../execution";

describe("validateOrderTransition", () => {
  it("CREATED → SUBMITTED is valid", () => {
    expect(validateOrderTransition("CREATED", "SUBMITTED")).toEqual({
      ok: true,
      newStatus: "SUBMITTED",
    });
  });

  it("CREATED → CANCELLED is valid", () => {
    expect(validateOrderTransition("CREATED", "CANCELLED")).toEqual({
      ok: true,
      newStatus: "CANCELLED",
    });
  });

  it("CREATED → FILLED is invalid", () => {
    const result = validateOrderTransition("CREATED", "FILLED");
    expect(result.ok).toBe(false);
  });

  it("SUBMITTED → FILLED is valid", () => {
    expect(validateOrderTransition("SUBMITTED", "FILLED")).toEqual({
      ok: true,
      newStatus: "FILLED",
    });
  });

  it("SUBMITTED → PARTIALLY_FILLED is valid", () => {
    expect(validateOrderTransition("SUBMITTED", "PARTIALLY_FILLED")).toEqual({
      ok: true,
      newStatus: "PARTIALLY_FILLED",
    });
  });

  it("SUBMITTED → REJECTED is valid", () => {
    expect(validateOrderTransition("SUBMITTED", "REJECTED")).toEqual({
      ok: true,
      newStatus: "REJECTED",
    });
  });

  it("PARTIALLY_FILLED → FILLED is valid", () => {
    expect(validateOrderTransition("PARTIALLY_FILLED", "FILLED")).toEqual({
      ok: true,
      newStatus: "FILLED",
    });
  });

  it("PARTIALLY_FILLED → CANCELLED is valid", () => {
    expect(validateOrderTransition("PARTIALLY_FILLED", "CANCELLED")).toEqual({
      ok: true,
      newStatus: "CANCELLED",
    });
  });

  it("FILLED cannot transition", () => {
    const result = validateOrderTransition("FILLED", "SUBMITTED");
    expect(result.ok).toBe(false);
  });

  it("REJECTED cannot transition", () => {
    const result = validateOrderTransition("REJECTED", "SUBMITTED");
    expect(result.ok).toBe(false);
  });

  it("CANCELLED cannot transition", () => {
    const result = validateOrderTransition("CANCELLED", "SUBMITTED");
    expect(result.ok).toBe(false);
  });
});

describe("canCreateOrders", () => {
  it("allows when CLIENT_APPROVED and no orders", () => {
    expect(canCreateOrders("CLIENT_APPROVED", 0)).toEqual({ ok: true });
  });

  it("rejects when not CLIENT_APPROVED", () => {
    const result = canCreateOrders("DRAFT", 0);
    expect(result.ok).toBe(false);
  });

  it("rejects when orders already exist", () => {
    const result = canCreateOrders("CLIENT_APPROVED", 3);
    expect(result.ok).toBe(false);
  });
});

describe("canSubmitOrders", () => {
  it("allows when CREATED orders exist", () => {
    expect(canSubmitOrders(["CREATED", "CREATED"])).toEqual({ ok: true });
  });

  it("rejects when no CREATED orders", () => {
    const result = canSubmitOrders(["SUBMITTED", "FILLED"]);
    expect(result.ok).toBe(false);
  });

  it("rejects when empty", () => {
    const result = canSubmitOrders([]);
    expect(result.ok).toBe(false);
  });
});

describe("canFillOrders", () => {
  it("allows when SUBMITTED orders exist", () => {
    expect(canFillOrders(["SUBMITTED"])).toEqual({ ok: true });
  });

  it("allows when PARTIALLY_FILLED orders exist", () => {
    expect(canFillOrders(["PARTIALLY_FILLED"])).toEqual({ ok: true });
  });

  it("rejects when no fillable orders", () => {
    const result = canFillOrders(["CREATED", "FILLED"]);
    expect(result.ok).toBe(false);
  });

  it("rejects when empty", () => {
    const result = canFillOrders([]);
    expect(result.ok).toBe(false);
  });
});
