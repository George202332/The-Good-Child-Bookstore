"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { BOOKS, CATS, type Book } from "@/lib/data/catalog";
import { reviewStats, reviewsForBook } from "@/lib/data/reviews";
import { BookCard } from "@/components/BookCard";
import { AffiliateClickTracker } from "@/components/AffiliateClickTracker";
import { LiveReviewSection } from "@/components/LiveReviewSection";
import { FollowAuthorButton } from "@/components/FollowAuthorButton";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";

function catName(id: string): string {
  return CATS.find((c) => c.id === id)?.name ?? id;
}

type FormatKey = "ebook" | "print" | "paperback" | "audiobook";
const FORMAT_LABELS: Record<FormatKey, string> = {
  ebook: "eBook",
  print: "Hardcover",
  paperback: "Paperback",
  audiobook: "Audiobook",
};

/**
 * Converted from detailHTML() (the-good-child-bookstore_54_1.html:4235-4492).
 * One thing from the original is intentionally NOT carried over because it
 * was dead code in the live site (present in JS but never wired to any
 * rendered button): the quantity stepper (add-to-cart always added 1
 * regardless of detailQty). The seed reviews below are the same
 * deterministic demo reviews the original showed for the static catalog
 * — real, submitted books (isRealBook) skip these entirely rather than
 * showing fabricated reviews attached to a genuine title; their real
 * reviews come from LiveReviewSection, which is actually wired to a
 * working "Write a review" button and persists to the database.
 */
export function BookDetailClient({ book, isRealBook }: { book: Book; isRealBook: boolean }) {
  const b = book;
  const [format, setFormat] = useState<FormatKey>("print");
  const { addItem } = useCart();
  const { has, toggle } = useWishlist();

  if (!b) {
    return (
      <div className="wrap" style={{ padding: "80px 0" }}>
        <h2>We couldn&apos;t find that book.</h2>
        <Link href="/shop" className="btn btn-primary" style={{ marginTop: 20 }}>
          Back to the bookshelf
        </Link>
      </div>
    );
  }

  const featuredBooks = BOOKS.filter((x) => x.featured && x.id !== b.id).slice(0, 10);
  let alsoSearchedBooks = BOOKS.filter((x) => x.id !== b.id && (x.category === b.category || x.genre === b.genre));
  if (alsoSearchedBooks.length < 10) {
    const usedIds = new Set([b.id, ...alsoSearchedBooks.map((x) => x.id)]);
    const fillers = BOOKS.filter((x) => !usedIds.has(x.id)).slice(0, 10 - alsoSearchedBooks.length);
    alsoSearchedBooks = alsoSearchedBooks.concat(fillers);
  } else {
    alsoSearchedBooks = alsoSearchedBooks.slice(0, 10);
  }

  const initials = b.author.split(" ").map((w) => w[0]).join("").slice(0, 2);
  const listPrice = +(b.formats.ebook * 1.7).toFixed(2);
  const discountPct = Math.round((1 - b.formats.ebook / listPrice) * 100);
  const fmtLabel = FORMAT_LABELS[format];
  const stats = isRealBook
    ? { counts: [0, 0, 0, 0, 0], total: b.reviews, avg: b.rating, pct: [0, 0, 0, 0, 0] }
    : reviewStats(b, []);
  const reviews = isRealBook ? [] : reviewsForBook(b, []);
  const inWishlist = has(b.id);
  const query = encodeURIComponent(`${b.title} ${b.author}`);
  const scrollTrack = (id: string, dir: 1 | -1) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollBy({ left: Math.max(220, el.clientWidth * 0.8) * dir, behavior: "smooth" });
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: b.title,
    author: { "@type": "Person", name: b.author },
    isbn: b.isbn,
    genre: b.genre,
    inLanguage: "en",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: b.rating,
      reviewCount: b.reviews,
    },
    offers: {
      "@type": "Offer",
      price: b.price.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div className="wrap detail-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Suspense fallback={null}>
        <AffiliateClickTracker />
      </Suspense>
      <div className="breadcrumb">
        <Link href="/">Home</Link> › <Link href="/shop">Bookshelf</Link> ›{" "}
        <Link href={`/shop?cat=${b.category}`}>{catName(b.category)}</Link> › {b.genre}
      </div>
      <div className="az-grid">
        <div className="az-left">
          <div className="detail-cover-wrap">
            <div className="detail-cover">
              {b.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.coverImage}
                  alt={`${b.title} cover`}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
                />
              )}
            </div>
          </div>
          <div className="az-sample-btns">
            <button type="button" className="btn btn-ghost btn-small btn-block">Read sample</button>
            <button type="button" className="btn btn-ghost btn-small btn-block">Listen to sample</button>
          </div>
          <div className="az-author-card">
            <div className="az-author-card-label">About the author</div>
            <div className="az-author-row">
              <div className="quote-avatar" style={{ background: b.palette[1] }}>{initials}</div>
              <div className="az-author-name">{b.author}</div>
              <FollowAuthorButton bookId={b.id} />
            </div>
          </div>
        </div>

        <div className="detail-info">
          <div className="detail-cat-tag">{catName(b.category)}</div>
          <div className="az-title-row">
            <h1>{b.title}</h1>
            <button type="button" className="az-share-btn" title="Share">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx={18} cy={5} r={3} />
                <circle cx={6} cy={12} r={3} />
                <circle cx={18} cy={19} r={3} />
                <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
              </svg>
            </button>
          </div>
          <div className="az-byline">
            by <strong>{b.author}</strong> (Author)<span className="divider">|</span>Format: <strong>{fmtLabel}</strong>
          </div>
          <div className="az-rating-row">
            <span className="rating-num">{b.rating}</span>
            <span className="stars-inline">★★★★★</span>
            <span className="rev-count">{b.reviews} ratings</span>
          </div>
          <div className="detail-isbn">ISBN {b.isbn}</div>
          <div className="detail-tags">
            <span className="age-pill">Ages {b.age}</span>
            <span className="age-pill" style={{ background: "var(--mint)", color: "#1F6B48" }}>{b.genre}</span>
          </div>

          <div className="az-desc">
            <div className="buy-tabs">
              <a className="buy-tab" href={`https://www.amazon.com/s?k=${query}`} target="_blank" rel="noopener">Amazon</a>
              <a className="buy-tab" href={`https://books.apple.com/us/search?term=${query}`} target="_blank" rel="noopener">Apple Books</a>
              <a className="buy-tab" href={`https://www.google.com/search?tbm=bks&q=${query}`} target="_blank" rel="noopener">Google</a>
              <a className="buy-tab" href={`https://www.barnesandnoble.com/s/${query}`} target="_blank" rel="noopener">Barnes and Noble</a>
              <a className="buy-tab" href={`https://www.kobo.com/search?query=${query}`} target="_blank" rel="noopener">Kobo</a>
              <a className="buy-tab" href={`https://www.overdrive.com/search?q=${query}`} target="_blank" rel="noopener">Overdrive</a>
            </div>
            <p className="az-quote">&quot;A gentle, richly illustrated story built for read-aloud evenings.&quot;</p>
            <p className="az-lede">A quietly beloved pick from The Good Child Bookstore shelf team.</p>
            <p>{b.blurb}</p>
            <p>
              Shelved under {catName(b.category)} for ages {b.age}, and hand-picked for the read-aloud rhythm that
              makes a bedtime story worth asking for twice.
            </p>
          </div>

          <div className="az-details-card">
            <div className="carousel-outer">
              <button type="button" className="carousel-arrow carousel-left" aria-label="Scroll details left" onClick={() => scrollTrack(`details-track-${b.id}`, -1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <div className="az-details-row" id={`details-track-${b.id}`}>
                <div className="az-detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 2h9l3 3v17H6z" /><path d="M14 2v4h4" /></svg>
                  <strong>{b.pages}</strong><span>Pages</span>
                </div>
                <div className="az-detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={12} cy={12} r={9} /><path d="M3 12h18M12 3c2.2 2.4 3.5 5.5 3.5 9s-1.3 6.6-3.5 9c-2.2-2.4-3.5-5.5-3.5-9s1.3-6.6 3.5-9z" /></svg>
                  <strong>English</strong><span>Language</span>
                </div>
                <div className="az-detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 12l-8 8-9-9V4h7l9 9z" /><circle cx={7.5} cy={7.5} r={1.3} fill="currentColor" /></svg>
                  <strong>{b.genre}</strong><span>Genre</span>
                </div>
                <div className="az-detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 3h12v18l-6-4-6 4V3z" /></svg>
                  <strong>{catName(b.category)}</strong><span>Category</span>
                </div>
                <div className="az-detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x={3} y={4} width={18} height={18} rx={2} /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                  <strong>{b.pubDate}</strong><span>Published</span>
                </div>
                <div className="az-detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x={3} y={7} width={18} height={14} rx={2} /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  <strong>Good Child Press</strong><span>Publisher</span>
                </div>
                <div className="az-detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x={4} y={3} width={16} height={18} rx={1} /><path d="M8 3v18M16 3v18" /></svg>
                  <strong>5.5 × 8.5 in</strong><span>Dimensions</span>
                </div>
                <div className="az-detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={12} cy={8} r={5} /><path d="M8 13l-2 8h12l-2-8" /></svg>
                  <strong>{(0.15 + b.pages * 0.01).toFixed(2)} lb</strong><span>Weight</span>
                </div>
              </div>
              <button type="button" className="carousel-arrow carousel-right" aria-label="Scroll details right" onClick={() => scrollTrack(`details-track-${b.id}`, 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="buybox">
          <div className="buybox-tiles">
            <button type="button" className={`buybox-tile ${format === "ebook" ? "active" : ""}`} onClick={() => setFormat("ebook")}>
              <div className="bt-name">eBook</div>
              <div className="bt-price">${b.formats.ebook.toFixed(2)}</div>
              <div className="bt-sub">{b.sizeMB} MB · instant download</div>
            </button>
            <button type="button" className={`buybox-tile ${format === "audiobook" ? "active" : ""}`} onClick={() => setFormat("audiobook")}>
              <div className="bt-name">Audiobook</div>
              <div className="bt-price">${b.formats.audiobook.toFixed(2)}</div>
              <div className="bt-sub">Read-aloud narration</div>
            </button>
            <button type="button" className={`buybox-tile ${format === "paperback" ? "active" : ""}`} onClick={() => setFormat("paperback")}>
              <div className="bt-name">Print: Paperback</div>
              <div className="bt-price">${b.formats.paperback.toFixed(2)}</div>
              <div className="bt-sub">Softcover · via Lulu</div>
            </button>
            <button type="button" className={`buybox-tile ${format === "print" ? "active" : ""}`} onClick={() => setFormat("print")}>
              <div className="bt-name">Print: Hardcover</div>
              <div className="bt-price">${b.formats.print.toFixed(2)}</div>
              <div className="bt-sub">Hardcover · via Lulu</div>
            </button>
          </div>

          {format === "ebook" ? (
            <>
              <div className="buybox-price-row">
                <span className="buybox-discount">-{discountPct}%</span>
                <span className="buybox-price">${b.formats.ebook.toFixed(2)}</span>
              </div>
              <div className="buybox-listprice">List price: <s>${listPrice.toFixed(2)}</s></div>
            </>
          ) : (
            <>
              <div className="buybox-price-row">
                <span className="buybox-price">${b.formats[format].toFixed(2)}</span>
              </div>
              <div className="buybox-listprice">{fmtLabel} edition</div>
            </>
          )}

          <button className="btn btn-primary btn-block" onClick={() => addItem(b.id, 1)}>Add to cart</button>
          {format === "print" || format === "paperback" ? (
            <div className="buybox-note">
              You&apos;re adding the {fmtLabel.toLowerCase()} edition. Need more than one? Adjust the quantity from
              your cart. Print copies are printed and fulfilled by Lulu Publishing, and shipped directly to your
              chosen address.
            </div>
          ) : format === "ebook" ? (
            <div className="buybox-note">
              This eBook is an instant download available from your dashboard, and we&apos;ll also email the
              download link to the address on your account.
            </div>
          ) : (
            <div className="buybox-note">
              This audiobook is an instant download available from your dashboard, and we&apos;ll also email the
              download link to the address on your account.
            </div>
          )}

          <div className="buybox-divider" />
          <button type="button" className="btn btn-ghost btn-block" onClick={() => toggle(b.id)}>
            {inWishlist ? "Remove from Wishlist" : "Add to Wishlist"}
          </button>

          {format === "ebook" || format === "audiobook" ? (
            <div className="buybox-tip">Downloaded materials are for your personal use only. Redistributing or sharing this file is a violation of copyright.</div>
          ) : format === "paperback" ? (
            <div className="buybox-tip">A lighter, budget-friendly softcover edition.</div>
          ) : (
            <div className="buybox-tip">A sturdy, gift-ready hardcover edition.</div>
          )}
        </div>
      </div>

      {featuredBooks.length > 0 && (
        <div className="az-section">
          <div className="section-head"><h2>Featured books</h2></div>
          <div className="carousel-outer carousel-padded">
            <button type="button" className="carousel-arrow carousel-left" aria-label="Scroll featured books left" onClick={() => scrollTrack(`featured-track-${b.id}`, -1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className="book-grid-6" id={`featured-track-${b.id}`}>
              {featuredBooks.map((fb) => <BookCard key={fb.id} book={fb} />)}
            </div>
            <button type="button" className="carousel-arrow carousel-right" aria-label="Scroll featured books right" onClick={() => scrollTrack(`featured-track-${b.id}`, 1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      )}

      {alsoSearchedBooks.length > 0 && (
        <div className="az-section">
          <div className="section-head"><h2>People who read this book also searched for:</h2></div>
          <div className="carousel-outer carousel-padded">
            <button type="button" className="carousel-arrow carousel-left" aria-label="Scroll left" onClick={() => scrollTrack(`moreby-track-${b.id}`, -1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className="book-grid-6" id={`moreby-track-${b.id}`}>
              {alsoSearchedBooks.map((sb) => <BookCard key={sb.id} book={sb} />)}
            </div>
            <button type="button" className="carousel-arrow carousel-right" aria-label="Scroll right" onClick={() => scrollTrack(`moreby-track-${b.id}`, 1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      )}

      <div className="az-section">
        <h2>Reviews</h2>
        <div className="az-reviews-layout">
          <div className="az-reviews-col">
            <div className="az-reviews-head">
              <span className="az-reviews-count-label">{stats.total} ratings</span>
            </div>
            <div className="review-list">
              {reviews.map((r, i) => (
                <div className="review-card" key={i}>
                  <div className="review-header">
                    <div className="review-avatar" style={{ background: b.palette[1] }}>
                      {r.name.split(" ").map((w) => w[0]).join("")}
                    </div>
                    <div className="review-name">{r.name}</div>
                    <span className="review-stars">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    <div className="review-date">{r.date}</div>
                  </div>
                  <p className="review-text">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rb-card">
            <div className="rb-score">
              <div className="big">{stats.avg}</div>
              <div className="stars">★★★★★</div>
              <div className="count">{stats.total} ratings</div>
            </div>
            <div className="rb-bars">
              {[5, 4, 3, 2, 1].map((star, i) => (
                <div className="rb-bar-row" key={star}>
                  <span>{star} star</span>
                  <div className="rb-bar-track"><div className="rb-bar-fill" style={{ width: `${stats.pct[i]}%` }} /></div>
                  <span>{stats.pct[i]}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <LiveReviewSection bookId={b.id} />
      </div>
    </div>
  );
}
