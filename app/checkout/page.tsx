"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Book } from "@/lib/data/catalog";
import { Motif } from "@/components/Motif";
import { useCart } from "@/hooks/useCart";
import { createPendingOrder, confirmOrderPaidDirectly } from "@/actions/orders";
import { initiateGatewayCheckout } from "@/actions/payment-init";
import { validateCoupon } from "@/actions/coupons";
import { resolveCartBooks } from "@/actions/cart-books";
import { listMyPaymentMethods, payWithSavedCard, type SavedPaymentMethodRow } from "@/actions/payment-methods";

/**
 * Converted from checkoutHTML() and its 5 step-render functions
 * (the-good-child-bookstore_54_1.html:4606-4940). Account-linked
 * conveniences from the original (saved-address dropdown, saved-payment-
 * method dropdown, auto-filling name/email/phone from a logged-in
 * reader's profile) are not yet wired up, since this build doesn't have
 * a reader profile-editing page yet. PDF receipt generation
 * (downloadReceiptPDF, jsPDF-based) is also not ported.
 *
 * Payment: if PayPal/Paystack credentials are configured (see
 * actions/payment-init.ts), "Complete purchase" creates a PENDING order
 * and redirects to the gateway's real hosted checkout page; the buyer
 * lands back on /checkout/return, which verifies payment and marks the
 * order PAID before showing /checkout/confirmation. Without credentials
 * configured, it falls back to demo mode: the order is marked PAID
 * immediately and the buyer goes straight to the confirmation page —
 * the same behavior this checkout has always had.
 */

// Real coupons come from the database now — see actions/coupons.ts.

interface CheckoutData {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  billingAddress: string;
  couponCode: string;
  couponDiscount: number;
  paymentMethod: "paypal" | "paystack" | "mpesa";
  cardName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
}

const STEPS = [
  { n: 1, label: "Cart" },
  { n: 2, label: "Your details" },
  { n: 3, label: "Order summary" },
  { n: 4, label: "Payment" },
  { n: 5, label: "Confirmation" },
];

export default function CheckoutPage() {
  const { items, setQty, removeItem } = useCart();
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<CheckoutData>({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    billingAddress: "",
    couponCode: "",
    couponDiscount: 0,
    paymentMethod: "paypal",
    cardName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
  });
  const [couponInput, setCouponInput] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethodRow[]>([]);
  const [resolvedBooks, setResolvedBooks] = useState<Book[] | null>(null);

  useEffect(() => {
    const ids = items.map((i) => i.bookId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset to loading state before the new resolution arrives, so stale data from a previous cart never lingers on screen
    setResolvedBooks(null);
    resolveCartBooks(ids).then(setResolvedBooks);
  }, [items]);

  useEffect(() => {
    if (session?.user?.id) {
      listMyPaymentMethods().then(setSavedMethods);
    }
  }, [session?.user?.id]);

  const bookSource = resolvedBooks ?? [];
  const lines = items
    .map((i) => ({ book: bookSource.find((b) => b.id === i.bookId), qty: i.quantity }))
    .filter((l): l is { book: NonNullable<typeof l.book>; qty: number } => !!l.book);
  const subtotal = lines.reduce((sum, l) => sum + l.book.price * l.qty, 0);
  const couponAmount = +(subtotal * data.couponDiscount).toFixed(2);
  const grandTotal = +(subtotal - couponAmount).toFixed(2);

  function goTo(n: number) {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  const [couponError, setCouponError] = useState<string | null>(null);

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    const result = await validateCoupon(code);
    if (result.ok && result.discountPct !== undefined) {
      setCouponError(null);
      setData((d) => ({ ...d, couponCode: code, couponDiscount: result.discountPct! }));
    } else {
      setCouponError(result.error ?? "That coupon code is not valid.");
      setData((d) => ({ ...d, couponCode: "", couponDiscount: 0 }));
    }
  }

  async function payWithSaved(savedMethodId: string) {
    setSubmitting(true);
    setPaymentError(null);

    const created = await createPendingOrder({
      items: lines.map((l) => ({ bookId: l.book.id, qty: l.qty })),
      couponDiscountPct: data.couponDiscount || undefined,
      guestEmail: data.email,
      guestName: data.fullName,
    });
    if (!created.ok || !created.orderId || created.totalAmount === undefined) {
      setSubmitting(false);
      setPaymentError(created.error ?? "Something went wrong creating your order.");
      return;
    }

    const result = await payWithSavedCard(savedMethodId, created.orderId, created.totalAmount, data.email);
    setSubmitting(false);
    if (!result.ok) {
      setPaymentError(result.error ?? "That card couldn't be charged.");
      return;
    }
    lines.forEach((l) => removeItem(l.book.id));
    router.push(`/checkout/confirmation?order=${created.orderId}`);
  }

  async function completeOrder() {
    setSubmitting(true);
    setPaymentError(null);

    const created = await createPendingOrder({
      items: lines.map((l) => ({ bookId: l.book.id, qty: l.qty })),
      couponDiscountPct: data.couponDiscount || undefined,
      guestEmail: data.email,
      guestName: data.fullName,
    });
    if (!created.ok || !created.orderId || created.totalAmount === undefined) {
      setSubmitting(false);
      setPaymentError(created.error ?? "Something went wrong creating your order.");
      return;
    }

    const gateway = await initiateGatewayCheckout(created.orderId, data.paymentMethod, created.totalAmount, data.email);
    if (!gateway.ok) {
      setSubmitting(false);
      setPaymentError(gateway.error ?? "Something went wrong starting payment.");
      return;
    }

    if (gateway.configured && gateway.redirectUrl) {
      // Real gateway configured — leave the site for the hosted checkout
      // page; /checkout/return handles the redirect back.
      // eslint-disable-next-line react-hooks/immutability -- navigation in a click handler, not during render
      window.location.href = gateway.redirectUrl;
      return;
    }

    // Demo mode: no gateway credentials configured, so confirm directly.
    await confirmOrderPaidDirectly(created.orderId);
    lines.forEach((l) => removeItem(l.book.id));
    router.push(`/checkout/confirmation?order=${created.orderId}`);
  }

  if (resolvedBooks === null) {
    return (
      <div className="wrap cart-wrap" style={{ maxWidth: 820 }}>
        <div className="checkout-steps skeleton-pulse" style={{ height: 40 }} />
        <div className="checkout-step-card skeleton-pulse" style={{ minHeight: 320, marginTop: 24 }} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="wrap cart-wrap">
        <div className="empty-cart">
          <svg className="motif-big" viewBox="0 0 100 100"><Motif kind="star" color="#DED2F5" /></svg>
          <h2>Your cart is empty.</h2>
          <p style={{ color: "var(--ink-soft)", margin: "10px 0 24px" }}>Add a few books before checking out.</p>
          <Link href="/shop" className="btn btn-primary">Browse the bookshelf</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap cart-wrap" style={{ maxWidth: 820 }}>
      <h1 style={{ marginBottom: 24, textAlign: "center" }}>Checkout</h1>
      <div className="checkout-steps">
        {STEPS.map((s) => (
          <div key={s.n} className={`checkout-step-dot ${step > s.n ? "done" : ""} ${step === s.n ? "active" : ""}`}>
            <span className="checkout-step-num">{step > s.n ? "✓" : s.n}</span>
            <span className="checkout-step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="cart-layout">
          <div>
            {lines.map((l) => (
              <div className="cart-item" key={l.book.id}>
                <div className="mini-cover">
                  {l.book.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.book.coverImage} alt={`${l.book.title} cover`} />
                  )}
                </div>
                <div>
                  <h4>{l.book.title}</h4>
                  <div className="author">{l.book.author}</div>
                  <a className="remove-link" onClick={() => removeItem(l.book.id)}>Remove</a>
                </div>
                <div className="qty-control">
                  <button onClick={() => setQty(l.book.id, l.qty - 1)}>–</button>
                  <span>{l.qty}</span>
                  <button onClick={() => setQty(l.book.id, l.qty + 1)}>+</button>
                </div>
                <div className="price">${(l.book.price * l.qty).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="checkout-summary-card">
            <h3>Order summary</h3>
            <div className="summary-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="summary-row total"><span>Total</span><span>${subtotal.toFixed(2)}</span></div>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 18 }} onClick={() => goTo(2)}>
              Continue
            </button>
            <Link href="/shop" className="see-all" style={{ display: "block", textAlign: "center", marginTop: 14 }}>
              Continue browsing
            </Link>
          </div>
        </div>
      )}

      {step === 2 && (
        <form
          style={{ maxWidth: 480, margin: "0 auto" }}
          onSubmit={(e) => {
            e.preventDefault();
            goTo(3);
          }}
        >
          <label className="field-label" htmlFor="co-name">Full name</label>
          <input className="field" id="co-name" type="text" required value={data.fullName} onChange={(e) => setData((d) => ({ ...d, fullName: e.target.value }))} />
          <label className="field-label" htmlFor="co-email">Email address</label>
          <input className="field" id="co-email" type="email" required value={data.email} onChange={(e) => setData((d) => ({ ...d, email: e.target.value }))} />
          <label className="field-label" htmlFor="co-phone">Phone number</label>
          <input className="field" id="co-phone" type="tel" required value={data.phone} onChange={(e) => setData((d) => ({ ...d, phone: e.target.value }))} />
          <label className="field-label" htmlFor="co-country">Country</label>
          <input className="field" id="co-country" type="text" required value={data.country} onChange={(e) => setData((d) => ({ ...d, country: e.target.value }))} />
          <label className="field-label" htmlFor="co-address">Billing address</label>
          <textarea className="field" id="co-address" required value={data.billingAddress} onChange={(e) => setData((d) => ({ ...d, billingAddress: e.target.value }))} />
          <div className="field-hint">Books are delivered digitally; this address is used for billing and tax purposes only.</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => goTo(1)}>← Back to cart</button>
            <button className="btn btn-primary btn-small" type="submit">Continue</button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div style={{ maxWidth: 440, margin: "0 auto" }}>
          <div className="checkout-summary-card" style={{ position: "static" }}>
            <h3>Order summary</h3>
            {lines.map((l) => (
              <div className="checkout-summary-item" key={l.book.id}>
                <div className="mini-cover">
                  {l.book.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.book.coverImage} alt={`${l.book.title} cover`} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{l.book.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Qty {l.qty}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>${(l.book.price * l.qty).toFixed(2)}</div>
              </div>
            ))}
            <div className="summary-row" style={{ marginTop: 14 }}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            {data.couponDiscount > 0 && (
              <div className="summary-row"><span>Coupon discount ({data.couponCode})</span><span>-${couponAmount.toFixed(2)}</span></div>
            )}
            <div className="summary-row"><span>Taxes</span><span>Calculated at payment</span></div>
            <div className="summary-row total"><span>Grand total</span><span>${grandTotal.toFixed(2)}</span></div>
          </div>
          <label className="field-label" style={{ marginTop: 18 }} htmlFor="co-coupon">Coupon code</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="field" id="co-coupon" type="text" style={{ marginBottom: 0 }} placeholder="e.g. WELCOME10" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} />
            <button type="button" className="btn btn-ghost btn-small" onClick={applyCoupon}>Apply</button>
          </div>
          {couponError ? (
            <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{couponError}</div>
          ) : data.couponCode ? (
            <div className="field-hint" style={{ color: "#1F6B48" }}>Applied {data.couponCode}: {(data.couponDiscount * 100).toFixed(0)}% off.</div>
          ) : (
            <div className="field-hint">Have a coupon code? Enter it above.</div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => goTo(2)}>← Back</button>
            <button className="btn btn-primary btn-small" onClick={() => goTo(4)}>Continue to payment</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ maxWidth: 440, margin: "0 auto" }}>
          {savedMethods.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 14, marginBottom: 10 }}>Pay with a saved card</h4>
              {savedMethods.map((m) => (
                <div key={m.id} className="payment-method-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{m.cardType ?? "Card"} •••• {m.last4}</strong>
                    <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{m.bank}</div>
                  </div>
                  <button type="button" className="btn btn-primary btn-small" disabled={submitting} onClick={() => payWithSaved(m.id)}>
                    {submitting ? "Processing…" : `Pay $${grandTotal.toFixed(2)}`}
                  </button>
                </div>
              ))}
              <div className="auth-divider" style={{ marginTop: 16 }}><span /><small>Or pay another way</small><span /></div>
            </div>
          )}
          <div className={`payment-method-card ${data.paymentMethod === "paypal" ? "selected" : ""}`} onClick={() => setData((d) => ({ ...d, paymentMethod: "paypal" }))}>
            <input type="radio" name="checkoutPay" checked={data.paymentMethod === "paypal"} readOnly />
            <div>
              <strong>PayPal</strong>
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Pay with your PayPal account, or check out as a guest.</div>
            </div>
          </div>
          <div className={`payment-method-card ${data.paymentMethod === "paystack" ? "selected" : ""}`} onClick={() => setData((d) => ({ ...d, paymentMethod: "paystack" }))}>
            <input type="radio" name="checkoutPay" checked={data.paymentMethod === "paystack"} readOnly />
            <div>
              <strong>Paystack</strong>
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Pay by card (Visa, Mastercard, American Express, Verve).</div>
            </div>
            <div className="card-brand-row">
              <span className="card-brand-badge">Visa</span>
              <span className="card-brand-badge">Mastercard</span>
              <span className="card-brand-badge">Amex</span>
              <span className="card-brand-badge">Verve</span>
            </div>
          </div>
          <div className={`payment-method-card ${data.paymentMethod === "mpesa" ? "selected" : ""}`} onClick={() => setData((d) => ({ ...d, paymentMethod: "mpesa" }))}>
            <input type="radio" name="checkoutPay" checked={data.paymentMethod === "mpesa"} readOnly />
            <div>
              <strong>M-Pesa</strong>
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Pay with M-Pesa mobile money (Kenya), via Paystack.</div>
            </div>
          </div>

          {data.paymentMethod === "paypal" && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>You&apos;ll be securely redirected to PayPal to complete your purchase.</p>
            </div>
          )}

          {data.paymentMethod === "mpesa" && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                You&apos;ll be redirected to a secure Paystack page to enter your M-Pesa number and approve the payment
                from your phone.
              </p>
            </div>
          )}

          {data.paymentMethod === "paystack" && (
            <div style={{ marginTop: 16 }}>
              <label className="field-label" htmlFor="co-card-name">Name on card</label>
              <input className="field" id="co-card-name" type="text" value={data.cardName} onChange={(e) => setData((d) => ({ ...d, cardName: e.target.value }))} />
              <label className="field-label" htmlFor="co-card-number">Card number</label>
              <input className="field" id="co-card-number" type="text" inputMode="numeric" maxLength={19} placeholder="0000 0000 0000 0000" value={data.cardNumber} onChange={(e) => setData((d) => ({ ...d, cardNumber: e.target.value }))} />
              <div className="form-grid-2">
                <div>
                  <label className="field-label" htmlFor="co-card-expiry">Expiry</label>
                  <input className="field" id="co-card-expiry" type="text" placeholder="MM/YY" value={data.cardExpiry} onChange={(e) => setData((d) => ({ ...d, cardExpiry: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label" htmlFor="co-card-cvv">CVV</label>
                  <input className="field" id="co-card-cvv" type="text" maxLength={4} value={data.cardCvv} onChange={(e) => setData((d) => ({ ...d, cardCvv: e.target.value }))} />
                </div>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                This is a demo checkout; card details are never sent anywhere or stored. A real integration would
                tokenize this through Paystack&apos;s own secure fields, never through our own servers.
              </p>
            </div>
          )}

          {paymentError && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{paymentError}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => goTo(3)}>← Back</button>
            <button className="btn btn-primary btn-small" onClick={completeOrder} disabled={submitting}>
              {submitting ? "Processing…" : "Complete purchase"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
