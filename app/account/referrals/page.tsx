import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { DashboardShell } from "@/components/DashboardShell";
import { listMyAffiliateLinks } from "@/actions/affiliate";
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

  const links = await listMyAffiliateLinks();

  return (
    <DashboardShell role={role} activeKey="referrals" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Referral Links</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Generate a promotional link for any book, then share it — clicks and sales through it are tracked here.
          </p>
        </div>
      </div>

      <GenerateLinkForm />

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Your links</h3>
      {links.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          No promotional links yet — generate one above to get started.
        </div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {links.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{l.bookTitle}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  /book/{l.bookId}?aff={l.code} · {l.clicks} clicks · {l.conversions} sales
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
