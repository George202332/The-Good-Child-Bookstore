import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listConversations, listSentMessages, listDraftMessages } from "@/actions/messages";
import { MessagesTabs } from "./MessagesTabs";

/** Messages — Inbox / Sent / Drafts, with a real compose experience
 * (search a recipient, write, send or save as a genuine draft).
 * Available to all converted account types (Reader, Author); Admin/
 * Editor use their own backend shell and aren't part of this. */
export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "READER" && role !== "AUTHOR") redirect("/admin");

  const [conversations, sent, drafts] = await Promise.all([
    listConversations(),
    listSentMessages(),
    listDraftMessages(),
  ]);

  return (
    <DashboardShell role={role} activeKey="messages" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Messages</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Direct messages with authors, readers, and affiliates.</p>
        </div>
      </div>

      <MessagesTabs conversations={conversations} sent={sent} drafts={drafts} />
    </DashboardShell>
  );
}
