/**
 * The prominent, main-dashboard-overview version of the Payouts page's
 * "On Hold"/"Paid This Month" stat card — per explicit instruction,
 * surfaced here too (not just tucked away on Payout Settings), and
 * visually distinctive from the other overview stat cards: an amber
 * left accent + hold icon while on hold, swapping to a green accent +
 * checkmark the moment it's actually been paid. Pulls the exact same
 * figure (see lib/payout-monthly.ts computePayoutStatCards) so the two
 * can never disagree, and — like the rest of the dashboard — gets
 * fresh data on every LiveRefresher-triggered reload, so the flip from
 * "On Hold" to "Paid" (an Admin clicking "Mark as Paid", individually
 * or in bulk — see app/admin/payouts/PayoutsTable.tsx) shows up here
 * without the author/affiliate needing to do anything.
 */
export function PayoutHoldBanner({ amount, status }: { amount: number; status: "Pending" | "Paid" }) {
  const isPaid = status === "Paid";
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
        borderLeft: `5px solid ${isPaid ? "#1F6B48" : "#C4780B"}`,
        background: isPaid ? "rgba(31,107,72,0.08)" : "rgba(196,120,20,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isPaid ? "rgba(31,107,72,0.18)" : "rgba(196,120,20,0.18)",
          }}
          aria-hidden
        >
          {isPaid ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1F6B48" strokeWidth={2.4}>
              <path d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C4780B" strokeWidth={2.2}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          )}
        </span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: isPaid ? "#1F6B48" : "#8A5A0F" }}>
            {isPaid ? "Last month's payout: Paid" : "Last month's payout: On Hold"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
            {isPaid ? "Sent to your payout destination on file." : "Released — due to be paid by the 15th of this month."}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: isPaid ? "#1F6B48" : "#8A5A0F" }}>${amount.toFixed(2)}</div>
    </div>
  );
}
