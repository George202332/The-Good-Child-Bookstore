/**
 * Replaces the old "click to request a payout" button — nothing needs
 * to be manually requested. Everything earned in a calendar month
 * becomes payable on the 15th of the following month, once the total
 * due clears the minimum threshold; an admin then reviews and sends
 * the money manually (see actions/payouts.ts queueDuePayouts and
 * actions/admin.ts approvePayoutRequest — there's no automatic payment
 * execution). This component just explains the schedule and shows
 * what's coming.
 */
export function AutoPayoutInfo({
  onHold,
  available,
  nextReleaseDate,
  hasRecipient,
}: {
  onHold: number;
  available: number;
  nextReleaseDate: string | null;
  hasRecipient: boolean;
}) {
  const releaseLabel = nextReleaseDate
    ? new Date(nextReleaseDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="form-section" style={{ background: "var(--cream)" }}>
      <h3 style={{ fontSize: 15, marginBottom: 8 }}>How payouts work now</h3>
      <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 14 }}>
        Nothing to request — everything you earn in a calendar month becomes payable on the 15th of the following
        month, once it&apos;s confirmed. An admin reviews and sends the payment from there.
      </p>

      {!hasRecipient ? (
        <p style={{ fontSize: 13.5, color: "var(--coral-deep)" }}>
          You don&apos;t have a payout destination on file yet — add one below so your payouts have somewhere to go.
        </p>
      ) : (
        <>
          {onHold > 0 && (
            <div style={{ fontSize: 13.5, marginBottom: 6 }}>
              <strong>${onHold.toFixed(2)}</strong> is still on hold{releaseLabel ? `, releasing ${releaseLabel}` : ""}.
            </div>
          )}
          {available > 0 ? (
            <div style={{ fontSize: 13.5 }}>
              <strong>${available.toFixed(2)}</strong> is available and becomes payable on the next 15th.
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>Nothing is available for payout yet.</div>
          )}
        </>
      )}
    </div>
  );
}
