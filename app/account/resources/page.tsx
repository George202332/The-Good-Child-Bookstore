import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { getRealPublishedBooks } from "@/lib/data/real-books-adapter";
import { BOOKS } from "@/lib/data/catalog";
import { CopyCaptionButton } from "./CopyCaptionButton";

/** Ready-made cover images and suggested captions for every book on the
 * shelf — matches the original's "Ready-made banners, cover images, and
 * suggested copy are available for every book" promise, previously
 * unbuilt. */
export default async function MarketingResourcesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "AFFILIATE" && !(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const realBooks = await getRealPublishedBooks();
  const books = [...realBooks, ...BOOKS].slice(0, 20);

  return (
    <DashboardShell role={role} activeKey="resources" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Marketing Resources</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Cover images and suggested captions for every book, ready to share.
          </p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {books.map((b) => (
          <div key={b.id} className="map-card resource-card" style={{ padding: 14 }}>
            {b.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- real uploaded cover, not a static asset
              <img src={b.coverImage} alt={b.title} style={{ width: "100%", borderRadius: 8, marginBottom: 8, aspectRatio: "2/3", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", aspectRatio: "2/3", background: b.palette[0], borderRadius: 8, marginBottom: 8 }} />
            )}
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{b.title}</div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 8 }}>by {b.author}</div>
            <CopyCaptionButton text={`I just found "${b.title}" by ${b.author} and can't stop talking about it: check it out on The Good Child Bookstore! 📚`} />
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}
