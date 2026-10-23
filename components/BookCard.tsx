import { imageAtWidth } from "@/lib/image-url";
import Link from "next/link";
import { CATS, bookSlug, type Book } from "@/lib/data/catalog";

/** Genre shelf name for a shelf id; "" for a book on no shelf. */
function catName(id: string): string {
  return CATS.find((c) => c.id === id)?.name ?? "";
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

  return (
    <div className="book-card fade-in-section visible">
      <Link href={`/${bookSlug(book)}`}>
        <div className="cover">
          {book.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element -- demo/user-uploaded covers, not static assets
            <img src={imageAtWidth(book.coverImage, 480)} width={300} height={400} alt={book.coverAltText || `${book.title} cover`} loading="lazy" decoding="async" />
          )}
        </div>
      </Link>
      {/* The book's Category (e.g. "Adventure Series"); the shelf/genre name is only a fallback for books with no Category. */}
      <div className="cat-tag">{book.series || catName(book.category) || ""}</div>
      <Link href={`/${bookSlug(book)}`}>
        <h3>{book.title}</h3>
      </Link>
      <div className="author">{book.author}</div>
      <div className="meta-row">
        <div className="price-group">
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
