import { redirect, notFound } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { loadDepartmentThread } from "@/actions/admin-departments";
import { departmentOf } from "@/lib/message-departments";
import { AdminThreadView } from "./AdminThreadView";

export default async function AdminMessageThreadPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ d?: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role === "INVESTOR") redirect("/admin");

  const { userId: counterpartId } = await params;
  const { d } = await searchParams;
  // The server refuses a conversation from a department this person does not belong to.
  const data = d ? await loadDepartmentThread(counterpartId, d) : null;
  if (!data) notFound();
  const dept = departmentOf(data.thread.department);

  return (
    <AdminShell role={session.user.role} activeKey="messages" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{data.thread.counterpartName}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            {dept?.label} inbox · {data.thread.counterpartRole.charAt(0) + data.thread.counterpartRole.slice(1).toLowerCase()}{data.thread.subject ? ` · ${data.thread.subject}` : ""}
          </p>
        </div>
      </div>
      <AdminThreadView thread={data.thread} messages={data.messages} />
    </AdminShell>
  );
}
