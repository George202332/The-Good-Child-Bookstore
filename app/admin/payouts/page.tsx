import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/AdminShell";
import { ModerationActions } from "./ModerationActions";

interface PendingPayout {
  id: string;
  amount: unknown;
  currency: string;
  failureReason: string | null;
  requestedAt: Date;
  user: { name: string; email: string; role: string };
  recipient: { type: string; accountHolderName: string; currency: string };
}

/** Admin-only payout queue — now Wise-only, covering both authors and
 * affiliates (previously affiliate-only). "Mark paid" actually executes
 * a real Wise transfer (create quote → create transfer → fund) via
 * lib/payments/wise.ts. */
export default async function PayoutsPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const pending = (await prisma.payoutRequest.findMany({
    where: { status: "REQUESTED" },
    include: { user: true, recipient: true },
    orderBy: { requestedAt: "asc" },
  })) as PendingPayout[];

  return (
    <AdminShell role="ADMIN" activeKey="payouts" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Payout Requests</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Pending author &amp; affiliate payouts, oldest first. All payouts are sent via Wise.
          </p>
        </div>
      </div>
      {pending.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>Nothing pending right now.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {pending.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>${Number(p.amount).toFixed(2)} <span className="age-pill">{p.user.role}</span></div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  {p.user.name} ({p.user.email}) · via Wise ({p.recipient.type}, {p.recipient.currency}) · requested {p.requestedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
                {p.failureReason && (
                  <div style={{ fontSize: 12, color: "var(--coral-deep)", marginTop: 4 }}>Last attempt failed: {p.failureReason}</div>
                )}
              </div>
              <ModerationActions payoutId={p.id} />
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
