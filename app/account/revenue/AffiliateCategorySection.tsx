import type { AffiliateEarningsSummary } from "@/actions/affiliate-earnings-summary";

/**
 * The two earning-category detail cards (matching the reference design)
 * plus a distribution chart showing how an affiliate's earnings split
 * between the two categories — a simple, real 2-segment bar built from
 * the same genuine data as the cards above it, not a separate estimate.
 */
export function AffiliateCategorySection({ data }: { data: AffiliateEarningsSummary }) {
  const total = Math.max(0.01, data.totalEarnings);
  const referralPct = Math.round((data.referralEarnings / total) * 100);
  const promotionPct = 100 - referralPct;

  return (
    <>
      <div className="affiliate-category-card affiliate-category-a">
        <span className="affiliate-category-tag affiliate-category-tag-a">Category A</span>
        <h3 style={{ fontSize: 15, margin: "8px 0 8px" }}>Author referrals: 3% of company revenue</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 12 }}>
          When an author signs up using your referral link and publishes with us, you earn <strong>3% of the
          company&apos;s revenue from that author</strong> (3% of our 25% share of their book sales) for as long as
          they publish with us. This is tracked via your unique referral link below.
        </p>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          ${data.referralEarnings.toFixed(2)} <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-faint)" }}>earned to date from {data.referredAuthorsCount} referred author{data.referredAuthorsCount === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="affiliate-category-card affiliate-category-b">
        <span className="affiliate-category-tag affiliate-category-tag-b">Category B</span>
        <h3 style={{ fontSize: 15, margin: "8px 0 8px" }}>Book promotions: 10% of list price</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 12 }}>
          When a reader buys a book through one of your unique promotional links, you earn <strong>10% of the
          book&apos;s listed price</strong>, regardless of who wrote it. Each book gets its own tracked link so every
          sale is attributed to you accurately.
        </p>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          ${data.promotionEarnings.toFixed(2)} <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-faint)" }}>earned to date from {data.promotedBooksCount} book{data.promotedBooksCount === 1 ? "" : "s"} promoted</span>
        </div>
      </div>

      <div className="map-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 14 }}>Distribution of affiliate earnings</h3>
        {data.totalEarnings === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>No affiliate earnings yet.</p>
        ) : (
          <>
            <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden" }}>
              {referralPct > 0 && <div style={{ width: `${referralPct}%`, background: "#3D7FE8" }} title={`Referrals: ${referralPct}%`} />}
              {promotionPct > 0 && <div style={{ width: `${promotionPct}%`, background: "#E8874A" }} title={`Promotions: ${promotionPct}%`} />}
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: 12.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3D7FE8", display: "inline-block" }} /> Referrals: {referralPct}% (${data.referralEarnings.toFixed(2)})</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#E8874A", display: "inline-block" }} /> Promotions: {promotionPct}% (${data.promotionEarnings.toFixed(2)})</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
