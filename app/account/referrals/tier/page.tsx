import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { DashboardShell } from "@/components/DashboardShell";
import { getAffiliateEarningsSummary } from "@/actions/affiliate-earnings-summary";
import { getCommissionRates, tierForReferralCount } from "@/lib/commission-settings";

const TIER_COLORS: Record<string, string> = {
  Hawk: "#8A5A0B",
  Falcon: "#2451B7",
  Eagle: "#7A5FB5",
  Phoenix: "#B7472A",
};

/**
 * Tier — the referral-tier program. Not just a rate table: this is
 * meant to reiterate that we see referring affiliates as long-term
 * partners in growing the platform, not a one-off transaction — the
 * more authors an affiliate brings in, the higher their tier and the
 * bigger their lifetime share of the revenue those authors generate.
 */
export default async function TierPage() {
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
    <DashboardShell role={role} activeKey="tier" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Tier</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            <Link href="/account/referrals" style={{ color: "var(--coral-deep)" }}>← Back to Referrals</Link>
          </p>
        </div>
      </div>

      <div className="map-card" style={{ padding: 24, marginBottom: 24, background: "var(--cream)" }}>
        <h3 style={{ fontSize: 17, marginBottom: 8 }}>We reward the work you put in</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7, maxWidth: 720 }}>
          Every author you bring onto this platform is a long-term relationship, not a one-time transaction — and we
          want our relationship with you to be the same. The more authors you refer, the higher your tier climbs,
          and the bigger your lifetime share of the revenue those authors generate. This is a genuinely symbiotic
          partnership: you help us grow, and we build your lifetime revenue right alongside you.
        </p>
      </div>

      <div className="map-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", textTransform: "uppercase", fontWeight: 700 }}>Your current tier</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: TIER_COLORS[currentTier.name] ?? "var(--ink)" }}>{currentTier.name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", textTransform: "uppercase", fontWeight: 700 }}>Authors referred</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{count}</div>
          </div>
        </div>
        {nextTier ? (
          <>
            <div style={{ height: 12, borderRadius: 999, background: "var(--line)", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: TIER_COLORS[currentTier.name] ?? "var(--coral)", borderRadius: 999, transition: "width .3s ease" }} />
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
              {nextTier.minReferrals - count} more author{nextTier.minReferrals - count === 1 ? "" : "s"} to reach{" "}
              <strong style={{ color: TIER_COLORS[nextTier.name] }}>{nextTier.name}</strong> ({(nextTier.pct * 100).toFixed(nextTier.pct * 100 % 1 === 0 ? 0 : 1)}%)
            </p>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "#1F6B48", fontWeight: 700 }}>You&apos;ve reached the top tier — thank you for everything you&apos;ve brought to this platform.</p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {tiers.map((t) => {
          const isCurrent = t.name === currentTier.name;
          const rangeLabel = t.maxReferrals === null ? `${t.minReferrals}+` : `${t.minReferrals}–${t.maxReferrals}`;
          return (
            <div
              key={t.name}
              className="map-card"
              style={{
                padding: 20,
                border: isCurrent ? `2px solid ${TIER_COLORS[t.name] ?? "var(--coral)"}` : undefined,
                position: "relative",
              }}
            >
              {isCurrent && (
                <span className="status-pill status-review" style={{ position: "absolute", top: 14, right: 14 }}>You are here</span>
              )}
              <div style={{ fontSize: 12, color: "var(--ink-faint)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Tier {t.minReferrals === 0 ? 1 : tiers.findIndex((x) => x.name === t.name) + 1}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: TIER_COLORS[t.name] ?? "var(--ink)", marginBottom: 8 }}>{t.name}</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 4 }}>{rangeLabel} authors referred</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{(t.pct * 100).toFixed(t.pct * 100 % 1 === 0 ? 0 : 1)}%</div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>of company revenue, for life</div>
            </div>
          );
        })}
      </div>
    </DashboardShell>
  );
}
