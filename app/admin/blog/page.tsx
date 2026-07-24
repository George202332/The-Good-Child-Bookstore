import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/AdminShell";
import { ModerationActions } from "./ModerationActions";

interface PendingBlog {
  id: string;
  title: string;
  createdAt: Date;
  author: { user: { name: string } };
}

export default async function BlogModerationPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR") redirect("/account");

  const pending = (await prisma.blog.findMany({
    where: { status: "PENDING_REVIEW" },
    include: { author: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  })) as PendingBlog[];

  return (
    <AdminShell role={role} activeKey="blog" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Blog Moderation</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Posts submitted for review, oldest first.</p>
        </div>
      </div>
      {pending.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>Nothing waiting on review right now.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {pending.map((b) => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  by {b.author.user.name} · submitted {b.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <ModerationActions blogId={b.id} />
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
