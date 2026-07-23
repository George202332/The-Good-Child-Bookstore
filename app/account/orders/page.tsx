import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";

interface OrderLine {
  book: { title: string };
}
interface OrderWithLines {
  id: string;
  totalAmount: unknown;
  status: string;
  createdAt: Date;
  lines: OrderLine[];
}

/** Converted from the Orders sub-page referenced in authorDashboardShell()'s
 * reader nav (the-good-child-bookstore_54_1.html:6507); full order history
 * rather than just the 3 most recent shown on the dashboard overview. */
export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "READER") redirect("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      readerProfile: {
        include: { orders: { include: { lines: { include: { book: true } } }, orderBy: { createdAt: "desc" } } },
      },
    },
  });
  const orders = (user?.readerProfile?.orders ?? []) as OrderWithLines[];

  return (
    <DashboardShell role="READER" activeKey="orders" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Orders</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Every order you&apos;ve placed, most recent first.</p>
        </div>
      </div>
      {orders.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          No orders yet; <Link href="/shop">browse the bookshelf</Link> to get started.
        </div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {orders.map((o: OrderWithLines) => (
            <div key={o.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>Order #{o.id.slice(0, 8).toUpperCase()}</div>
                <div style={{ fontWeight: 700 }}>${Number(o.totalAmount).toFixed(2)}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 8 }}>
                {o.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · {o.status}
              </div>
              <div style={{ fontSize: 13 }}>{o.lines.map((l: OrderLine) => l.book.title).join(", ")}</div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
