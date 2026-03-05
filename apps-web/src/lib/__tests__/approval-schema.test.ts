import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Tests the approval form Zod schema pattern used in sleeve-actions.ts.
 * FormData.get() returns string | null, so optional fields must accept null.
 */
const approvalSchema = z.object({
  clientId: z.string().min(1),
  recommendationId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().nullable().optional(),
});

describe("approvalSchema", () => {
  it("accepts APPROVE with note = null (no note input in form)", () => {
    const result = approvalSchema.safeParse({
      clientId: "c1",
      recommendationId: "r1",
      action: "APPROVE",
      note: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });

  it("accepts APPROVE with note = undefined (field omitted)", () => {
    const result = approvalSchema.safeParse({
      clientId: "c1",
      recommendationId: "r1",
      action: "APPROVE",
    });
    expect(result.success).toBe(true);
  });

  it("accepts REJECT with a note string", () => {
    const result = approvalSchema.safeParse({
      clientId: "c1",
      recommendationId: "r1",
      action: "REJECT",
      note: "Not appropriate",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBe("Not appropriate");
    }
  });

  it("accepts APPROVE with note = empty string", () => {
    const result = approvalSchema.safeParse({
      clientId: "c1",
      recommendationId: "r1",
      action: "APPROVE",
      note: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing clientId", () => {
    const result = approvalSchema.safeParse({
      clientId: "",
      recommendationId: "r1",
      action: "APPROVE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid action", () => {
    const result = approvalSchema.safeParse({
      clientId: "c1",
      recommendationId: "r1",
      action: "INVALID",
    });
    expect(result.success).toBe(false);
  });
});
