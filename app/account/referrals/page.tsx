import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { DashboardShell } from "@/components/DashboardShell";
import { listMyAffiliateLinks } from "@/actions/affiliate";
import { getMyProfile } from "@/actions/profile";
import { GenerateLinkForm } from "./GenerateLinkForm";

/**
 * Referral Links — real generation + real click/conversion counts, via
 * actions/affiliate.ts and the AffiliateLink/AffiliateClick/SaleLine
 * tables. Replaces the original's fully simulated affiliateBookStats()
 * (hashStr-seeded fake clicks/conversions for whichever books the
 * affiliate had "promoted" in localStorage).
 */
export default async function ReferralLinksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "AFFILIATE" && !(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const [links, profile] = await Promise.all([listMyAffiliateLinks(), getMyProfile()]);
  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const totalConversions = links.reduce((s, l) => s + l.conversions, 0);
  const totalEarned = links.reduce((s, l) => s + l.commissionEarned, 0);

  return (
    <DashboardShell role={role} activeKey="referrals" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Referral Links</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Generate a promotional link for any book, then share it: clicks and sales through it are tracked here.
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-label">Total clicks</div><div className="stat-value">{totalClicks}</div></div>
        <div className="stat-card"><div className="stat-label">Books sold</div><div className="stat-value">{totalConversions}</div></div>
        <div className="stat-card"><div className="stat-label">Commission earned</div><div className="stat-value">${totalEarned.toFixed(2)}</div></div>
      </div>

      {profile?.referralCode && (
        <div className="map-card" style={{ padding: 20, background: "var(--cream)", marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Refer an author</h3>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 10 }}>
            Share this link with any author: if they sign up through it, you earn 3% of the company&apos;s revenue
            from their book sales, for as long as they publish with us.
          </p>
          <code style={{ fontSize: 12.5 }}>/signup/author?ref={profile.referralCode}</code>
        </div>
      )}

      <GenerateLinkForm />

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Your links</h3>
      {links.length === 0 ? (
        <div className="map-card" style={{ padding: "24px 16px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>
          No promotional links yet; generate one above to get started.
        </div>
      ) : (
        <div className="inbox-list">
          {links.map((l) => (
            <div key={l.id} className="inbox-row">
              {l.bookCoverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.bookCoverUrl} alt={l.bookTitle} style={{ width: 40, aspectRatio: "2/3", objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
              ) : (
                <div className="inbox-avatar">{l.bookTitle.slice(0, 2).toUpperCase()}</div>
              )}
              <div className="inbox-row-body">
                <div className="inbox-name">{l.bookTitle}</div>
                <div className="inbox-preview">/book/{l.bookId}?aff={l.code}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: "var(--ink-faint)", flexShrink: 0 }}>
                {l.clicks} clicks<br />{l.conversions} sales<br /><strong style={{ color: "#1F6B48" }}>${l.commissionEarned.toFixed(2)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
