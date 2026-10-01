/**
 * Payout-method lock/cutoff rule — per explicit instruction, an
 * author/affiliate can't switch which payout method is active, or edit
 * the currently-active method's stored details, after the 10th of the
 * month. This gives the admin a predictable, stable set of payout
 * destinations to work from when preparing that month's manual batch
 * (see actions/payouts.ts queueDuePayouts and the CSV/PDF exports on
 * app/admin/payouts/page.tsx) — a destination can't change out from
 * under an already-queued payout.
 *
 * Deliberately narrow: adding a brand-new (not-yet-active) method,
 * editing a method that isn't currently active, and first-time setup
 * (the user has zero methods on file yet) are all allowed any time,
 * regardless of the date — see actions/payout-methods.ts for exactly
 * where this is enforced.
 */
export function isPayoutMethodLocked(date: Date = new Date()): boolean {
  return date.getDate() > 10;
}

export function payoutLockMessage(): string {
  return "Your payout method is locked for this cycle because it's past the 10th of the month. You can switch starting next cycle.";
}
