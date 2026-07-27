import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listConversations } from "@/actions/messages";
import { NewMessageForm } from "./NewMessageForm";

function initialsFor(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

/** Messages inbox — every conversation, most recent first. Available to
 * all three converted roles (Reader, Author, Affiliate); Admin/Editor
 * use their own backend shell and aren't part of this. */
export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "READER" && role !== "AUTHOR" && role !== "AFFILIATE") redirect("/admin");

  const conversations = await listConversations();

  return (
    <DashboardShell role={role} activeKey="messages" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Messages</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Direct messages with authors, readers, and affiliates.</p>
        </div>
      </div>

      <NewMessageForm />

      {conversations.length === 0 ? (
        <div className="map-card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--lavender)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--ink-soft)" strokeWidth={1.7}><path d="M4 6h16v12H4z" /><path d="M4 7l8 6 8-6" /></svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>No conversations yet</div>
          <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>Search for someone above to start your first conversation.</p>
        </div>
      ) : (
        <div className="inbox-list">
          {conversations.map((c) => (
            <Link key={c.counterpartId} href={`/account/messages/${c.counterpartId}`} className={`inbox-row ${c.unread ? "inbox-row-unread" : ""}`}>
              <div className="inbox-avatar">{initialsFor(c.counterpartName)}</div>
              <div className="inbox-row-body">
                <div className="inbox-row-top">
                  <span className="inbox-name">{c.counterpartName}</span>
                  <span className="inbox-date">{c.lastMessageAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
                <div className="inbox-preview">{c.lastMessage}</div>
              </div>
              {c.unread && <span className="inbox-unread-dot" aria-label="Unread" />}
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
