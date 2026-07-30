import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { DashboardShell } from "@/components/DashboardShell";
import { getAffiliateEarningsSummary } from "@/actions/affiliate-earnings-summary";
import { getCommissionRates, tierForReferralCount } from "@/lib/commission-settings";

const TIER_ACCENT: Record<string, string> = {
  Hawk: "#2451B7",
  Falcon: "#6B3FA0",
  Eagle: "#5B5B5B",
  Phoenix: "#8A2432",
};
const TIER_CARD_CLASS: Record<string, string> = {
  Hawk: "class-card-blue",
  Falcon: "class-card-purple",
  Eagle: "class-card-grey",
  Phoenix: "class-card-maroon",
};

/**
 * Class — the referral tier program (renamed from "Tier" per explicit
 * instruction). Not just a rate table: this is meant to reiterate that
 * we see referring affiliates as long-term partners in growing the
 * platform, not a one-off transaction — the more authors an affiliate
 * brings in, the higher their class and the bigger their lifetime share
 * of the COMPANY's revenue from those authors' book sales (never a
 * share of the authors' own revenue — that stays the authors').
 */
export default async function ClassPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "AUTHOR" && !(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const [summary, rates] = await Promise.all([getAffiliateEarningsSummary(), getCommissionRates()]);
  const count = summary.referredAuthorsCount;
  const tiers = rates.tiers;
  const currentTier = tierForReferralCount(count, tiers);
  const currentIndex = tiers.findIndex((t) => t.name === currentTier.name);
  const nextTier = currentIndex >= 0 && currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  const progressPct = nextTier
    ? Math.min(100, Math.round(((count - currentTier.minReferrals) / (nextTier.minReferrals - currentTier.minReferrals)) * 100))
    : 100;

  return (
    <DashboardShell role={role} activeKey="class" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Class</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Your referral class and rate.</p>
        </div>
      </div>

      <div className="map-card" style={{ padding: 24, marginBottom: 24, background: "var(--cream)" }}>
        <h3 style={{ fontSize: 17, marginBottom: 8 }}>We reward the work you put in</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7, maxWidth: 720 }}>
          Every author you bring onto this platform is a long-term relationship, not a one-time transaction — and we
          want our relationship with you to be the same. The more authors you refer, the higher your class climbs,
          and the bigger your lifetime share of <strong>the company&apos;s own revenue</strong> from those authors&apos;
          book sales — not a share of the authors&apos; own earnings, which always stay fully theirs. This is a
          genuinely symbiotic partnership: you help us grow, and we build your lifetime revenue right alongside you.
        </p>
      </div>

      <div className="map-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", textTransform: "uppercase", fontWeight: 700 }}>Your current class</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: TIER_ACCENT[currentTier.name] ?? "var(--ink)" }}>{currentTier.name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", textTransform: "uppercase", fontWeight: 700 }}>Authors referred</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{count}</div>
          </div>
        </div>
        {nextTier ? (
          <>
            <div style={{ height: 12, borderRadius: 999, background: "var(--line)", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: TIER_ACCENT[currentTier.name] ?? "var(--coral)", borderRadius: 999, transition: "width .3s ease" }} />
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
              {nextTier.minReferrals - count} more author{nextTier.minReferrals - count === 1 ? "" : "s"} to reach{" "}
              <strong style={{ color: TIER_ACCENT[nextTier.name] }}>{nextTier.name}</strong> ({(nextTier.pct * 100).toFixed(nextTier.pct * 100 % 1 === 0 ? 0 : 1)}% of company revenue)
            </p>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "#1F6B48", fontWeight: 700 }}>You&apos;ve reached the top class — thank you for everything you&apos;ve brought to this platform.</p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {tiers.map((t, i) => {
          const isCurrent = t.name === currentTier.name;
          const rangeLabel = t.maxReferrals === null ? `${t.minReferrals}+` : `${t.minReferrals}–${t.maxReferrals}`;
          return (
            <div
              key={t.name}
              className={`stat-card ${TIER_CARD_CLASS[t.name] ?? ""}`}
              style={{
                padding: 14,
                border: isCurrent ? `2px solid ${TIER_ACCENT[t.name] ?? "var(--coral)"}` : undefined,
                position: "relative",
              }}
            >
              {isCurrent && (
                <span className="status-pill status-review" style={{ position: "absolute", top: 8, right: 8, fontSize: 9.5, padding: "2px 7px" }}>Here</span>
              )}
              <div style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>Class {i + 1}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: TIER_ACCENT[t.name] ?? "var(--ink)", marginBottom: 5 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 3 }}>{rangeLabel} authors referred</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{(t.pct * 100).toFixed(t.pct * 100 % 1 === 0 ? 0 : 1)}%</div>
              <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>of company revenue, for life</div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 16 }}>
        For the full list of everyone you&apos;ve referred, see the Referrals tab under Affiliate.
      </p>
    </DashboardShell>
  );
}
