import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BOOKS, bookSlug } from "@/lib/data/catalog";
import { getRealPublishedBookBySlug, getRealPublishedBooks } from "@/lib/data/real-books-adapter";
import { getVisitorCountries } from "@/lib/visitor-country";
import { isRestrictedForCountries } from "@/lib/book-visibility";
import { BookDetailClient } from "../book/[id]/BookDetailClient";

export const dynamic = "force-dynamic";

/**
 * A book's real, canonical URL — thegoodchildbookstore.com/{title-slug},
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
  if (!resolved) return { title: "Book not found | The Good Child Bookstore" };

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

  const title = `${book.title} by ${book.author} | The Good Child Bookstore`;
  const description = book.blurb;

  return {
    title,
    description,
    alternates: { canonical: `https://thegoodchildbookstore.com/${bookSlug(book)}` },
    openGraph: { title, description, type: "book" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BookBySlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const visitorCountries = await getVisitorCountries();
  const [resolved, realBooks] = await Promise.all([resolveBookBySlug(slug), getRealPublishedBooks(visitorCountries)]);
  if (!resolved) notFound();
  const restricted = isRestrictedForCountries(resolved.book.restrictedCountries, visitorCountries);
  return (
    <BookDetailClient
      book={resolved.book}
      isRealBook={resolved.isRealBook}
      allBooks={[...realBooks, ...BOOKS]}
      restricted={restricted}
    />
  );
}
