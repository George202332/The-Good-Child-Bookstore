import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { loadInbox, listSentMessages, listDraftMessages } from "@/actions/messages";
import { MessagesApp } from "./MessagesApp";

/** Messages: a two-panel inbox (conversation list, open conversation, reply box). Everything arrives in one trip, so
 * opening a conversation is instant. Available to Reader and Author accounts; Admin/Editor use their own backend. */
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "READER" && role !== "AUTHOR") redirect("/admin");
  const { c } = await searchParams;

  const [conversations, sent, drafts] = await Promise.all([loadInbox(), listSentMessages(), listDraftMessages()]);

  return (
    <DashboardShell role={role} activeKey="messages" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>Messages</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Message our team, and hear from us.</p>
        </div>
      </div>
      <MessagesApp
        conversations={conversations}
        sent={sent.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
        drafts={drafts.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
        initialCounterpartId={c ?? null}
      />
    </DashboardShell>
  );
}
