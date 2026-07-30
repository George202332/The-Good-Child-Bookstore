import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyProfile } from "@/actions/profile";
import { getAffiliateEarningsSummary } from "@/actions/affiliate-earnings-summary";
import { getCommissionRates, tierForReferralCount } from "@/lib/commission-settings";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { getReferredAuthorsDetail } from "@/actions/referred-authors";
import { ColHelp } from "@/components/ColHelp";

const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid var(--line)" };

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
 * Referrals — about referring AUTHORS onto the platform specifically
 * (separate from Promotions, which is about promoting individual books
 * via direct affiliate links — see app/account/active-campaigns). The 4
 * stat cards cover the full picture of what a referral relationship
 * produces. The Tier program (previously its own page) now lives
 * inline here, between the referral link and the referred-authors
 * table, per explicit instruction.
 */
export default async function ReferralsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (!(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const [profile, summary, rates, referredAuthors] = await Promise.all([
    getMyProfile(),
    getAffiliateEarningsSummary(),
    getCommissionRates(),
    getReferredAuthorsDetail(),
  ]);
  const count = summary.referredAuthorsCount;
  const tiers = rates.tiers;
  const currentTier = tierForReferralCount(count, tiers);
  const referralPctLabel = `${(currentTier.pct * 100).toFixed(currentTier.pct * 100 % 1 === 0 ? 0 : 1)}%`;
  const siteUrl = getPublicSiteUrl();

  const currentIndex = tiers.findIndex((t) => t.name === currentTier.name);
  const nextTier = currentIndex >= 0 && currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  const progressPct = nextTier
    ? Math.min(100, Math.round(((count - currentTier.minReferrals) / (nextTier.minReferrals - currentTier.minReferrals)) * 100))
    : 100;

  return (
    <DashboardShell role={role} activeKey="referrals" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Referrals</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            What you&apos;ve earned, and made possible, by referring authors onto the platform.
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card stat-card-referral">
          <div className="stat-label">Lifetime Referral Commission</div>
          <div className="stat-value">${summary.referralEarnings.toFixed(2)}</div>
          <div className="stat-sub">{referralPctLabel} of company revenue</div>
        </div>
        <div className="stat-card stat-card-promotion">
          <div className="stat-label">Authors Referred</div>
          <div className="stat-value">{summary.referredAuthorsCount}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Company Revenue From Them</div>
          <div className="stat-value">${summary.companyRevenueFromReferredAuthors.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">This Month&apos;s Commission</div>
          <div className="stat-value">${summary.referralEarningsThisMonth.toFixed(2)}</div>
          <div className="stat-sub">This month</div>
        </div>
      </div>

      {profile?.referralCode && (
        <div className="map-card" style={{ padding: 20, background: "var(--cream)", marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Refer an author</h3>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 10 }}>
            Share this link with any author: if they sign up through it, you earn {referralPctLabel} of the
            company&apos;s revenue from their book sales, for as long as they publish with us — your current tier
            is <strong>{currentTier.name}</strong>.
          </p>
          <code style={{ fontSize: 12.5 }}>{siteUrl}/signup/author?ref={profile.referralCode}</code>
        </div>
      )}

      <div className="map-card" style={{ padding: 24, marginBottom: 20, background: "var(--cream)" }}>
        <h3 style={{ fontSize: 17, marginBottom: 8 }}>We reward the work you put in</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          Every author you bring onto this platform is a long-term relationship, not a one-time transaction — and we
          want our relationship with you to be the same. The more authors you refer, the higher your class climbs,
          and the bigger your lifetime share of the company&apos;s own revenue from those authors&apos; book sales — not
          a share of the authors&apos; own earnings, which always stay fully theirs. This is a genuinely symbiotic
          partnership: you help us grow, and we build your lifetime revenue right alongside you.
        </p>
      </div>

      <div className="map-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", textTransform: "uppercase", fontWeight: 700 }}>Your current tier</div>
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
          <p style={{ fontSize: 13, color: "#1F6B48", fontWeight: 700 }}>You&apos;ve reached the top tier — thank you for everything you&apos;ve brought to this platform.</p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
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
              <div style={{ fontSize: 10.5, color: "var(--ink-faint)", textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>Tier {i + 1}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: TIER_ACCENT[t.name] ?? "var(--ink)", marginBottom: 5 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 3 }}>{rangeLabel} authors referred</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{(t.pct * 100).toFixed(t.pct * 100 % 1 === 0 ? 0 : 1)}%</div>
              <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>of company revenue, for life</div>
            </div>
          );
        })}
      </div>

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Authors you&apos;ve referred</h3>
      <div className="map-card" style={{ padding: 20 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>Author<ColHelp text="The name of the author who signed up using your referral link." /></th>
                <th style={TABLE_HEAD_STYLE}>Country<ColHelp text="The country the author has listed on their own profile. Blank if they haven't set it." /></th>
                <th style={TABLE_HEAD_STYLE}>Gender<ColHelp text="Self-reported by the author on their own profile. Blank if they haven't set it." /></th>
                <th style={TABLE_HEAD_STYLE}>Books Published<ColHelp text="How many of this author's books are currently live and for sale." /></th>
                <th style={TABLE_HEAD_STYLE}>Company Revenue<ColHelp text="The company's lifetime revenue from this author's book sales, before your commission is carved out of it." /></th>
                <th style={TABLE_HEAD_STYLE}>Your Commission<ColHelp text="What you've earned, lifetime, from this specific author's sales." /></th>
              </tr>
            </thead>
            <tbody>
              {referredAuthors.length === 0 ? (
                <tr><td style={TABLE_CELL_STYLE} colSpan={6}>No authors referred yet — share your link above to get started.</td></tr>
              ) : (
                referredAuthors.map((a, i) => (
                  <tr key={i}>
                    <td style={TABLE_CELL_STYLE}>{a.name}</td>
                    <td style={TABLE_CELL_STYLE}>{a.country || "—"}</td>
                    <td style={TABLE_CELL_STYLE}>{a.gender || "—"}</td>
                    <td style={TABLE_CELL_STYLE}>{a.booksPublished}</td>
                    <td style={TABLE_CELL_STYLE}>${a.companyRevenue.toFixed(2)}</td>
                    <td style={TABLE_CELL_STYLE}>${a.commission.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
