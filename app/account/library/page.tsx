import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { LibraryReviewButton } from "@/components/LibraryReviewButton";
import { bookAuthorDisplayName } from "@/lib/book-author-name";

const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid var(--line)" };

/**
 * My Library — every book a signed-in account has bought, whether that
 * account's primary role is Reader or Author (an author who also buys
 * books gets a readerProfile automatically the first time they check
 * out — see resolveReaderProfileId in actions/orders.ts — so this
 * looks the data up the same way regardless of role).
 */
export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  // Reintegrated for Author accounts too — an author who has personally
  // bought books as a customer sees them here exactly like a Reader
  // would, since it's the same readerProfile mechanism either way (see
  // resolveReaderProfileId in actions/orders.ts). Any other backend
  // role (Affiliate/Editor/etc.) has no library at all.
  if (role !== "READER" && role !== "AUTHOR") redirect("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      readerProfile: {
        include: {
          orders: {
            where: { status: "PAID" },
            include: { lines: { include: { book: { include: { author: { include: { user: true } } } } } } },
          },
        },
      },
    },
  });

  interface LibraryItem { id: string; sn: string; title: string; author: string; format: string; copies: number; }
  const items = new Map<string, LibraryItem>();
  for (const order of user?.readerProfile?.orders ?? []) {
    for (const line of order.lines) {
      const key = `${line.bookId}:${line.format ?? ""}`;
      const existing = items.get(key);
      if (existing) existing.copies += 1;
      else {
        items.set(key, {
          id: line.bookId,
          sn: line.book.isbn || "—",
          title: line.book.title,
          author: bookAuthorDisplayName(line.book),
          format: line.format ? line.format.charAt(0).toUpperCase() + line.format.slice(1) : "—",
          copies: 1,
        });
      }
    }
  }
  const rows = Array.from(items.values());

  return (
    <DashboardShell role={role} activeKey="library" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>My Library</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Every book you&apos;ve bought, ready to download.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="map-card" style={{ padding: 30, textAlign: "center" }}>
          <p style={{ fontSize: 14.5, color: "var(--ink-soft)" }}>You are yet to purchase your first book.</p>
        </div>
      ) : (
        <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>SN / ISBN</th>
                <th style={TABLE_HEAD_STYLE}>Title</th>
                <th style={TABLE_HEAD_STYLE}>Author</th>
                <th style={TABLE_HEAD_STYLE}>Format</th>
                <th style={TABLE_HEAD_STYLE}>Copies</th>
                <th style={TABLE_HEAD_STYLE}>Download</th>
                {role === "READER" && <th style={TABLE_HEAD_STYLE}>Review</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((it) => (
                <tr key={`${it.id}:${it.format}`}>
                  <td style={TABLE_CELL_STYLE}>{it.sn}</td>
                  <td style={TABLE_CELL_STYLE}><strong>{it.title}</strong></td>
                  <td style={TABLE_CELL_STYLE}>{it.author}</td>
                  <td style={TABLE_CELL_STYLE}>{it.format}</td>
                  <td style={TABLE_CELL_STYLE}>{it.copies}</td>
                  <td style={TABLE_CELL_STYLE}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <a href={`/api/downloads/${it.id}`} className="btn btn-ghost btn-small">PDF</a>
                      <a href={`/api/downloads/${it.id}?format=epub`} className="btn btn-ghost btn-small">ePub</a>
                    </div>
                  </td>
                  {role === "READER" && (
                    <td style={TABLE_CELL_STYLE}>
                      <LibraryReviewButton bookId={it.id} bookTitle={it.title} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
