import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { getRealPublishedBooks } from "@/lib/data/real-books-adapter";
import { BOOKS } from "@/lib/data/catalog";
import { GetLinkButton } from "./GetLinkButton";

/** Browse any book on the shelf and generate a promotional link for it
 * — splitting "Promotions" out from Referral Links (which only lists
 * links you've already generated). */
export default async function PromotionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "AFFILIATE" && !(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const realBooks = await getRealPublishedBooks();
  const books = [...realBooks, ...BOOKS].slice(0, 30);

  return (
    <DashboardShell role={role} activeKey="promotions" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Promotions</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Browse the shelf and get a trackable link for any book.</p>
        </div>
      </div>
      <div className="map-card" style={{ padding: "6px 16px" }}>
        {books.map((b) => (
          <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{b.title}</div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>by {b.author} · ${b.price.toFixed(2)}</div>
            </div>
            <GetLinkButton bookId={b.id} />
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}
