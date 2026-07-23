import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listConversations } from "@/actions/messages";
import { NewMessageForm } from "./NewMessageForm";

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
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No conversations yet.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {conversations.map((c) => (
            <Link
              key={c.counterpartId}
              href={`/account/messages/${c.counterpartId}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {c.counterpartName} {c.unread && <span className="age-pill" style={{ marginLeft: 6, background: "var(--coral)" }}>New</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.lastMessage}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                {c.lastMessageAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
