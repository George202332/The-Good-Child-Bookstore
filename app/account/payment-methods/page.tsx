import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listMyPaymentMethods } from "@/actions/payment-methods";
import { PaymentMethodList } from "./PaymentMethodList";

/**
 * Payment Methods — deliberately built only on Paystack's own reusable
 * "authorization" token (see actions/payment-methods.ts), saved
 * automatically the first time a reader pays with a card that supports
 * reuse. There's no "add a card" form here on purpose: entering raw card
 * numbers into our own form would mean handling card data directly,
 * which the checkout flow already avoids by always going through
 * Paystack's own hosted fields. This page can only show/manage/remove
 * cards Paystack already tokenized for us.
 */
export default async function PaymentMethodsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "READER") redirect("/account");

  const methods = await listMyPaymentMethods();

  return (
    <DashboardShell role="READER" activeKey="payment-methods" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Payment Methods</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Cards you&apos;ve used that support faster checkout next time. Your card number is never stored on our
            servers — only a secure token from Paystack.
          </p>
        </div>
      </div>
      {methods.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          Nothing saved yet — pay with a card at checkout and, if it supports it, it&apos;ll appear here automatically.
        </div>
      ) : (
        <PaymentMethodList initial={methods} />
      )}
    </DashboardShell>
  );
}
