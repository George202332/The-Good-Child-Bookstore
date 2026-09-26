import { redirect, notFound } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/AdminShell";
import { listAdminThread } from "@/actions/admin-messages";
import { AdminThreadView } from "./AdminThreadView";

export default async function AdminMessageThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const { userId: counterpartId } = await params;
  const counterpart = await prisma.user.findUnique({ where: { id: counterpartId } });
  if (!counterpart) notFound();

  const messages = await listAdminThread(counterpartId);

  return (
    <AdminShell role="ADMIN" activeKey="messages" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{counterpart.name}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            {counterpart.role.charAt(0) + counterpart.role.slice(1).toLowerCase()} · {counterpart.email}
          </p>
        </div>
      </div>
      <AdminThreadView counterpartId={counterpartId} initial={messages} />
    </AdminShell>
  );
}
