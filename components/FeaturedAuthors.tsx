import Link from "next/link";
import { PALETTES, getCatalogFallbackAuthors, CATS } from "@/lib/data/catalog";

const FEATURED_AUTHORS_COUNT = 6;

function catName(id: string): string {
  return CATS.find((c) => c.id === id)?.name ?? id;
}

/**
 * Converted from the "Featured authors" section of homeHTML()
 * (the-good-child-bookstore_54_1.html:3853-3891) and
 * getFeaturedAuthorsForHomepage() (line 3431). Only the catalog-derived
 * fallback half of the original ranking engine is wired up so far — real
 * qualifying author accounts (5+ published books, 4.0+ rating, a real
 * profile photo) should be ranked ahead of this pool once Author accounts
 * exist in the database; see the note on getCatalogFallbackAuthors().
 */
export function FeaturedAuthors() {
  const authors = getCatalogFallbackAuthors().slice(0, FEATURED_AUTHORS_COUNT);

  return (
    <div className="featured-author-grid">
      {authors.map((a) => {
        const palette = PALETTES[a.seed % PALETTES.length];
        const initials = a.verifiedName
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        const authorKey = "cat:" + encodeURIComponent(a.verifiedName);
        return (
          <Link key={a.verifiedName} href={`/authors/${authorKey}`} className="featured-author-card">
            <div className="author-avatar" style={{ background: palette[0] }}>
              {initials}
            </div>
            <h4>{a.verifiedName}</h4>
            <p className="author-bio">
              Writes {catName(a.sampleBook.category).toLowerCase()} known for gentle pacing and a strong sense of place.
            </p>
            <div className="author-stat">
              {a.bookCount} book{a.bookCount === 1 ? "" : "s"} · {a.avgRating.toFixed(1)}★ · {a.totalReviews} reviews
            </div>
          </Link>
        );
      })}
    </div>
  );
}
