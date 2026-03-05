/**
 * Deterministic date/time formatting.
 * Uses explicit locale + timeZone to avoid server/client hydration mismatches.
 */

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateFormatter.format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateTimeFormatter.format(d);
}
