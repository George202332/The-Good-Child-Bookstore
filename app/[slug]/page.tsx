import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BOOKS, bookSlug } from "@/lib/data/catalog";
import { getRealPublishedBookBySlug, getRealPublishedBooks } from "@/lib/data/real-books-adapter";
import { getVisitorCountries } from "@/lib/visitor-country";
import { isRestrictedForCountries } from "@/lib/book-visibility";
import { BookDetailClient } from "../book/[id]/BookDetailClient";
import { after } from "next/server";
import { ensurePrintMockups, getPrintMockupUrls, shouldMakeMockupsNow } from "@/lib/mockup/store";
import { relatedCandidates } from "@/lib/related-candidates";
import { bookMeta } from "@/lib/seo/book-meta";
import { pageMeta } from "@/lib/seo/page-meta";

export const dynamic = "force-dynamic";

/**
 * A book's real, canonical URL — the site address followed by /{title-slug},
 * with no "/book/" segment, per explicit instruction. This is a
 * root-level dynamic route, which only ever matches a path that isn't
 * already claimed by one of the site's real, explicit routes (Next.js
 * always prioritizes an exact static route match over a dynamic one at
 * the same level) — so /shop, /blog, /account, etc. are all completely
 * unaffected by this existing alongside them.
 *
 * /book/[id] still works (kept for any already-shared links), but this
 * is the one every internal link on the site now points to.
 */
async function resolveBookBySlug(slug: string) {
  const real = await getRealPublishedBookBySlug(slug);
  if (real) return { book: real, isRealBook: true };
  const demo = BOOKS.find((b) => bookSlug(b) === slug);
  if (demo) return { book: demo, isRealBook: false };
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveBookBySlug(slug);
  if (!resolved) return { title: "Book not found | The Good Child Bookstore", robots: { index: false, follow: false } };

  const { book } = resolved;

  // A visitor in a country this book is restricted in gets a noindex page
  // (see the page component's restricted state). Crawlers from other
  // countries still see — and may index — the book: country-based hiding
  // from crawlers is best-effort only, and serving Googlebot something
  // different by IP would be cloaking.
  if (isRestrictedForCountries(book.restrictedCountries, await getVisitorCountries())) {
    return {
      title: `${book.title} | The Good Child Bookstore`,
      robots: { index: false, follow: false },
    };
  }

  // Title and description are written from this book's own data (see lib/seo/book-meta.ts): never typed by hand, never generic.
  const fa = book.formatAvailable ?? { ebook: true, paperback: true, hardcover: true, audiobook: true };
  const meta = bookMeta({
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    genre: book.genre,
    category: book.series,
    subcategory: book.subcategory,
    age: book.age,
    formats: [fa.ebook && "eBook", fa.audiobook && "Audiobook", fa.paperback && "Paperback", fa.hardcover && "Hardcover"].filter((f): f is string => !!f),
    blurb: book.blurb,
    hasCover: !!book.coverImage,
  });
  return pageMeta({ title: meta.title, description: meta.description, path: `/${bookSlug(book)}`, image: book.coverImage, type: "book", noindex: meta.thin });
}

export default async function BookBySlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const visitorCountries = await getVisitorCountries();
  const [resolved, realBooks] = await Promise.all([resolveBookBySlug(slug), getRealPublishedBooks(visitorCountries)]);
  if (!resolved) notFound();
  const restricted = isRestrictedForCountries(resolved.book.restrictedCountries, visitorCountries);
  // The saved 3D mockups of the print formats (made when the book was published), looked up by the record that sells each.
  const printMockups = resolved.isRealBook
    ? await getPrintMockupUrls({ paperback: resolved.book.formatBookIds?.paperback ?? resolved.book.id, hardcover: resolved.book.formatBookIds?.hardcover ?? resolved.book.id })
    : {};
  // A print format without a saved picture yet (a book published before mockups existed) gets one made now, in the background;
  // the visitor sees the normal cover until it is ready. Tried at most every ten minutes per book.
  if (resolved.isRealBook) {
    const wanted: [string | undefined, "paperback" | "hardcover"][] = [
      [resolved.book.formatBookIds?.paperback ?? resolved.book.id, "paperback"],
      [resolved.book.formatBookIds?.hardcover ?? resolved.book.id, "hardcover"],
    ];
    // Also covers a picture made with older settings (for example before a font change): ensurePrintMockups keeps a current
    // picture as it is, and redraws only one whose settings code is out of date.
    const wantedIds = new Set(wanted.filter(([id, f]) => id && resolved.book.formatAvailable?.[f]).map(([id]) => id as string));
    for (const id of wantedIds) if (shouldMakeMockupsNow(id)) after(() => ensurePrintMockups(id));
  }
  return (
    <BookDetailClient
      book={resolved.book}
      isRealBook={resolved.isRealBook}
      allBooks={relatedCandidates(resolved.book, [...realBooks, ...BOOKS])}
      restricted={restricted}
      printMockups={printMockups}
    />
  );
}
