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
}: {
  onHold: number;
  available: number;
  hasRecipient: boolean;
}) {
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
          {onHold > 0 && (
            <div style={{ fontSize: 13.5, marginBottom: 6 }}>
              <strong>${onHold.toFixed(2)}</strong> is still on hold.
            </div>
          )}
          {available > 0 ? (
            <div style={{ fontSize: 13.5 }}>
              <strong>${available.toFixed(2)}</strong> is confirmed and will be released by the 15th.
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>Nothing is available for payout yet.</div>
          )}
        </>
      )}
    </div>
  );
}
