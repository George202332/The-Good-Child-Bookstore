/** Business time zone for "this month" figures (Nairobi, UTC+3, no daylight saving). */
const BUSINESS_UTC_OFFSET_HOURS = 3;

/** The instant the current calendar month began in Nairobi, and a label
 * such as "October 2026". */
export function currentMonthStart(now: Date = new Date()): { start: Date; label: string } {
  const local = new Date(now.getTime() + BUSINESS_UTC_OFFSET_HOURS * 3600_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1) - BUSINESS_UTC_OFFSET_HOURS * 3600_000);
  const label = new Date(Date.UTC(y, m, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return { start, label };
}
