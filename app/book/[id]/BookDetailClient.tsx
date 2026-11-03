"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATS, bookSlug, type Book } from "@/lib/data/catalog";
import { getRotatingBatch } from "@/lib/rotating-batch";
import { reviewStats, reviewsForBook } from "@/lib/data/reviews";
import { BookCard } from "@/components/BookCard";
import { AffiliateClickTracker } from "@/components/AffiliateClickTracker";
import { LiveReviewSection } from "@/components/LiveReviewSection";
import { FollowAuthorButton } from "@/components/FollowAuthorButton";
import { ReadSampleViewer } from "@/components/ReadSampleViewer";
import { bookJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { categorySlug, isCategory } from "@/lib/taxonomy";
import { restrictionMessage } from "@/lib/book-country-restriction";

/** Genre shelf name for a shelf id; "" for the "unknown" shelf. */
function catName(id: string): string {
  return CATS.find((c) => c.id === id)?.name ?? "";
}

/** Renamed from "Weight" (which showed a made-up pounds figure that was
 * never a real property of a digital book) to "File Size" — the actual
 * size of the uploaded manuscript file, auto-detected at upload time
 * (see actions/files.ts / EbookSubmissionForm.tsx). Falls back to a
 * rough estimate from page count only for older books submitted before
 * this was captured. */
function formatFileSize(fileSizeKB: number | undefined, pages: number): string {
  const kb = fileSizeKB ?? 120 + pages * 18;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${Math.round(kb)} KB`;
}

/**
 * Scroll arrows for a horizontal strip, shown only when the strip does not fit and only on the side that can still
 * scroll. Re-checked live: when the window is resized, when the content changes size (a long value, another format)
 * and while scrolling.
 */
function useScrollArrows(trackId: string, watch: unknown) {
  const [arrows, setArrows] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = document.getElementById(trackId);
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = max > 1 ? { left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 } : { left: false, right: false };
    setArrows((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  }, [trackId]);
  useEffect(() => {
    const el = document.getElementById(trackId);
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      // The first callback fires straight after observe(), which does the initial measurement.
      ro = new ResizeObserver(measure);
      ro.observe(el);
      Array.from(el.children).forEach((c) => ro?.observe(c));
    }
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [trackId, measure, watch]);
  return arrows;
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
export function BookDetailClient({ book, isRealBook, allBooks, restricted = false, printMockups = {} }: { book: Book; isRealBook: boolean; allBooks: Book[]; restricted?: boolean; printMockups?: { paperback?: string; hardcover?: string } }) {
  const b = book;
  const [chosenFormat, setFormat] = useState<FormatKey | null>(null);
  const { addItem } = useCart();
  const router = useRouter();
  const { has, toggle } = useWishlist();
  const detailsArrows = useScrollArrows(`details-track-${b?.id}`, `${chosenFormat}|${b?.pubDate}|${b?.publisher}|${b?.series}`);

  if (!b) {
    return (
      <div className="wrap" style={{ padding: "80px 0" }}>
        <h2>We couldn&apos;t find that book.</h2>
        <Link href="/bookshelf" className="btn btn-primary" style={{ marginTop: 20 }}>
          Back to the Bookshelf
        </Link>
      </div>
    );
  }

  // "Featured books" — a placeholder for now, per explicit instruction:
  // the 6 most recently published books (real + demo catalog combined),
  // rotating in the same way the homepage's "New Arrivals" does as the
  // catalog grows, rather than a fixed static list. This is meant to be
  // swapped for a highest-rated ranking once the premium system exists.
  const featuredPool = allBooks
    .filter((x) => x.id !== b.id)
    .sort((x, y) => (x.pubDate < y.pubDate ? 1 : -1));
  const featuredBooks = getRotatingBatch(featuredPool, 6, 20 * 60 * 1000);

  // "People who read this book also searched for" — genuine matches
  // only (same category or genre), real + demo combined, capped at a
  // row of 6. No filler backfill: when there's nothing that actually
  // matches, the section renders nothing (see the `.length > 0` guard
  // below) rather than padding the row with unrelated books.
  const alsoSearchedBooks = allBooks
    .filter(
      (x) =>
        x.id !== b.id &&
        ((!!b.series && x.series === b.series) ||
          (!!b.subcategory && x.subcategory === b.subcategory) ||
          (b.category !== "unknown" && x.category === b.category))
    )
    .slice(0, 6);

  const availableFormats = b.formatAvailable ?? { ebook: true, paperback: true, hardcover: true, audiobook: true };
  const isFormatAvailable: Record<FormatKey, boolean> = {
    ebook: availableFormats.ebook, audiobook: availableFormats.audiobook, paperback: availableFormats.paperback, print: availableFormats.hardcover,
  };
  // Until the visitor picks a format, show the highest-priority one on sale:
  // eBook, then audiobook, then paperback, then hardcover.
  const effectiveFormat: FormatKey =
    chosenFormat && isFormatAvailable[chosenFormat]
      ? chosenFormat
      : ((["ebook", "audiobook", "paperback", "print"] as FormatKey[]).find((f) => isFormatAvailable[f]) ?? "ebook");
  const format = effectiveFormat;

  // An audiobook-only title has no manuscript: no sample to read, and no
  // page count / trim size / file size to show.
  // Which record sells the selected format (one product page can be backed by several
  // editions), and that format's own identifier.
  const cartFormat = effectiveFormat === "print" ? "hardcover" : effectiveFormat;
  const cartBookId = b.formatBookIds?.[cartFormat] ?? b.id;
  const formatIdentifier = b.identifiers?.[cartFormat];
  const identifierText = formatIdentifier
    ? formatIdentifier.value
      ? `${formatIdentifier.label} ${formatIdentifier.value}`
      : `${formatIdentifier.label} pending`
    : b.isbn
      ? `ISBN ${b.isbn}`
      : "";
  const showPrintDetails = (effectiveFormat === "print" || effectiveFormat === "paperback") && b.printPages !== undefined;
  const shownPages = showPrintDetails ? (b.printPages as number) : b.pages;
  const shownDimensions = showPrintDetails && b.printDimensions ? b.printDimensions : b.dimensions;
  const audiobookOnly = isFormatAvailable.audiobook && !isFormatAvailable.ebook && !isFormatAvailable.paperback && !isFormatAvailable.print;

  const initials = b.author.split(" ").map((w) => w[0]).join("").slice(0, 2);
  const fmtLabel = FORMAT_LABELS[effectiveFormat];
  const selectedPrice = b.formats[effectiveFormat];
  // A mockup shows only after the visitor has chosen Paperback or Hardcover themselves, and only that format's own picture.
  const mockupSrc = chosenFormat === "paperback" && effectiveFormat === "paperback"
    ? printMockups.paperback
    : chosenFormat === "print" && effectiveFormat === "print"
      ? printMockups.hardcover
      : undefined;
  const stats = isRealBook
    ? { counts: [0, 0, 0, 0, 0], total: b.reviews, avg: b.rating, pct: [0, 0, 0, 0, 0] }
    : reviewStats(b, []);
  const reviews = isRealBook ? [] : reviewsForBook(b, []);
  const inWishlist = has(b.id);
  const scrollTrack = (id: string, dir: 1 | -1) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollBy({ left: Math.max(220, el.clientWidth * 0.8) * dir, behavior: "smooth" });
  };

  const siteUrl = getPublicSiteUrl();
  const jsonLd = bookJsonLd({
    title: b.title,
    authorName: b.author,
    authorId: b.authorId,
    isbn: b.isbn,
    genre: [b.genre, b.subcategory].filter(Boolean).join(", ") || undefined,
    ageRange: b.age,
    price: isFormatAvailable.ebook ? b.formats.ebook : b.price,
    ratingValue: b.rating,
    reviewCount: b.reviews,
    imageUrl: b.coverImage,
    // One offer per format actually on sale (eBook, Audiobook, Paperback,
    // Hardcover), so the audiobook price is declared next to the eBook's.
    offers: (
      [
        isFormatAvailable.ebook && { name: "eBook", price: b.formats.ebook },
        isFormatAvailable.audiobook && { name: "Audiobook", price: b.formats.audiobook },
        isFormatAvailable.paperback && { name: "Paperback", price: b.formats.paperback },
        isFormatAvailable.print && { name: "Hardcover", price: b.formats.print },
      ] as ({ name: string; price: number } | false)[]
    ).filter((o): o is { name: string; price: number } => !!o),
  });
  const shelfName = catName(b.category);
  const seriesHref = b.series && isCategory(b.series) ? `/bookshelf?series=${categorySlug(b.series)}` : null;
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Home", url: `${siteUrl}/` },
    { name: "Bookshelf", url: `${siteUrl}/bookshelf` },
    ...(b.series && seriesHref ? [{ name: b.series, url: `${siteUrl}${seriesHref}` }] : []),
    { name: b.title, url: `${siteUrl}/${bookSlug(b)}` },
  ]);

  return (
    <div className="wrap detail-wrap">
      {/* A restricted visitor gets no Product/offer markup at all. */}
      {!restricted && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <Suspense fallback={null}>
        <AffiliateClickTracker />
      </Suspense>
      <div className="breadcrumb">
        <Link href="/">Home</Link> › <Link href="/bookshelf">Bookshelf</Link> ›{" "}
        {b.series && seriesHref && (<><Link href={seriesHref}>{b.series}</Link> › </>)}
        {b.title}
      </div>
      <div className="az-grid">
        <div className="az-left">
          <div className="detail-cover-wrap">
            {mockupSrc ? (
              // A 3D mockup of the printed book, only while the Paperback or Hardcover card is chosen. The matching format's
              // picture only: Paperback never shows the hardcover's, and the other formats show the normal cover.
              <div className="detail-cover detail-cover-mockup">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={mockupSrc} src={mockupSrc} alt={`${b.title} ${fmtLabel.toLowerCase()} edition, shown as printed copies`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            ) : (
            <div className="detail-cover">
              {b.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.coverImage}
                  alt={b.coverAltText || `${b.title} cover`}
                  style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", display: "block" }}
                />
              )}
            </div>
            )}
          </div>
          <div className="az-sample-btns">
            {!audiobookOnly && <ReadSampleViewer manuscriptUrl={b.manuscriptUrl} title={b.title} />}
          </div>
          <div className="az-author-card">
            <div className="az-author-card-label">About the Author</div>
            <div className="az-author-row">
              <div className="quote-avatar" style={{ background: b.palette[1] }}>{initials}</div>
              {b.authorId ? (
                <Link href={`/authors/profile/${b.authorId}?name=${encodeURIComponent(b.author)}`} className="az-author-name">
                  {b.author}
                </Link>
              ) : (
                <div className="az-author-name">{b.author}</div>
              )}
              <FollowAuthorButton bookId={b.id} />
            </div>
          </div>
        </div>

        <div className="detail-info">
          <div className="detail-cat-tag">{b.series || shelfName || ""}</div>
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
          {identifierText && <div className="detail-isbn">{identifierText}</div>}
          <div className="detail-tags">
            <span className="age-pill">Ages {b.age} years</span>
            {/* Genre, Category and (only when the book has one) Subcategory: each its own coloured tab, like the age pill.
                The Subcategory lives only on this line; the details strip keeps its compact Category card. */}
            {b.genre?.trim() && <span className="age-pill tag-genre">{b.genre.trim()}</span>}
            {b.series?.trim() && <span className="age-pill tag-category">{b.series.trim()}</span>}
            {b.subcategory?.trim() && <span className="age-pill tag-subcategory">{b.subcategory.trim()}</span>}
          </div>

          {b.descriptionHtml ? (
            // Cleaned when saved and again when read (lib/description-html.ts): only normal formatting reaches this point.
            <div className="az-desc rich-description" dangerouslySetInnerHTML={{ __html: b.descriptionHtml }} />
          ) : (
            <div className="az-desc">
              <p>{b.blurb}</p>
            </div>
          )}

          {/* Only rendered when the author actually provided one — no
             "no statement provided" fallback — and sits above the
             details card now (it used to be below), per explicit
             request. Keeping it inline here, ahead of the
             margin-top:auto details card, is also what keeps that card
             (and the author card / buybox it lines up with) pinned to
             the bottom of this column again — seeing this paragraph
             land *after* the card in the previous round is what pushed
             everything out of alignment. */}
          {b.aiDeclaration?.trim() && (
            <p className="az-ai-declaration">
              <strong>AI use declaration:</strong> {b.aiDeclaration.trim()}
            </p>
          )}

          <div className="az-details-card">
            <div className="carousel-outer">
              {detailsArrows.left && (
                <button type="button" className="carousel-arrow carousel-left" aria-label="Scroll details left" onClick={() => scrollTrack(`details-track-${b.id}`, -1)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
                </button>
              )}
              <div className="az-details-row" id={`details-track-${b.id}`}>
                {!audiobookOnly && (!isRealBook || shownPages > 0) && (
                  <div className="az-detail-item">
                    <strong>{shownPages}</strong><span>Pages</span>
                  </div>
                )}
                <div className="az-detail-item">
                  <strong>{b.language || "English"}</strong><span>Language</span>
                </div>
                {b.series && (
                  <div className="az-detail-item az-detail-item-wide">
                    <strong title={b.series}>{b.series}</strong><span>Category</span>
                  </div>
                )}
                <div className="az-detail-item az-detail-item-wide">
                  <strong>{b.pubDate}</strong><span>Published</span>
                </div>
                {(!isRealBook || b.publisher) && (
                <div className="az-detail-item az-detail-item-wide">
                  <strong>{b.publisher || "Good Child Press"}</strong><span>Publisher</span>
                </div>
                )}
                {!audiobookOnly && (
                  <>
                    {(!isRealBook || shownDimensions) && (
                    <div className="az-detail-item">
                      <strong>{shownDimensions || "5.5 × 8.5 in"}</strong><span>Dimensions</span>
                    </div>
                    )}
                    {(!isRealBook || b.fileSizeKB) && (
                    <div className="az-detail-item">
                      <strong>{formatFileSize(b.fileSizeKB, b.pages)}</strong><span>File Size</span>
                    </div>
                    )}
                  </>
                )}
              </div>
              {detailsArrows.right && (
                <button type="button" className="carousel-arrow carousel-right" aria-label="Scroll details right" onClick={() => scrollTrack(`details-track-${b.id}`, 1)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="buybox">
          <div className="buybox-tiles">
            {([
              { key: "ebook", id: "ebook", name: "eBook", price: b.formats.ebook, sub: "Instant Download", on: b.formatAvailable?.ebook ?? true },
              { key: "audiobook", id: "audiobook", name: "Audiobook", price: b.formats.audiobook, sub: "Instant Download", on: b.formatAvailable?.audiobook ?? true },
              { key: "paperback", id: "paperback", name: "Paperback", price: b.formats.paperback, sub: "Fulfilled by Lulu", on: b.formatAvailable?.paperback ?? true },
              { key: "print", id: "hardcover", name: "Hardcover", price: b.formats.print, sub: "Fulfilled by Lulu", on: b.formatAvailable?.hardcover ?? true },
            ] as { key: FormatKey; id: "ebook" | "audiobook" | "paperback" | "hardcover"; name: string; price: number; sub: string; on: boolean }[])
              .filter((f) => f.on)
              .map((f) => (
                <button key={f.key} type="button" className={`buybox-tile ${format === f.key ? "active" : ""}`} aria-pressed={format === f.key} onClick={() => setFormat(f.key)}>
                  <div className="bt-name">{f.name}</div>
                  <div className="bt-price">${f.price.toFixed(2)}</div>
                  <div className={`bt-sub ${f.sub.startsWith("Fulfilled") ? "bt-fulfilled" : ""}`}>{f.sub}</div>
                </button>
              ))}
          </div>

          {restricted && (
            <div className="buybox-note" role="alert" style={{ marginBottom: 10, fontWeight: 600 }}>{restrictionMessage}</div>
          )}
          <div className="buybox-selected" aria-live="polite">
            Selected: <strong>{fmtLabel}</strong> <span>${selectedPrice.toFixed(2)}</span>
          </div>
          <button className="btn btn-primary btn-block btn-compact" disabled={restricted} title={restricted ? restrictionMessage : undefined} onClick={() => addItem(cartBookId, cartFormat, 1)}>Add {fmtLabel} to Cart</button>
          <button
            className="btn btn-ghost btn-block btn-compact"
            style={{ marginTop: 8 }}
            disabled={restricted}
            title={restricted ? restrictionMessage : undefined}
            onClick={() => router.push(`/checkout?directBookId=${cartBookId}&directFormat=${cartFormat}`)}
          >
            Buy {fmtLabel} Direct
          </button>
          {effectiveFormat === "print" || effectiveFormat === "paperback" ? (
            <div className="buybox-note">
              You&apos;re adding the {fmtLabel.toLowerCase()} edition. Need more than one? Adjust the quantity from
              your cart. Print copies are printed and fulfilled by Lulu Publishing, and shipped directly to your
              chosen address.
            </div>
          ) : effectiveFormat === "ebook" ? (
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
          <button type="button" className="btn btn-ghost btn-block btn-compact" onClick={() => toggle(b.id)}>
            {inWishlist ? "Remove from Wishlist" : "Add to Wishlist"}
          </button>

          {effectiveFormat === "ebook" || effectiveFormat === "audiobook" ? (
            <div className="buybox-tip">Downloaded materials are for your personal use only. Redistributing or sharing this file is a violation of copyright.</div>
          ) : effectiveFormat === "paperback" ? (
            <div className="buybox-tip">A lighter, budget-friendly softcover edition.</div>
          ) : (
            <div className="buybox-tip">A sturdy, gift-ready hardcover edition.</div>
          )}
        </div>
      </div>

      {featuredBooks.length > 0 && (
        <div className="az-section">
          <div className="section-head"><h2>Featured Books</h2></div>
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
          <div className="section-head"><h2>People Who Read This Book Also Searched For:</h2></div>
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
            {isRealBook ? (
              // Real books have no seeded/demo reviews to fall back on, so
              // there's nothing to show here except the actual reviews
              // readers have written — LiveReviewSection itself renders
              // nothing at all once there are zero reviews and no one's
              // signed in to write the first one (see that component),
              // so the very first real review lands in exactly this spot,
              // directly under the "Reviews" heading, with each one after
              // it flowing downward in order — never a placeholder "0
              // ratings" line sitting here first.
              <LiveReviewSection bookId={b.id} />
            ) : (
              <>
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
              </>
            )}
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
        {/* Demo catalog books keep their original placement — a standalone
            write-a-review CTA below the whole two-column layout. Real
            books instead render LiveReviewSection up in the left column
            above (see isRealBook branch), so it isn't duplicated here. */}
        {!isRealBook && <LiveReviewSection bookId={b.id} />}
      </div>
    </div>
  );
}
