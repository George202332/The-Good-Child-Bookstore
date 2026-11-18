/**
 * The payout calendar. Two days of the month come from an ADMIN SETTING
 * (Site Settings → Payout Schedule), never from code:
 *   - lockDay    (default 10): payout details lock from this day…
 *   - releaseDay (default 15): …until the payout is released on this day.
 * They unlock on the day AFTER the release day (the 16th by default) and
 * can be changed freely until the lock day of the next month.
 *
 * Pure and free of any database access so the screens, the server actions
 * and the tests all use the very same rule. Dates are read in Nairobi time
 * (the business runs on that calendar), not in the visitor's browser zone.
 */

export const DEFAULT_PAYOUT_LOCK_DAY = 10;
export const DEFAULT_PAYOUT_RELEASE_DAY = 15;
export const PAYOUT_TIME_ZONE = "Africa/Nairobi";

export interface PayoutSchedule {
  lockDay: number;
  releaseDay: number;
}

export const DEFAULT_PAYOUT_SCHEDULE: PayoutSchedule = { lockDay: DEFAULT_PAYOUT_LOCK_DAY, releaseDay: DEFAULT_PAYOUT_RELEASE_DAY };

function dayOk(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 28;
}

/** Anything unusable falls back to the defaults; the lock day must come before the release day. */
export function resolvePayoutSchedule(stored: { payoutLockDay?: unknown; payoutReleaseDay?: unknown } | null | undefined): PayoutSchedule {
  const lockDay = dayOk(stored?.payoutLockDay) ? stored!.payoutLockDay as number : DEFAULT_PAYOUT_LOCK_DAY;
  const releaseDay = dayOk(stored?.payoutReleaseDay) ? stored!.payoutReleaseDay as number : DEFAULT_PAYOUT_RELEASE_DAY;
  if (lockDay >= releaseDay) return DEFAULT_PAYOUT_SCHEDULE;
  return { lockDay, releaseDay };
}

/** Year / month (1-12) / day as they are on the wall calendar in Nairobi. */
export function nairobiParts(date: Date): { year: number; month: number; day: number } {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: PAYOUT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

/** True from the lock day up to and including the release day. */
export function isPayoutDetailsLocked(schedule: PayoutSchedule, date: Date = new Date()): boolean {
  const { day } = nairobiParts(date);
  return day >= schedule.lockDay && day <= schedule.releaseDay;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDayMonth(day: number, month: number): string {
  return `${day} ${MONTHS[month - 1]}`;
}

/** The first day the details can be changed again (release day + 1, in the current month). */
export function unlockDateLabel(schedule: PayoutSchedule, date: Date = new Date()): string {
  const { month } = nairobiParts(date);
  return formatDayMonth(schedule.releaseDay + 1, month);
}

export function payoutLockMessage(schedule: PayoutSchedule, date: Date = new Date()): string {
  return `Your payout details are locked while this month's payout is prepared. You can change them from ${unlockDateLabel(schedule, date)}.`;
}

/**
 * The next day a user can still correct their details and be paid in the
 * following payout: the next lock day that has not started yet. Used in the
 * failed-payout message ("correct your details by 10 December").
 */
export function nextCorrectionDeadlineLabel(schedule: PayoutSchedule, date: Date = new Date()): string {
  const { month, day } = nairobiParts(date);
  // Details must be correct BEFORE the lock starts, so the last editable day is the day before the lock day.
  const lastEditable = schedule.lockDay - 1;
  const inThisMonth = day <= lastEditable;
  const m = inThisMonth ? month : month === 12 ? 1 : month + 1;
  return formatDayMonth(lastEditable, m);
}

export function failedPayoutMessage(schedule: PayoutSchedule, date: Date = new Date()): string {
  const deadline = nextCorrectionDeadlineLabel(schedule, date);
  const { month, day } = nairobiParts(date);
  const m = day <= schedule.lockDay - 1 ? month : month === 12 ? 1 : month + 1;
  return `Your payout could not be sent because of a problem with your payout details. Your balance is safe and stays in your account. Please correct your details by ${deadline}, and your payment will go out automatically on ${formatDayMonth(schedule.releaseDay, m)}.`;
}
