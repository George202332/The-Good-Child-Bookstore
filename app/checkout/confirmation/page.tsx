import Link from "next/link";
import { auth } from "@/lib/auth";
import { getOrderSummary } from "@/actions/orders";

/**
 * Real order confirmation, reached either from demo-mode checkout
 * (immediate) or from a real gateway's return redirect
 * (app/checkout/return) after payment is actually confirmed.
 *
 * Shows a direct download link for any purchased eBook right here (works
 * for signed-in buyers and guests alike, since a guest has no login to
 * reach a dashboard with), plus a prominent link to the full Library for
 * anyone currently signed in. A receipt with the same download links is
 * also emailed — see actions/order-emails.ts.
 */
export default async function CheckoutConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  const order = orderId ? await getOrderSummary(orderId) : null;
  const session = await auth();

  if (!order) {
    return (
      <div className="wrap cart-wrap" style={{ maxWidth: 520, textAlign: "center" }}>
        <p>No recent order found.</p>
        <Link href="/shop" className="btn btn-primary" style={{ marginTop: 16 }}>Browse the bookshelf</Link>
      </div>
    );
  }

  const hasDigitalItems = order.items.some((it) => it.hasEbook || it.hasAudiobook);

  return (
    <div className="wrap cart-wrap" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div style={{ textAlign: "center" }}>
        <div className="confirmation-check">✓</div>
        <h2 style={{ marginBottom: 6 }}>Thank you for your order!</h2>
        <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>
          Order #{order.id.slice(0, 8).toUpperCase()} — a receipt has been emailed to you.
        </p>
      </div>
      <div className="checkout-summary-card" style={{ position: "static" }}>
        {order.items.map((it, i) => (
          <div key={i} className="confirmation-item" style={{ borderBottom: i < order.items.length - 1 ? undefined : "none" }}>
            <div className="mini-cover">
              {it.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.coverImageUrl} alt={`${it.title} cover`} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div className="summary-row" style={{ marginBottom: it.downloadUrl || (it.hasEbook || it.hasAudiobook) ? 6 : 0 }}>
                <span style={{ fontWeight: 700 }}>{it.title}</span><span>${it.price.toFixed(2)}</span>
              </div>
              {it.downloadUrl && (
                <a href={it.downloadUrl} className="btn btn-ghost btn-small" download>
                  Download
                </a>
              )}
              {(it.hasEbook || it.hasAudiobook) && !it.downloadUrl && (
                <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: 0 }}>
                  Download available from your Library once the file is on record.
                </p>
              )}
            </div>
          </div>
        ))}
        <div className="summary-row total" style={{ marginTop: 14 }}><span>Total paid</span><span>${order.totalAmount.toFixed(2)}</span></div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
        {session?.user && hasDigitalItems && (
          <Link href="/account/library" className="btn btn-primary" style={{ textAlign: "center" }}>
            Go to your Library
          </Link>
        )}
        <Link href="/shop" className="see-all" style={{ display: "block", textAlign: "center" }}>Continue shopping</Link>
      </div>
    </div>
  );
}
