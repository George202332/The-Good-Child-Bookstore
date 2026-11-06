import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { GoToMyBooks } from "./GoToMyBooks";

/** Shown right after an author presses Publish: confirms the book was submitted, then moves on to My Books. */
export default async function PublishedPage({ searchParams }: { searchParams?: Promise<{ kind?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");
  const kind = (await searchParams)?.kind;
  const what = kind === "print" ? "Print Book" : kind === "ebook" ? "eBook/Audiobook" : "Book";
  return (
    <DashboardShell role="AUTHOR" activeKey="mybooks" displayName={session.user.name ?? ""}>
      <div className="map-card" style={{ maxWidth: 560, margin: "40px auto", padding: "36px 28px", textAlign: "center" }}>
        <div aria-hidden style={{ width: 56, height: 56, borderRadius: 999, background: "#E3F5EA", color: "#165236", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Your {what} Was Successfully Published</h2>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6 }}>
          It has been submitted for review for approval. We will publish it on the store as soon as it is approved, and let you know.
        </p>
        <p style={{ color: "var(--ink-faint)", fontSize: 12.5, marginTop: 14 }}>Taking you to My Books in a few seconds…</p>
        <Link href="/account/books" className="btn btn-primary btn-small" style={{ marginTop: 10 }}>Go to My Books</Link>
        <GoToMyBooks />
      </div>
    </DashboardShell>
  );
}
