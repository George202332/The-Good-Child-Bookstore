import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { listMessagesWith } from "@/actions/messages";
import { ThreadView } from "./ThreadView";

export default async function MessageThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "READER" && role !== "AUTHOR" && role !== "AFFILIATE") redirect("/admin");

  const { userId: counterpartId } = await params;
  const counterpart = await prisma.user.findUnique({ where: { id: counterpartId } });
  if (!counterpart) notFound();

  const messages = await listMessagesWith(counterpartId);

  return (
    <DashboardShell role={role} activeKey="messages" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{counterpart.name}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>{counterpart.role.charAt(0) + counterpart.role.slice(1).toLowerCase()}</p>
        </div>
      </div>
      <ThreadView counterpartId={counterpartId} initial={messages} />
    </DashboardShell>
  );
}
