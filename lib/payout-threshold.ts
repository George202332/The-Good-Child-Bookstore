/** The minimum payout. Payouts below this amount are held over to the next monthly cycle
 * instead of being released - nothing under it gets paid out on its own. It simply rolls
 * forward and combines with next month's earnings until the combined total reaches it.
 *
 * The amount is a setting the admin can change (Admin -> Payouts -> Minimum Payout), stored in the database
 * (lib/payout-minimum.ts). DEFAULT_MIN_PAYOUT_AMOUNT ($30) is used until the admin changes it. Code that needs the
 * current value calls getMinPayoutAmount(); server code refreshes it from the database first (loadMinimumPayout()). */
export const DEFAULT_MIN_PAYOUT_AMOUNT = 30;

/** The default minimum, kept under its old name for existing imports and tests. Use getMinPayoutAmount() for the live value. */
export const MIN_PAYOUT_AMOUNT = DEFAULT_MIN_PAYOUT_AMOUNT;

let active = DEFAULT_MIN_PAYOUT_AMOUNT;

/** A valid minimum is a number from 0.01 to 100000, rounded to cents. Anything else falls back to the default. */
export function normaliseMinimumPayout(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n < 0.01 || n > 100000) return DEFAULT_MIN_PAYOUT_AMOUNT;
  return Math.round(n * 100) / 100;
}

export function getMinPayoutAmount(): number {
  return active;
}

export function setMinPayoutAmount(v: unknown): number {
  active = normaliseMinimumPayout(v);
  return active;
}

/** "$30" or "$12.50" - whole dollars without decimals. */
export function formatMinimumPayout(n: number = active): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** True when this amount is below the current minimum (compared in cents, so $29.999 never slips through as $30). */
export function isBelowMinimumPayout(amount: number): boolean {
  return Math.round(amount * 100) < Math.round(active * 100);
}
