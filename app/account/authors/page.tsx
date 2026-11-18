import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listAuthorsDirectoryRows } from "@/actions/authors-directory";
import { AuthorsTable } from "./AuthorsTable";
import { prisma } from "@/lib/prisma";

/**
 * Authors — a directory of every author name (pen names included) with
 * at least one published book on the platform right now, per explicit
 * instruction. Computed live from real published books (see
 * actions/authors-directory.ts), so a newly entered pen name appears
 * here the moment the book it's used on actually goes live — nothing
 * to keep in sync by hand. Each name links to that author's real public
 * profile page (following a specific name, and getting notified when
 * that name publishes something new, both happen from the Follow button
 * on a book's own page — see components/FollowAuthorButton.tsx).
 */
export default async function AuthorsDirectoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  // Only the author names that belong to THIS account (its own published books, pen names included). Names that live in another
  // account, the company author account included, never appear here, and two accounts may use the same name without clashing.
  const mine = await prisma.authorProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  const authors = mine ? (await listAuthorsDirectoryRows()).filter((r) => r.authorId === mine.id) : [];

  return (
    <DashboardShell role="AUTHOR" activeKey="authors" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>Authors</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            The author names you have published under, pen names included.
          </p>
        </div>
      </div>

      {authors.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          None of your author names has a published book yet.
        </div>
      ) : (
        <AuthorsTable authors={authors} />
      )}
    </DashboardShell>
  );
}
