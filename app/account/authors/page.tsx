import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listAuthorsDirectoryRows } from "@/actions/authors-directory";
import { AuthorsTable } from "./AuthorsTable";

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

  const authors = await listAuthorsDirectoryRows();

  return (
    <DashboardShell role="AUTHOR" activeKey="authors" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>Authors</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Every author name with a published book on the shelf right now, pen names included.
          </p>
        </div>
      </div>

      {authors.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          No published authors yet.
        </div>
      ) : (
        <AuthorsTable authors={authors} />
      )}
    </DashboardShell>
  );
}
