import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getFeeRates, isUsingDefaultRates } from "@/lib/processing-fee-settings";
import { ProcessingFeeRatesForm } from "./ProcessingFeeRatesForm";

/** The payment companies' rates the Processing Fee is worked out with. Admin only. */
export default async function ProcessingFeeRatesPage() {
  const session = await authAdmin();
  if (session?.user?.role !== "ADMIN") redirect("/login");
  const [rates, usingDefaults] = await Promise.all([getFeeRates(), isUsingDefaultRates()]);
  return (
    <AdminShell role="ADMIN" activeKey="processing-fee-rates" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Processing Fee Rates</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            The Processing Fee on printed books covers what the payment company keeps. Set each company&apos;s real rate here. It applies to new orders only; orders already paid never change.
          </p>
        </div>
      </div>
      {usingDefaults && (
        <div className="map-card" style={{ padding: 14, marginBottom: 16, fontSize: 13, borderLeft: "4px solid var(--coral-deep)" }}>
          <strong>These are starting guesses, not your real rates.</strong> Check them against what the companies charge you: Paystack publishes its rates at paystack.com/pricing (they depend on the country of your Paystack account and the payment type), and PayPal at paypal.com/webapps/mpp/merchant-fees (higher for international buyers or when currency is converted). Then press Save Rates.
        </div>
      )}
      <ProcessingFeeRatesForm initial={rates} />
    </AdminShell>
  );
}
