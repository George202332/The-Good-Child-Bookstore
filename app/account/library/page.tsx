import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";

/**
 * Converted from readerLibraryItems() and its rendering in accountHTML()
 * (the-good-child-bookstore_54_1.html:6659-6672). Every book across every
 * past order — derived from real Orders, same "never drifts out of sync"
 * design as the original, just backed by the database instead of
 * localStorage.
 */
export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "READER") redirect("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      readerProfile: {
        include: { orders: { include: { lines: { include: { book: true } } } } },
      },
    },
  });

  const items = new Map<string, { title: string; author: string; qty: number }>();
  for (const order of user?.readerProfile?.orders ?? []) {
    for (const line of order.lines) {
      const existing = items.get(line.bookId);
      if (existing) existing.qty += 1;
      else {
        const authorUser = await prisma.authorProfile.findUnique({
          where: { id: line.book.authorId },
          include: { user: true },
        });
        items.set(line.bookId, { title: line.book.title, author: authorUser?.user.name ?? "", qty: 1 });
      }
    }
  }

  return (
    <DashboardShell role="READER" activeKey="library" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>My Library</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Every book you&apos;ve purchased, ready to download.</p>
        </div>
      </div>
      {items.size === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          Nothing here yet; <Link href="/shop">browse the bookshelf</Link> to get started.
        </div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {Array.from(items.entries()).map(([id, it]) => (
            <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{it.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{it.author} · {it.qty} {it.qty === 1 ? "copy" : "copies"}</div>
              </div>
              <Link href={`/book/${id}`} className="btn btn-ghost btn-small">View</Link>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
