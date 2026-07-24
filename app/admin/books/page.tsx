import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/AdminShell";
import { ModerationActions } from "./ModerationActions";

interface PendingBook {
  id: string;
  title: string;
  createdAt: Date;
  author: { user: { name: string } };
}

/**
 * Book Moderation — the Draft → Pending Review → Published (→ Rejected)
 * workflow from the brief. "Editors approve, Admins override" — both
 * roles can approve/reject here (see actions/admin.ts requireBackendRole());
 * distinguishing "override" from "approve" isn't modeled separately since
 * both ultimately just set status.
 */
export default async function BookModerationPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR") redirect("/account");

  const pending = (await prisma.book.findMany({
    where: { status: "PENDING_REVIEW" },
    include: { author: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  })) as PendingBook[];

  return (
    <AdminShell role={role} activeKey="books" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Book Moderation</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Books submitted for review, oldest first.
          </p>
        </div>
      </div>
      {pending.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          Nothing waiting on review right now.
        </div>
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
              <ModerationActions bookId={b.id} />
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
