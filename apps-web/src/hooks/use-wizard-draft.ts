"use client";

import { useState, useCallback } from "react";

/**
 * Hook for persisting wizard draft state to localStorage.
 *
 * Usage:
 *   const { data, update, clear } = useWizardDraft<MyFormData>("saa-create", defaultValues);
 */
export function useWizardDraft<T extends object>(
  draftKey: string,
  defaultValue: T,
): {
  data: T;
  update: (partial: Partial<T>) => void;
  clear: () => void;
  lastSaved: Date | null;
} {
  const storageKey = `wizard-draft:${draftKey}`;

  const [state, setState] = useState<{ data: T; lastSaved: Date | null }>(() => {
    if (typeof window === "undefined") return { data: defaultValue, lastSaved: null };
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          data: { ...defaultValue, ...parsed.data } as T,
          lastSaved: parsed.savedAt ? new Date(parsed.savedAt) : null,
        };
      }
    } catch {
      // Corrupted data — start fresh
    }
    return { data: defaultValue, lastSaved: null };
  });

  /** Persist to localStorage and return the save timestamp */
  function persist(newData: T): Date {
    const now = new Date();
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ data: newData, savedAt: now.toISOString() }),
      );
    } catch {
      // localStorage full or unavailable — fail silently
    }
    return now;
  }

  const update = useCallback(
    (partial: Partial<T>) => {
      setState((prev) => {
        const newData = { ...prev.data, ...partial };
        const savedAt = persist(newData);
        return { data: newData, lastSaved: savedAt };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey],
  );

  const clear = useCallback(() => {
    localStorage.removeItem(storageKey);
    setState({ data: defaultValue, lastSaved: null });
  }, [storageKey, defaultValue]);

  return { data: state.data, update, clear, lastSaved: state.lastSaved };
}
