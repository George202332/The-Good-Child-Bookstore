import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { listAdminConversations } from "@/actions/admin-messages";
import { AdminMessagesList } from "./AdminMessagesList";

/**
 * The admin backend's Messages tab — mirrors the author-side Messages
 * tab (app/account/messages), but pooled: every support message any
 * reader or author has sent to a backend account, grouped by who sent
 * it, newest first. See actions/admin-messages.ts for how replying
 * from here reaches both that person's own account Messages tab and
 * their email inbox at once.
 */
export default async function AdminMessagesPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const conversations = await listAdminConversations();

  return (
    <AdminShell role="ADMIN" activeKey="messages" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Messages</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Support messages from authors and readers. Replying reaches both their account and their email at once.
          </p>
        </div>
      </div>

      <AdminMessagesList conversations={conversations} />
    </AdminShell>
  );
}
