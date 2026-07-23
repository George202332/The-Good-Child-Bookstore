import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";

interface SaleLineShare {
  authorShare: unknown;
}
interface AuthorBook {
  id: string;
  title: string;
  status: string;
  price: unknown;
  saleLines: SaleLineShare[];
}

/**
 * "My Books" — real data (title, status, sales, earnings per book) from
 * the author's actual Book + SaleLine rows. The original's equivalent
 * page also covered uploading new books (PDF/EPUB/cover files, ISBN,
 * metadata) and editing existing ones; that upload/edit flow isn't built
 * yet (needs file storage wired up — see docs/architecture.md), so this
 * is read-only for now.
 */
export default async function MyBooksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { authorProfile: { include: { books: { include: { saleLines: true } } } } },
  });
  const books = (user?.authorProfile?.books ?? []) as AuthorBook[];

  return (
    <DashboardShell role="AUTHOR" activeKey="mybooks" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>My Books</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Your titles and how each is performing.</p>
        </div>
      </div>
      {books.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          You haven&apos;t published any books yet. Book upload isn&apos;t wired up in this build yet.
        </div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {books.map((b) => {
            const sales = b.saleLines.length;
            const earnings = b.saleLines.reduce((sum, l) => sum + Number(l.authorShare), 0);
            return (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{b.status} · {sales} sold · ${earnings.toFixed(2)} earned</div>
                </div>
                <Link href={`/book/${b.id}`} className="btn btn-ghost btn-small">View</Link>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
