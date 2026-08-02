import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { listLibrary } from "@/actions/library";
import { LibraryClient } from "./LibraryClient";

/**
 * Every file uploaded anywhere on the site, in one place — organized
 * into real folders: eBooks, Paperbacks, Hardcovers, Audiobooks,
 * Images (book covers + anything else tied to a book), and Admin
 * (logo/favicon/badges/banners). Folder assignment is computed by
 * cross-referencing every real place an upload's id is actually
 * referenced (Book.coverImageUrl, BookFile rows, Site Settings, Page
 * Content) — not guessed from filenames or upload order.
 */
export default async function LibraryPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/admin");

  const items = await listLibrary();

  return (
    <AdminShell role="ADMIN" activeKey="library" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Library</h2>
          <p style={{ color: "var(--admin-text-faint, #6B7385)", fontSize: 13.5, marginTop: 2 }}>
            Every image and file uploaded anywhere on the site — book files, covers, and admin uploads, all in one place.
          </p>
        </div>
      </div>
      <LibraryClient items={items} />
    </AdminShell>
  );
}
