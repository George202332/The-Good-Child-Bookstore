import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { listRecords } from "@/lib/personal-message-db";
import { getPersonalMessageFee } from "@/lib/personal-message-settings";
import { PersonalMessagesClient } from "./PersonalMessagesClient";

/** Personal Messages buyers wrote for printed copies: held ones waiting for a decision, the full record, and (Admin) the fee. */
export default async function PersonalMessagesPage() {
  const session = await authAdmin();
  const role = session?.user?.role;
  if (!session?.user || (role !== "ADMIN" && role !== "EDITOR" && role !== "CHIEF_EDITOR")) redirect("/admin/login");
  const [rows, fee] = await Promise.all([listRecords("ALL", 300).catch(() => []), getPersonalMessageFee()]);
  const held = rows.filter((r) => r.status === "HELD");
  const rest = rows.filter((r) => r.status !== "HELD");
  const plain = (r: (typeof rows)[number]) => ({ ...r, decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null, createdAt: r.createdAt.toISOString() });
  return (
    <AdminShell role={role} activeKey="personal-messages" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Personal Messages</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Messages buyers add to printed copies are checked automatically. A flagged message is held here, and its book is not printed until you approve or reject it. Every message and decision is kept permanently.
          </p>
        </div>
      </div>
      <PersonalMessagesClient held={held.map(plain)} history={rest.map(plain)} fee={fee} isAdmin={role === "ADMIN"} />
    </AdminShell>
  );
}
