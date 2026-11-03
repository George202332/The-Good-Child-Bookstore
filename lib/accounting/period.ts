/**
 * Accounting months. A month is a calendar month in Nairobi time (UTC+3, no daylight saving), the same
 * business time zone the rest of the site uses (lib/month-range.ts). A month is written "YYYY-MM".
 */
const NAIROBI_OFFSET_MS = 3 * 3600_000;

export const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(v: unknown): v is string {
  return typeof v === "string" && MONTH_KEY.test(v);
}

/** The Nairobi calendar month an instant falls in. */
export function monthKeyOf(d: Date): string {
  const local = new Date(d.getTime() + NAIROBI_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The instant a month began (inclusive) and the instant the next one begins (exclusive), in Nairobi time. */
export function monthBounds(key: string): { start: Date; end: Date } {
  const [y, m] = key.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - NAIROBI_OFFSET_MS),
    end: new Date(Date.UTC(y, m, 1) - NAIROBI_OFFSET_MS),
  };
}

export function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Every month from `from` to `to` inclusive, oldest first. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let k = from;
  for (let i = 0; i < 1200 && k <= to; i++) {
    out.push(k);
    k = nextMonthKey(k);
  }
  return out;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "Oct 26" */
export function shortMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${String(y).slice(2)}`;
}

/** Whether `now` (in Nairobi time) falls on the last calendar day of the month. */
export function isLastDayOfMonth(now: Date): boolean {
  const local = new Date(now.getTime() + NAIROBI_OFFSET_MS);
  const tomorrow = new Date(local.getTime() + 86_400_000);
  return tomorrow.getUTCMonth() !== local.getUTCMonth();
}

/** The date "YYYY-MM-DD" as entered in a form is valid and a real calendar day. */
export function isDateString(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
