import Link from "next/link";
import { auth } from "@/lib/auth";
import { getOrderSummary } from "@/actions/orders";
import { ClearCartOnMount } from "@/components/ClearCartOnMount";
import { EnterAccountButton } from "@/components/EnterAccountButton";
import { confirmationUrl, orderAccessToken, receiptUrl, verifyOrderAccessToken } from "@/lib/order-access";
import { getOrderAccessInfo } from "@/lib/order-access-info";

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
 *
 * Who may open it: whoever holds the order's secret key (the `k` in the link the
 * payment return page sends the buyer to, so guests need no login) or the
 * signed-in owner of the order. Anyone else just sees "No recent order found".
 * Receipt, book download and account button appear ONLY for a confirmed-paid
 * order, never for a pending or failed payment.
 */
export default async function CheckoutConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; k?: string }>;
}) {
  const { order: orderId, k } = await searchParams;
  const session = await auth();
  const hasKey = !!orderId && verifyOrderAccessToken(orderId, k);
  const info = orderId ? await getOrderAccessInfo(orderId) : null;
  const isOwner = !!session?.user && !!info && session.user.id === info.buyerUserId;
  const order = orderId && info && (hasKey || isOwner) ? await getOrderSummary(orderId) : null;

  if (!order) {
    return (
      <div className="wrap cart-wrap" style={{ maxWidth: 520, textAlign: "center" }}>
        <p>No recent order found.</p>
        <Link href="/bookshelf" className="btn btn-primary" style={{ marginTop: 16 }}>Browse the Bookshelf</Link>
      </div>
    );
  }

  // This page only ever celebrates a payment Paystack/PayPal has really
  // confirmed. Anything else (still waiting, failed, cancelled) gets an honest
  // message with no download buttons, no "thank you" and no cleared cart.
  if (order.status !== "PAID") {
    const stillWaiting = order.status === "PENDING";
    return (
      <div className="wrap cart-wrap" style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ marginBottom: 6 }}>{stillWaiting ? "We're Waiting for Your Payment to Be Confirmed" : "This Payment Was Not Completed"}</h2>
        <p style={{ color: "var(--ink-soft)", marginBottom: 24 }}>
          Order #{order.id.slice(0, 8).toUpperCase()} —{" "}
          {stillWaiting
            ? "your bank or card provider hasn't confirmed it yet. If you were charged, your order will appear in your Library the moment it is confirmed; you don't need to pay again. Please check again in a minute."
            : "you have not been charged for this order. Your cart is still saved, so you can try again."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {stillWaiting && (
            <Link href={confirmationUrl(order.id)} className="btn btn-primary" style={{ textAlign: "center" }}>Check Again</Link>
          )}
          <Link href="/checkout" className={stillWaiting ? "see-all" : "btn btn-primary"} style={{ display: "block", textAlign: "center" }}>Back to checkout</Link>
        </div>
      </div>
    );
  }

  const hasDigitalItems = order.items.some((it) => it.hasEbook || it.hasAudiobook);
  const accessKey = orderAccessToken(order.id);

  return (
    <div className="wrap cart-wrap" style={{ maxWidth: 520, margin: "0 auto" }}>
      <ClearCartOnMount />
      <div style={{ textAlign: "center" }}>
        <div className="confirmation-check">✓</div>
        <h2 style={{ marginBottom: 6 }}>Thank You for Your Order!</h2>
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
              <div className="summary-row" style={{ marginBottom: it.downloadUrl || it.hasEbook || it.hasAudiobook || it.isPrint ? 6 : 0 }}>
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
              {it.isPrint && (
                <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "0 0 4px" }}>
                  Printed and shipped by Lulu — there is no file download for this copy.
                </p>
              )}
              {it.isPrint && order.printJobStatus === "SUBMITTED" && (
                <p style={{ fontSize: 12, color: "#165236", margin: 0, fontWeight: 600 }}>
                  ✓ Sent to our print partner for production — this copy will ship to the address you provided.
                </p>
              )}
              {it.isPrint && order.printJobStatus === "FAILED" && (
                <p style={{ fontSize: 12, color: "var(--coral-deep)", margin: 0, fontWeight: 600 }}>
                  We hit an issue sending this to our print partner — our team has been notified and will follow up by email.
                </p>
              )}
            </div>
          </div>
        ))}
        {order.shippingAmount > 0 && (
          <div className="summary-row" style={{ marginTop: 14 }}><span>Shipping (paid by you)</span><span>${order.shippingAmount.toFixed(2)}</span></div>
        )}
        <div className="summary-row total" style={{ marginTop: order.shippingAmount > 0 ? 6 : 14 }}><span>Total paid</span><span>${order.totalAmount.toFixed(2)}</span></div>
        {/* A plain download link: the PDF saves straight away (no new window, no sign-in),
            protected by this order's secret key. */}
        <a href={receiptUrl(order.id)} download style={{ display: "inline-block", marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "var(--coral-deep)" }}>
          Download your receipt (PDF) →
        </a>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
        {session?.user && hasDigitalItems && (
          <Link href="/account/library" className="btn btn-primary" style={{ textAlign: "center" }}>
            Go to Your Library
          </Link>
        )}
        {info?.newGuestAccount && !session?.user ? (
          info.signInWindowOpen && accessKey ? (
            <>
              <EnterAccountButton orderId={order.id} accessKey={accessKey} />
              <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: 0, textAlign: "center" }}>
                We created your account from this purchase. You&apos;ll choose your own password once you&apos;re in.
              </p>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-primary" style={{ textAlign: "center" }}>Go to My Account</Link>
              <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: 0, textAlign: "center" }}>
                Your account is ready. Use the link in your email to choose your password, or use Forgot password on the sign-in page.
              </p>
            </>
          )
        ) : (
          <Link href={session?.user ? "/account" : "/login"} className={session?.user && hasDigitalItems ? "btn btn-ghost" : "btn btn-primary"} style={{ textAlign: "center" }}>
            Go to my account
          </Link>
        )}
        <Link href="/bookshelf" className="see-all" style={{ display: "block", textAlign: "center" }}>Continue shopping</Link>
      </div>
    </div>
  );
}
