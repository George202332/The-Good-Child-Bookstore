/**
 * The prominent, main-dashboard-overview version of the Payouts page's
 * "Next Payout" stat card — per explicit instruction, surfaced here too
 * (not just tucked away on Payout Settings). Pulls the exact same
 * figure (see lib/payout-monthly.ts computePayoutStatCards) so the two
 * can never disagree, and — like the rest of the dashboard — gets
 * fresh data on every LiveRefresher-triggered reload.
 *
 * Renamed "On Hold" → "Next Payment" → **"Next Payout"** (Amendment 7,
 * 2nd rename) — each round's label kept drifting back toward how this
 * money is tracked internally rather than what it actually is from the
 * author/affiliate's own point of view: the payout that's coming next.
 *
 * Visibility (Amendment 7 — corrected): previous rounds rendered this
 * whenever `pendingPayout > 0`, including AFTER an Admin marks it paid
 * (status flipped to "Paid" but the amount itself doesn't zero out, so
 * the banner just changed color and kept showing indefinitely). The
 * actual rule — "appears at midnight rollover into the 1st, disappears
 * once paid" — means this card represents exactly ONE thing: the most
 * recently closed month's payout, from the moment it's released until
 * the moment it's paid, and nothing after that or before it.
 * `pendingPayout` (lib/payout-monthly.ts computePayoutStatCards) already
 * has the right "appears only once released" shape for free — it's
 * always computed from the previous CALENDAR month's range, so it goes
 * from $0 to a real figure exactly when the calendar flips to the 1st,
 * never showing accruing current-month money early (see releaseDateFor
 * in lib/wallet.ts, which releases on exactly that same boundary).
 * What was missing was the other half — making it disappear once paid,
 * instead of switching to a lingering "Paid" variant of itself: this
 * component no longer renders a paid state at all, and its caller
 * (app/account/page.tsx) now gates BOTH places it's rendered on
 * `pendingStatus !== "Paid"` in addition to `pendingPayout > 0`, so the
 * card simply isn't in the tree any more the moment it's paid — no
 * layout gap, since an unrendered card reserves no space.
 */
export function PayoutHoldBanner({ amount }: { amount: number }) {
  return (
    <div
      className="map-card"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "16px 20px",
        marginBottom: 20,
        borderLeft: "5px solid #C4780B",
        background: "rgba(196,120,20,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(196,120,20,0.18)",
          }}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C4780B" strokeWidth={2.2}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        </span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#8A5A0F" }}>
            Next Payout
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
            Released — due to be paid by the 15th of this month.
          </div>
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#8A5A0F" }}>${amount.toFixed(2)}</div>
    </div>
  );
}
