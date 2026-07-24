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
  hasEbook: boolean;
  hasPrint: boolean;
  hasAudiobook: boolean;
  saleLines: SaleLineShare[];
}

/**
 * "My Books" — real data (title, status, formats, sales, earnings per
 * book) from the author's actual Book + SaleLine rows. Submitting a new
 * title (real Book row, real ISBN, real Draft → Pending Review workflow)
 * now works at /account/books/new — see actions/submissions.ts for the
 * one scope limit (cover image is a URL, not a file upload, since real
 * file storage isn't wired up yet).
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
        <Link href="/account/books/new" className="btn btn-primary btn-small">Submit a new title</Link>
      </div>
      {books.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          You haven&apos;t published any books yet — submit your first title above.
        </div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {books.map((b) => {
            const sales = b.saleLines.length;
            const earnings = b.saleLines.reduce((sum, l) => sum + Number(l.authorShare), 0);
            const formats = [b.hasEbook && "eBook", b.hasPrint && "Print", b.hasAudiobook && "Audiobook"].filter(Boolean).join(" · ");
            return (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                    {b.status} · {sales} sold · ${earnings.toFixed(2)} earned{formats ? ` · ${formats}` : ""}
                  </div>
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
