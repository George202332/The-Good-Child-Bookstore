"use client";

import Link from "next/link";
import { CATS, type Book } from "@/lib/data/catalog";
import { hashStr } from "@/lib/hash";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";

function catName(id: string): string {
  return CATS.find((c) => c.id === id)?.name ?? id;
}

/** Ported from computeHomeDiscount() (the-good-child-bookstore_54_1.html:3465-3471):
 * roughly a third of the catalog shows a deterministic homepage discount. */
function computeHomeDiscount(b: Book): { pct: number; was: number } | null {
  const seed = hashStr(b.id);
  if (seed % 3 !== 0) return null;
  const pct = 10 + (seed % 4) * 5; // 10, 15, 20, or 25
  const was = +(b.price / (1 - pct / 100)).toFixed(2);
  return { pct, was };
}

/** Converted from homeFeaturedBookCardHTML() (the-good-child-bookstore_54_1.html:3472-3503). */
export function BookCard({ book, onQuickView }: { book: Book; onQuickView?: (book: Book) => void }) {
  const pct = Math.max(0, Math.min(100, (parseFloat(book.rating) / 5) * 100));
  const discount = computeHomeDiscount(book);
  const { addItem } = useCart();
  const { has, toggle } = useWishlist();
  const inWishlist = has(book.id);

  return (
    <div className="book-card fade-in-section visible">
      {discount && <span className="discount-badge">-{discount.pct}%</span>}
      <div className="book-card-actions">
        <button
          type="button"
          className="book-card-action-btn"
          title="Quick view"
          aria-label={`Quick view ${book.title}`}
          onClick={(e) => {
            e.preventDefault();
            onQuickView?.(book);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2}>
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
            <circle cx={12} cy={12} r={3} />
          </svg>
        </button>
        <button
          type="button"
          className={`book-card-action-btn ${inWishlist ? "active" : ""}`}
          title="Wishlist"
          aria-label={`Toggle wishlist for ${book.title}`}
          onClick={(e) => {
            e.preventDefault();
            toggle(book.id);
          }}
        >
          <svg viewBox="0 0 24 24" fill={inWishlist ? "var(--coral-deep)" : "none"} stroke="var(--ink)" strokeWidth={2}>
            <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z" />
          </svg>
        </button>
        <button
          type="button"
          className="book-card-action-btn"
          title="Add to cart (eBook)"
          aria-label={`Add ${book.title} to cart`}
          onClick={(e) => {
            e.preventDefault();
            addItem(book.id, "ebook");
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2}>
            <circle cx={9} cy={21} r={1} />
            <circle cx={20} cy={21} r={1} />
            <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
          </svg>
        </button>
      </div>
      <Link href={`/book/${book.id}`}>
        <div className="cover">
          {book.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element -- demo/user-uploaded covers, not static assets
            <img src={book.coverImage} alt={`${book.title} cover`} loading="lazy" decoding="async" />
          )}
        </div>
      </Link>
      <div className="cat-tag">{catName(book.category)}</div>
      <Link href={`/book/${book.id}`}>
        <h3>{book.title}</h3>
      </Link>
      <div className="author">{book.author}</div>
      <div className="meta-row">
        <div className="price-group">
          {discount && <span className="price-was">${discount.was.toFixed(2)}</span>}
          <span className="price">${book.price.toFixed(2)}</span>
        </div>
        <div className="rating" title={`${book.rating} out of 5`}>
          <span className="stars-wrap">
            <span className="stars-bg">★★★★★</span>
            <span className="stars-fg" style={{ width: `${pct}%` }}>★★★★★</span>
          </span>
          <span className="rating-score">{book.rating}</span>
        </div>
      </div>
    </div>
  );
}
