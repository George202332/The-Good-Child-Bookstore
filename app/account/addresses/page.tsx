import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listMyAddresses } from "@/actions/addresses";
import { AddressManager } from "./AddressManager";

export default async function AddressesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "READER") redirect("/account");

  const addresses = await listMyAddresses();

  return (
    <DashboardShell role="READER" activeKey="addresses" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Addresses</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Used for billing on digital orders, and shipping on print orders.
          </p>
        </div>
      </div>
      <AddressManager initial={addresses} />
    </DashboardShell>
  );
}
