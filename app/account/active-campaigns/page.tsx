import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { listMyAffiliateLinks } from "@/actions/affiliate";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { CopyLinkButton } from "./CopyLinkButton";

/**
 * Active Campaigns — every book this affiliate (or a reader/author
 * acting in the capacity of an affiliate) currently has a generated
 * link for, and nothing else. Distinct from Promotions (which lists
 * every book on the shelf, promoted or not, so a link can be generated
 * for a new one) — this page is specifically "what am I actively
 * promoting right now," with the real, shareable link shown for each.
 *
 * One link per book per affiliate is already enforced at the data
 * layer (actions/affiliate.ts getOrCreateAffiliateLink reuses the
 * existing link rather than creating a duplicate) — this page is what
 * makes that guarantee visible and easy to trust.
 */
export default async function ActiveCampaignsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "AFFILIATE" && !(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const links = await listMyAffiliateLinks();
  const siteUrl = getPublicSiteUrl();

  return (
    <DashboardShell role={role} activeKey="active-campaigns" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Active Campaigns</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Every book you currently have a link for. Sharing that link anywhere — a blog post, social media,
            email, wherever — earns you 10% of the sale whenever someone buys through it, in any format.
          </p>
        </div>
      </div>

      {links.length === 0 ? (
        <div className="map-card" style={{ padding: "24px 16px", color: "var(--ink-faint)", fontSize: 13.5, textAlign: "center" }}>
          You&apos;re not promoting any books yet — head to Promotions to generate your first link.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {links.map((l) => {
            const url = `${siteUrl}/book/${l.bookId}?aff=${l.code}`;
            return (
              <div key={l.id} className="map-card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                {l.bookCoverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.bookCoverUrl} alt={l.bookTitle} style={{ width: 56, aspectRatio: "2/3", objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 56, aspectRatio: "2/3", background: "var(--lavender)", borderRadius: 8, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{l.bookTitle}</div>
                  <code style={{ fontSize: 12, color: "var(--ink-faint)", wordBreak: "break-all" }}>{url}</code>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 4 }}>
                    {l.clicks} clicks · {l.conversions} sales · ${l.commissionEarned.toFixed(2)} earned
                  </div>
                </div>
                <CopyLinkButton url={url} />
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
