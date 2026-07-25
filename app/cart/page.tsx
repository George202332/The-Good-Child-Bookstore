"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Book } from "@/lib/data/catalog";
import { Motif } from "@/components/Motif";
import { useCart } from "@/hooks/useCart";
import { resolveCartBooks } from "@/actions/cart-books";

/** Converted from cartHTML() (the-good-child-bookstore_54_1.html:4554-4603).
 * Books are resolved from the real database (falling back to the static
 * catalog only for demo ids) rather than only ever checking the static
 * catalog — previously a real, submitted book silently vanished from the
 * cart instead of showing up. While that resolution is in flight, a
 * sized skeleton is shown instead of guessing with static data — the
 * previous version briefly rendered the demo catalog's lookup result,
 * which could silently drop a real book from view for a moment before
 * the real data arrived. */
export default function CartPage() {
  const { items, setQty, removeItem } = useCart();
  const [resolved, setResolved] = useState<Book[] | null>(null);

  useEffect(() => {
    const ids = items.map((i) => i.bookId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset to loading state before the new resolution arrives, so stale data from a previous cart never lingers on screen
    setResolved(null);
    resolveCartBooks(ids).then(setResolved);
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="wrap cart-wrap">
        <div className="empty-cart">
          <svg className="motif-big" viewBox="0 0 100 100">
            <Motif kind="star" color="#DED2F5" />
          </svg>
          <h2>Your cart is waiting for a story.</h2>
          <p style={{ color: "var(--ink-soft)", margin: "10px 0 24px" }}>
            Nothing added yet; the whole bookshelf is one click away.
          </p>
          <Link href="/shop" className="btn btn-primary">Browse the bookshelf</Link>
        </div>
      </div>
    );
  }

  if (resolved === null) {
    return (
      <div className="wrap cart-wrap">
        <h1 style={{ marginBottom: 30 }}>Your cart</h1>
        <div className="cart-layout">
          <div>
            {items.map((i) => (
              <div key={i.bookId} className="cart-item skeleton-pulse" style={{ minHeight: 108 }}>
                <div className="mini-cover" style={{ background: "var(--line)" }} />
                <div>
                  <div style={{ width: "60%", height: 16, background: "var(--line)", borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ width: "40%", height: 12, background: "var(--line)", borderRadius: 4 }} />
                </div>
                <div />
                <div style={{ width: 60, height: 16, background: "var(--line)", borderRadius: 4 }} />
              </div>
            ))}
          </div>
          <div className="summary-card" style={{ minHeight: 220 }} />
        </div>
      </div>
    );
  }

  const bookSource = resolved;
  const lines = items
    .map((i) => ({ book: bookSource.find((b) => b.id === i.bookId), qty: i.quantity }))
    .filter((l): l is { book: NonNullable<typeof l.book>; qty: number } => !!l.book);
  const subtotal = lines.reduce((sum, l) => sum + l.book.price * l.qty, 0);
  const shipping = subtotal > 35 ? 0 : 4.5;

  return (
    <div className="wrap cart-wrap">
      <h1 style={{ marginBottom: 30 }}>Your cart</h1>
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
        <div className="summary-card">
          <h3>Order summary</h3>
          <div className="summary-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span></div>
          <div className="summary-row total"><span>Total</span><span>${(subtotal + shipping).toFixed(2)}</span></div>
          <Link href="/checkout" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 18 }}>
            Checkout
          </Link>
          <Link href="/shop" className="see-all" style={{ display: "block", textAlign: "center", marginTop: 14 }}>
            Continue browsing
          </Link>
        </div>
      </div>
    </div>
  );
}
