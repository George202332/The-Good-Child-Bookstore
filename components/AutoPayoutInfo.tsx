/**
 * Replaces the old "click to request a payout" button — nothing needs
 * to be manually requested. Everything earned in a calendar month is
 * reviewed once that month closes and, once the total due clears the
 * $30 minimum, is sent by the 15th of the following month at the
 * latest (see actions/payouts.ts queueDuePayouts and actions/admin.ts
 * approvePayoutRequest — there's no automatic payment execution). This
 * component just explains the schedule and shows what's coming.
 *
 * Per explicit instruction, the ONLY payout date ever communicated to
 * an author/affiliate is "released by the 15th" — the underlying
 * release-date math (lib/wallet.ts's releaseDateFor, the 1st of the
 * month after a sale) still exists internally to decide WHEN a sale's
 * earnings become eligible to be counted toward that $30 threshold,
 * but that date itself is never surfaced here or anywhere else
 * user-facing.
 */
export function AutoPayoutInfo({
  onHold,
  available,
  hasRecipient,
  rolledOver = 0,
}: {
  /** The current cycle's accumulating amount. */
  onHold: number;
  /** Released, unpaid money (Pending, or Rolled while under $30). */
  available: number;
  hasRecipient: boolean;
  /** The part of `available` that is Rolled (under $30). It is folded
   * into the live figure and so is not counted again as available. */
  rolledOver?: number;
}) {
  const liveTotal = onHold + rolledOver;
  const pendingAvailable = Math.max(0, available - rolledOver);
  return (
    <div className="form-section" style={{ background: "var(--cream)" }}>
      <h3 style={{ fontSize: 15, marginBottom: 8 }}>How payouts work now</h3>
      <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 14 }}>
        Nothing to request — everything you earn is reviewed once it&apos;s confirmed and, once it clears the $30
        minimum, is released by the 15th. An admin reviews and sends the payment from there.
      </p>

      {!hasRecipient ? (
        <p style={{ fontSize: 13.5, color: "var(--coral-deep)" }}>
          You don&apos;t have a payout destination on file yet — add one below so your payouts have somewhere to go.
        </p>
      ) : (
        <>
          {liveTotal > 0 && (
            <div style={{ fontSize: 13.5, marginBottom: 6 }}>
              <strong>${liveTotal.toFixed(2)}</strong> is live and still growing.
            </div>
          )}
          {pendingAvailable > 0 ? (
            <div style={{ fontSize: 13.5 }}>
              <strong>${pendingAvailable.toFixed(2)}</strong> is pending and will be released by the 15th.
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>Nothing is pending payout yet.</div>
          )}
        </>
      )}
    </div>
  );
}
