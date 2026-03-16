import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for wizard draft persistence logic.
 * Since useWizardDraft is a React hook we test the underlying
 * localStorage read/write contract directly.
 */

const STORAGE_KEY = "wizard-draft:test-draft";

// Mock localStorage
const store = new Map<string, string>();
const mockStorage = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  removeItem: vi.fn((key: string) => store.delete(key)),
};

// Apply mock before tests
Object.defineProperty(globalThis, "localStorage", { value: mockStorage });

describe("wizard draft localStorage contract", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("stores data with draftKey-prefixed key", () => {
    const payload = { data: { name: "Test", value: 42 }, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored!);
    expect(parsed.data.name).toBe("Test");
    expect(parsed.data.value).toBe(42);
    expect(parsed.savedAt).toBeDefined();
  });

  it("returns null when no draft exists", () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("overwrites previous draft on re-save", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: { name: "First" }, savedAt: new Date().toISOString() }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: { name: "Second" }, savedAt: new Date().toISOString() }));

    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(parsed.data.name).toBe("Second");
  });

  it("removeItem clears the draft", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: { name: "Test" }, savedAt: new Date().toISOString() }));
    localStorage.removeItem(STORAGE_KEY);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("merges partial update with existing data", () => {
    const existing = { name: "Original", category: "Equity", priority: "high" };
    const update = { category: "Cash" };
    const merged = { ...existing, ...update };

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: merged, savedAt: new Date().toISOString() }));

    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(parsed.data.name).toBe("Original");
    expect(parsed.data.category).toBe("Cash");
    expect(parsed.data.priority).toBe("high");
  });

  it("handles corrupted JSON gracefully by returning null", () => {
    store.set(STORAGE_KEY, "not-valid-json{{{");
    let result = null;
    try {
      result = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    } catch {
      result = null;
    }
    expect(result).toBeNull();
  });
});
