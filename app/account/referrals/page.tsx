import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyProfile } from "@/actions/profile";
import { getAffiliateEarningsSummary } from "@/actions/affiliate-earnings-summary";
import { getCommissionRates } from "@/lib/commission-settings";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { getReferredAuthorsDetail } from "@/actions/referred-authors";
import { ColHelp } from "@/components/ColHelp";

const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid var(--line)" };

/**
 * Referrals — about referring AUTHORS onto the platform specifically
 * (separate from Promotions, which is about promoting individual books
 * via direct affiliate links — see app/account/active-campaigns). The 4
 * stat cards cover the full picture of what a referral relationship
 * produces: this affiliate's own lifetime commission, how many authors
 * they've referred, how much the company itself has made from those
 * authors, and how much the referred authors themselves have earned.
 */
export default async function ReferralsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "AFFILIATE" && !(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const [profile, summary, rates, referredAuthors] = await Promise.all([
    getMyProfile(),
    getAffiliateEarningsSummary(),
    getCommissionRates(),
    getReferredAuthorsDetail(),
  ]);
  const referralPctLabel = `${(rates.referralPct * 100).toFixed(rates.referralPct * 100 % 1 === 0 ? 0 : 1)}%`;
  const siteUrl = getPublicSiteUrl();

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
          <div className="stat-sub">{referralPctLabel}, for life</div>
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
        <div className="map-card" style={{ padding: 20, background: "var(--cream)" }}>
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Refer an author</h3>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 10 }}>
            Share this link with any author: if they sign up through it, you earn {referralPctLabel} of the
            company&apos;s revenue from their book sales, for as long as they publish with us.
          </p>
          <code style={{ fontSize: 12.5 }}>{siteUrl}/signup/author?ref={profile.referralCode}</code>
        </div>
      )}

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
