import Link from "next/link";
import { CATS, type Book } from "@/lib/data/catalog";
import { hashStr } from "@/lib/hash";

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

/**
 * Converted from homeFeaturedBookCardHTML() (the-good-child-bookstore
 * _54_1.html:3472-3503) — the quick view / wishlist / add-to-cart icon
 * overlay has been removed per explicit instruction: the cover image
 * stands alone now, with no icons on top of it. Those actions are
 * still available from the book's own product page.
 */
export function BookCard({ book }: { book: Book }) {
  const pct = Math.max(0, Math.min(100, (parseFloat(book.rating) / 5) * 100));
  const discount = computeHomeDiscount(book);

  return (
    <div className="book-card fade-in-section visible">
      {discount && <span className="discount-badge">-{discount.pct}%</span>}
      <Link href={`/book/${book.id}`}>
        <div className="cover">
          {book.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element -- demo/user-uploaded covers, not static assets
            <img src={book.coverImage} alt={book.coverAltText || `${book.title} cover`} loading="lazy" decoding="async" />
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
