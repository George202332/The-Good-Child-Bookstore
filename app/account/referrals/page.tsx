import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyProfile } from "@/actions/profile";
import { getAffiliateEarningsSummary } from "@/actions/affiliate-earnings-summary";
import { getCommissionRates } from "@/lib/commission-settings";

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

  const [profile, summary, rates] = await Promise.all([
    getMyProfile(),
    getAffiliateEarningsSummary(),
    getCommissionRates(),
  ]);
  const referralPctLabel = `${(rates.referralPct * 100).toFixed(rates.referralPct * 100 % 1 === 0 ? 0 : 1)}%`;

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
          <div className="stat-sub">{referralPctLabel} of company revenue, for life</div>
        </div>
        <div className="stat-card stat-card-promotion">
          <div className="stat-label">Authors Referred</div>
          <div className="stat-value">{summary.referredAuthorsCount}</div>
          <div className="stat-sub">Signed up through your link</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Company Revenue From Them</div>
          <div className="stat-value">${summary.companyRevenueFromReferredAuthors.toFixed(2)}</div>
          <div className="stat-sub">Lifetime, before your cut</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">Their Own Earnings</div>
          <div className="stat-value">${summary.referredAuthorsOwnEarnings.toFixed(2)}</div>
          <div className="stat-sub">What your referred authors have made</div>
        </div>
      </div>

      {profile?.referralCode && (
        <div className="map-card" style={{ padding: 20, background: "var(--cream)" }}>
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Refer an author</h3>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 10 }}>
            Share this link with any author: if they sign up through it, you earn {referralPctLabel} of the
            company&apos;s revenue from their book sales, for as long as they publish with us.
          </p>
          <code style={{ fontSize: 12.5 }}>/signup/author?ref={profile.referralCode}</code>
        </div>
      )}
    </DashboardShell>
  );
}
