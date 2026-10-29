"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Book } from "@/lib/data/catalog";
import { Motif } from "@/components/Motif";
import { useCart, type CartItem } from "@/hooks/useCart";
import { createPendingOrder } from "@/actions/orders";
import { initiateGatewayCheckout, initiatePayPalCheckout, getPaymentAvailability } from "@/actions/payment-init";
import { resolveCartBooks } from "@/actions/cart-books";
import { getShippingOptions, type ShippingOptionRow } from "@/actions/shipping-options";
import { listMyPaymentMethods, payWithSavedCard, type SavedPaymentMethodRow } from "@/actions/payment-methods";
import { PaymentBadgeIcon } from "@/components/PaymentBadgeIcon";
import { COUNTRIES } from "@/lib/countries";
import { countryToIso2 } from "@/lib/user-country";
import { composeShipAddress } from "@/lib/lulu-order";
import { restrictionMessage } from "@/lib/book-country-restriction";
import { isLineRestricted } from "@/lib/book-visibility";
import { getSiteSettings } from "@/actions/site-settings";
import { DEFAULT_SITE_SETTINGS, type PaymentBadgeUrls } from "@/lib/site-settings";

/**
 * Converted from checkoutHTML() and its 5 step-render functions
 * (the-good-child-bookstore_54_1.html:4606-4940). Account-linked
 * conveniences from the original (saved-address dropdown, saved-payment-
 * method dropdown, auto-filling name/email/phone from a logged-in
 * reader's profile) are not yet wired up, since this build doesn't have
 * a reader profile-editing page yet. PDF receipt generation
 * (downloadReceiptPDF, jsPDF-based) is also not ported.
 *
 * Payment: "Pay by card" creates a PENDING order and sends the buyer to
 * Paystack's own hosted payment page (PayPal likewise); the buyer lands back
 * on /checkout/return, which asks the gateway server-side whether the payment
 * really happened - right order, USD, exact total - and only then marks the
 * order PAID before showing /checkout/confirmation. Card details are only
 * ever typed on the gateway's page, never on this site. There is no demo
 * mode: with no gateway configured, checkout says payments are unavailable.
 */

interface CheckoutData {
  fullName: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  country: string;
  billingAddress: string;
  /** Apartment, suite, unit (optional) — print orders only. */
  street2: string;
  /** City / state-or-province / postal code — asked for print orders, where
   * the print partner needs a complete address (see lib/lulu-order.ts). */
  city: string;
  state: string;
  postcode: string;
  paymentMethod: "paystack" | "mpesa";
}

const STEPS = [
  { n: 1, label: "Cart" },
  { n: 2, label: "Your details" },
  { n: 3, label: "Order summary" },
  { n: 4, label: "Payment" },
  { n: 5, label: "Confirmation" },
];

/** The address-bar values this page needs, read on the server (app/checkout/page.tsx)
 * so the whole checkout is part of the first page sent, not filled in afterwards. */
export function CheckoutClient({
  directBookId,
  directFormat,
  paymentFailed,
}: {
  directBookId: string | null;
  directFormat: CartItem["format"] | null;
  paymentFailed: boolean;
}) {
  const { items: cartItems, setQty, removeItem } = useCart();
  const isDirectBuy = !!directBookId && !!directFormat;
  // A "Buy Direct" purchase never touches the persisted cart — it's an
  // entirely separate, one-item source for this checkout session only,
  // so whatever's already in the real cart is completely unaffected and
  // still there if the customer goes back to /cart afterward.
  const items: CartItem[] = useMemo(
    () => (isDirectBuy ? [{ bookId: directBookId, format: directFormat, quantity: 1 }] : cartItems),
    [isDirectBuy, directBookId, directFormat, cartItems]
  );
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<CheckoutData>({
    fullName: "",
    email: "",
    phone: "",
    phoneCountryCode: "+1",
    country: "",
    billingAddress: "",
    street2: "",
    city: "",
    state: "",
    postcode: "",
    paymentMethod: "paystack",
  });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  // null = still checking which payment methods are switched on.
  const [availability, setAvailability] = useState<{ paystack: boolean; paypal: boolean } | null>(null);
  useEffect(() => {
    getPaymentAvailability().then(setAvailability).catch(() => setAvailability({ paystack: false, paypal: false }));
  }, []);
  const paypalReady = !!availability?.paypal;
  const [submitting, setSubmitting] = useState(false);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethodRow[]>([]);
  const [resolvedBooks, setResolvedBooks] = useState<Book[] | null>(null);
  // Shipping methods offered for printed copies, for the chosen country.
  const [shippingOptions, setShippingOptions] = useState<ShippingOptionRow[]>([]);
  const [shippingLevel, setShippingLevel] = useState("");
  const [paymentBadges, setPaymentBadges] = useState<PaymentBadgeUrls>(DEFAULT_SITE_SETTINGS.paymentBadges);

  useEffect(() => {
    getSiteSettings().then((s) => setPaymentBadges(s.paymentBadges));
  }, []);

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

  const printCountry = data.country;
  const needsShipping = items.some((i) => i.format === "paperback" || i.format === "hardcover");
  // The address as the order will store it, used to ask for the exact
  // postage once it is filled in (until then an estimate is shown).
  const quoteAddress = composeShipAddress({ street: data.billingAddress, street2: data.street2, city: data.city, state: data.state, postcode: data.postcode });
  const quotePhone = data.phone ? `${data.phoneCountryCode}${data.phone}` : "";
  const quoteItemsKey = JSON.stringify(items.filter((i) => i.format === "paperback" || i.format === "hardcover").map((i) => [i.bookId, i.quantity, i.format]));
  useEffect(() => {
    if (!needsShipping || !printCountry) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to choose until a country is picked
      setShippingOptions([]);
      return;
    }
    let cancelled = false;
    // Wait a moment after typing stops so we ask for a price once, not per keystroke.
    const timer = setTimeout(() => {
      getShippingOptions({
        items: (JSON.parse(quoteItemsKey) as [string, number, string][]).map(([bookId, qty, format]) => ({ bookId, qty, format })),
        country: printCountry,
        address: quoteAddress,
        phone: quotePhone,
        name: data.fullName,
      }).then((opts) => {
        if (cancelled) return;
        setShippingOptions(opts);
        setShippingLevel((cur) => (opts.some((o) => o.id === cur) ? cur : opts[0]?.id ?? ""));
      });
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [needsShipping, printCountry, quoteAddress, quotePhone, quoteItemsKey, data.fullName]);

  const bookSource = resolvedBooks ?? [];
  const FORMAT_LABEL: Record<string, string> = { ebook: "eBook", paperback: "Paperback", hardcover: "Hardcover", audiobook: "Audiobook" };
  const priceFor = (book: Book, format: string) =>
    format === "ebook" ? book.formats.ebook : format === "hardcover" ? book.formats.print : format === "paperback" ? book.formats.paperback : book.formats.audiobook;
  const lines = items
    .map((i) => ({ book: bookSource.find((b) => b.id === i.bookId), qty: i.quantity, format: i.format }))
    .filter((l): l is { book: NonNullable<typeof l.book>; qty: number; format: typeof l.format } => !!l.book);
  const subtotal = lines.reduce((sum, l) => sum + priceFor(l.book, l.format) * l.qty, 0);
  const hasPrintItem = lines.some((l) => l.format === "paperback" || l.format === "hardcover");
  // The customer pays postage for printed copies, on top of the books.
  const chosenShipping = hasPrintItem ? shippingOptions.find((o) => o.id === shippingLevel) : undefined;
  const shippingCost = chosenShipping?.amount ?? 0;
  const grandTotal = Math.round((subtotal + shippingCost) * 100) / 100;
  // Print copies are shipped by our print partner, which needs a complete
  // address; the order stores it as street / city / state / postal code.
  const shipAddressValue = hasPrintItem
    ? composeShipAddress({ street: data.billingAddress, street2: data.street2, city: data.city, state: data.state, postcode: data.postcode })
    : data.billingAddress;
  // Lines whose book is restricted for this visitor (account country / IP
  // geo, flagged by resolveCartBooks) or — for print — for the ship-to
  // country entered at step 2. Payment stays disabled until they are
  // removed; createPendingOrder re-checks all of this on the server.
  const shipIso = countryToIso2(data.country);
  const restrictedLines = lines.filter(
    (l) => l.book.restricted || isLineRestricted(l.book.restrictedCountries, { shipCountry: shipIso }, l.format)
  );
  const hasRestricted = restrictedLines.length > 0;
  const restrictedNotice = hasRestricted ? (
    <div className="field-hint" role="alert" style={{ color: "var(--coral-deep)", marginBottom: 14 }}>
      {restrictedLines.map((l) => (
        <div key={`${l.book.id}:${l.format}`} style={{ marginBottom: 4 }}>
          <strong>{l.book.title}</strong>: {restrictionMessage}{" "}
          {isDirectBuy ? (
            <Link href="/bookshelf">Back to the bookshelf</Link>
          ) : (
            <button type="button" className="cart-remove-btn" onClick={() => removeItem(l.book.id, l.format)}>Remove</button>
          )}
        </div>
      ))}
    </div>
  ) : null;

  function goTo(n: number) {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function payWithSaved(savedMethodId: string) {
    if (hasRestricted) return;
    setSubmitting(true);
    setPaymentError(null);

    const created = await createPendingOrder({
      items: lines.map((l) => ({ bookId: l.book.id, qty: l.qty, format: l.format })),
      guestEmail: data.email,
      guestName: data.fullName,
      shipName: data.fullName,
      shipPhone: data.phone.trim() ? `${data.phoneCountryCode} ${data.phone.trim()}` : undefined,
      shipCountry: data.country,
      shipAddress: shipAddressValue,
      shippingLevel: hasPrintItem ? shippingLevel : undefined,
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
    router.push(`/checkout/confirmation?order=${created.orderId}`);
  }

  async function payWithPayPal() {
    setPaymentError(null);
    if (hasRestricted) return;
    setSubmitting(true);
    const created = await createPendingOrder({
      items: lines.map((l) => ({ bookId: l.book.id, qty: l.qty, format: l.format })),
      guestEmail: data.email,
      guestName: data.fullName,
      shipName: data.fullName,
      shipPhone: data.phone.trim() ? `${data.phoneCountryCode} ${data.phone.trim()}` : undefined,
      shipCountry: data.country,
      shipAddress: shipAddressValue,
      shippingLevel: hasPrintItem ? shippingLevel : undefined,
    });
    if (!created.ok || !created.orderId) {
      setSubmitting(false);
      setPaymentError(created.error ?? "Something went wrong creating your order.");
      return;
    }
    const result = await initiatePayPalCheckout(created.orderId);
    if (!result.ok || !result.redirectUrl) {
      setSubmitting(false);
      setPaymentError(result.error ?? "Something went wrong starting PayPal.");
      return;
    }
    // eslint-disable-next-line react-hooks/immutability -- navigation in a click handler, not during render
    window.location.href = result.redirectUrl;
  }

  async function completeOrder() {
    setPaymentError(null);
    if (hasRestricted) return;

    setSubmitting(true);

    const created = await createPendingOrder({
      items: lines.map((l) => ({ bookId: l.book.id, qty: l.qty, format: l.format })),
      guestEmail: data.email,
      guestName: data.fullName,
      shipName: data.fullName,
      shipPhone: data.phone.trim() ? `${data.phoneCountryCode} ${data.phone.trim()}` : undefined,
      shipCountry: data.country,
      shipAddress: shipAddressValue,
      shippingLevel: hasPrintItem ? shippingLevel : undefined,
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

    // No gateway is configured: there is no demo mode on the live site.
    setSubmitting(false);
    setPaymentError("Card payments aren't available right now. Please try again later or contact support.");
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
          <Link href="/bookshelf" className="btn btn-primary">Browse the Bookshelf</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap cart-wrap" style={{ maxWidth: step === 1 ? undefined : 820 }}>
      <h1 style={{ marginBottom: 24, textAlign: "center" }}>Checkout</h1>
      {paymentFailed && (
        <div className="checkout-error" role="alert" style={{ marginBottom: 16 }}>
          Your payment wasn&apos;t completed, so you have not been charged for this order. You can try again below.
        </div>
      )}
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
            {lines.map((l) => {
              const isDigital = l.format === "ebook" || l.format === "audiobook";
              return (
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
                    <div className="cart-item-format-tag">{FORMAT_LABEL[l.format]}</div>
                    {isDigital ? (
                      <div className="cart-item-digital-note">Instant digital delivery — no shipping</div>
                    ) : (
                      <div className="cart-item-digital-note">Fulfilled by Lulu</div>
                    )}
                  </div>
                  {isDigital || isDirectBuy ? (
                    <div />
                  ) : (
                    <div className="qty-control">
                      <button onClick={() => setQty(l.book.id, l.format, l.qty - 1)}>–</button>
                      <span>{l.qty}</span>
                      <button onClick={() => setQty(l.book.id, l.format, l.qty + 1)}>+</button>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <div className="price">${(priceFor(l.book, l.format) * l.qty).toFixed(2)}</div>
                    <button
                      type="button"
                      className="cart-remove-btn"
                      aria-label={`Remove ${l.book.title} (${FORMAT_LABEL[l.format]}) from your cart`}
                      onClick={() => (isDirectBuy ? router.push("/bookshelf") : removeItem(l.book.id, l.format))}
                    >
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="checkout-summary-card">
            <h3>Order Summary</h3>
            <div className="summary-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            {hasPrintItem && <div className="summary-row"><span>Shipping (printed copies)</span><span>Added at checkout</span></div>}
            <div className="summary-row total"><span>{hasPrintItem ? "Total before shipping" : "Total"}</span><span>${subtotal.toFixed(2)}</span></div>
            {restrictedNotice}
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 18 }} disabled={hasRestricted} onClick={() => goTo(2)}>
              Continue
            </button>
            <Link href="/bookshelf" className="see-all" style={{ display: "block", textAlign: "center", marginTop: 14 }}>
              Continue browsing
            </Link>
          </div>
        </div>
      )}

      {step === 2 && (
        <form
          style={{ maxWidth: 420, margin: "0 auto" }}
          onSubmit={(e) => {
            e.preventDefault();
            goTo(3);
          }}
        >
          <label className="field-label field-label-compact" htmlFor="co-name">Full name</label>
          <input className="field field-compact" id="co-name" type="text" required value={data.fullName} onChange={(e) => setData((d) => ({ ...d, fullName: e.target.value }))} />
          <label className="field-label field-label-compact" htmlFor="co-email">Email address</label>
          <input className="field field-compact" id="co-email" type="email" required value={data.email} onChange={(e) => setData((d) => ({ ...d, email: e.target.value }))} />
          <label className="field-label field-label-compact" htmlFor="co-country">Country</label>
          <select
            className="field field-compact"
            id="co-country"
            required
            value={data.country}
            onChange={(e) => {
              const selected = COUNTRIES.find((c) => c.name === e.target.value);
              setData((d) => ({ ...d, country: e.target.value, phoneCountryCode: selected?.dialCode ?? d.phoneCountryCode }));
            }}
          >
            <option value="">Select a country</option>
            {COUNTRIES.map((c) => <option key={c.iso2} value={c.name}>{c.name}</option>)}
          </select>
          <label className="field-label field-label-compact" htmlFor="co-phone">Phone number {!hasPrintItem && <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(optional)</span>}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              className="field field-compact"
              style={{ maxWidth: 110, flexShrink: 0 }}
              aria-label="Phone country code"
              value={data.phoneCountryCode}
              onChange={(e) => setData((d) => ({ ...d, phoneCountryCode: e.target.value }))}
            >
              {COUNTRIES.map((c) => <option key={c.iso2} value={c.dialCode}>{c.dialCode} {c.iso2}</option>)}
            </select>
            <input className="field field-compact" id="co-phone" type="tel" style={{ flex: 1 }} required={hasPrintItem} value={data.phone} onChange={(e) => setData((d) => ({ ...d, phone: e.target.value }))} />
          </div>
          <label className="field-label field-label-compact" htmlFor="co-address">{hasPrintItem ? "Street address" : "Billing address"}</label>
          <textarea className="field field-compact" id="co-address" required value={data.billingAddress} onChange={(e) => setData((d) => ({ ...d, billingAddress: e.target.value }))} />
          {hasPrintItem && (
            <>
              <label className="field-label field-label-compact" htmlFor="co-street2">Apartment, suite, unit <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(optional)</span></label>
              <input className="field field-compact" id="co-street2" type="text" value={data.street2} onChange={(e) => setData((d) => ({ ...d, street2: e.target.value }))} />
              <label className="field-label field-label-compact" htmlFor="co-city">City</label>
              <input className="field field-compact" id="co-city" type="text" required value={data.city} onChange={(e) => setData((d) => ({ ...d, city: e.target.value }))} />
              <label className="field-label field-label-compact" htmlFor="co-state">State / province / region {["United States", "Canada", "Australia", "Mexico"].includes(data.country) ? "" : <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(if your country uses one)</span>}</label>
              <input className="field field-compact" id="co-state" type="text" required={["United States", "Canada", "Australia", "Mexico"].includes(data.country)} value={data.state} onChange={(e) => setData((d) => ({ ...d, state: e.target.value }))} />
              <label className="field-label field-label-compact" htmlFor="co-postcode">Postal / ZIP code</label>
              <input className="field field-compact" id="co-postcode" type="text" required value={data.postcode} onChange={(e) => setData((d) => ({ ...d, postcode: e.target.value }))} />
              <fieldset style={{ border: "none", padding: 0, margin: "12px 0 0" }}>
                <legend className="field-label field-label-compact">Shipping method</legend>
                {shippingOptions.length === 0 ? (
                  <div className="field-hint">Choose your country above to see the shipping methods and prices available to you.</div>
                ) : (
                  <div className="ship-options">
                    {shippingOptions.map((o) => (
                      <label key={o.id} className={`ship-option${shippingLevel === o.id ? " selected" : ""}`}>
                        <input
                          type="radio"
                          name="co-shipping-level"
                          value={o.id}
                          checked={shippingLevel === o.id}
                          onChange={() => setShippingLevel(o.id)}
                        />
                        <span className="ship-option-body">
                          <span className="ship-option-top">
                            <strong>{o.label}</strong>
                            <span className="ship-option-price">${o.amount.toFixed(2)}{o.source === "estimate" ? " (estimate)" : ""}</span>
                          </span>
                          <span className="ship-option-detail">{o.detail}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            </>
          )}
          <div className="field-hint ship-note">
            {hasPrintItem
              ? "Your print copy will be printed and shipped to this address. Shipping is paid by you and is added to your total."
              : "Books are delivered digitally; this address is used for billing and tax purposes only."}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => goTo(1)}>← Back to Cart</button>
            <button className="btn btn-primary btn-small" type="submit">Continue</button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div style={{ maxWidth: 440, margin: "0 auto" }}>
          <div className="checkout-summary-card" style={{ position: "static" }}>
            <h3>Order Summary</h3>
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
                  {(l.format === "paperback" || l.format === "hardcover") && (
                    <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Fulfilled by Lulu</div>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>${(priceFor(l.book, l.format) * l.qty).toFixed(2)}</div>
              </div>
            ))}
            <div className="summary-row" style={{ marginTop: 14 }}><span>{hasPrintItem ? "Books" : "Subtotal"}</span><span>${subtotal.toFixed(2)}</span></div>
            {hasPrintItem && (
              <div className="summary-row">
                <span>Shipping{chosenShipping ? ` (${chosenShipping.label}, as quoted by Lulu)` : ""}</span>
                <span>{chosenShipping ? `$${chosenShipping.amount.toFixed(2)}${chosenShipping.source === "estimate" ? " (estimate)" : ""}` : "Choose a method"}</span>
              </div>
            )}
            <div className="summary-row"><span>Taxes</span><span>Calculated at payment</span></div>
            <div className="summary-row total"><span>Grand total</span><span>${grandTotal.toFixed(2)}</span></div>
          </div>
          {restrictedNotice && <div style={{ marginTop: 16 }}>{restrictedNotice}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => goTo(2)}>← Back</button>
            <button className="btn btn-primary btn-small" disabled={hasRestricted} onClick={() => goTo(4)}>Continue to Payment</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ maxWidth: 400, margin: "0 auto" }}>
          {savedMethods.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13.5, marginBottom: 8 }}>Pay with a Saved Card</h4>
              {savedMethods.map((m) => (
                <div key={m.id} className="payment-method-card payment-method-card-compact" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{m.cardType ?? "Card"} •••• {m.last4}</strong>
                    <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>{m.bank}</div>
                  </div>
                  <button type="button" className="btn btn-primary btn-small" disabled={submitting || hasRestricted} onClick={() => payWithSaved(m.id)}>
                    {submitting ? "Processing…" : `Pay $${grandTotal.toFixed(2)}`}
                  </button>
                </div>
              ))}
              <div className="auth-divider" style={{ marginTop: 14 }}><span /><small>Or pay with a new card</small><span /></div>
            </div>
          )}

          {paypalReady && (
            <div style={{ marginBottom: 16 }}>
              <button
                type="button"
                className="btn btn-block"
                disabled={submitting || hasRestricted}
                onClick={payWithPayPal}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#FFC439", color: "#111", fontWeight: 700 }}
              >
                <PaymentBadgeIcon type="paypal" width={44} height={28} />
                {submitting ? "Processing…" : `Pay $${grandTotal.toFixed(2)} with PayPal`}
              </button>
              <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink-faint)", margin: "8px 0 0" }}>
                On PayPal&apos;s secure page, log in with your PayPal email or pay with a debit or credit card. We never see your card number.
              </p>
              <div className="auth-divider" style={{ marginTop: 14 }}><span /><small>Or pay with a card</small><span /></div>
            </div>
          )}

          {availability?.paystack !== false && (
            <>
          <p style={{ textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 10 }}>
            Pay securely with Paystack cards
          </p>
          <div className="card-brand-row card-brand-row-centered">
            {(["mastercard", "visa", "amex", "verve"] as const).map((key) =>
              paymentBadges[key] ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded badge image, not a static asset
                <img key={key} src={paymentBadges[key]} alt={key} className="payment-badge-img" style={{ height: 36 }} />
              ) : (
                <PaymentBadgeIcon key={key} type={key} width={68} height={43} />
              )
            )}
          </div>
          <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--ink-faint)", margin: "0 0 14px" }}>
            You&apos;ll enter your card details on Paystack&apos;s secure payment page. We never see or store your card number.
          </p>

            </>
          )}

          {restrictedNotice}
          {paymentError && (
            <div className="checkout-error" role="alert">
              {paymentError}
            </div>
          )}
          {availability && !availability.paystack && !paypalReady && (
            <div className="checkout-error" role="alert">
              Online payments aren&apos;t available right now. Please try again later or contact support.
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => goTo(3)}>← Back</button>
            {(availability === null || availability.paystack) && (
              <button className="btn btn-primary btn-small" onClick={completeOrder} disabled={submitting || hasRestricted || availability === null}>
                {submitting ? "Processing…" : "Pay by Card"}
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
