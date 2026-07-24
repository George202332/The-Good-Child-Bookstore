import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { listCoupons } from "@/actions/coupons";
import { CouponManager } from "./CouponManager";

/** Admin-only coupon management — "manage coupons" from the brief. */
export default async function CouponsPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const coupons = await listCoupons();

  return (
    <AdminShell role="ADMIN" activeKey="coupons" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Coupons</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Create and manage checkout discount codes.</p>
        </div>
      </div>
      <CouponManager initial={coupons} />
    </AdminShell>
  );
}
