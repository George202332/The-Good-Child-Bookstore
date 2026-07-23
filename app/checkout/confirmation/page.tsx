import Link from "next/link";
import { getOrderSummary } from "@/actions/orders";

/**
 * Real order confirmation, reached either from demo-mode checkout
 * (immediate) or from a real gateway's return redirect
 * (app/checkout/return) after payment is actually confirmed.
 */
export default async function CheckoutConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  const order = orderId ? await getOrderSummary(orderId) : null;

  if (!order) {
    return (
      <div className="wrap cart-wrap" style={{ maxWidth: 520, textAlign: "center" }}>
        <p>No recent order found.</p>
        <Link href="/shop" className="btn btn-primary" style={{ marginTop: 16 }}>Browse the bookshelf</Link>
      </div>
    );
  }

  return (
    <div className="wrap cart-wrap" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1F6B48", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>✓</div>
        <h2 style={{ marginBottom: 6 }}>Thank you for your order!</h2>
        <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>Order #{order.id.slice(0, 8).toUpperCase()}</p>
      </div>
      <div className="checkout-summary-card" style={{ position: "static" }}>
        {order.items.map((it, i) => (
          <div className="summary-row" key={i}><span>{it.title}</span><span>${it.price.toFixed(2)}</span></div>
        ))}
        <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "14px 0" }} />
        <div className="summary-row total"><span>Total paid</span><span>${order.totalAmount.toFixed(2)}</span></div>
        <Link href="/shop" className="see-all" style={{ display: "block", textAlign: "center", marginTop: 14 }}>Continue shopping</Link>
      </div>
    </div>
  );
}
