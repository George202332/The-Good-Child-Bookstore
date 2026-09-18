import { redirect, notFound } from "next/navigation";
import { BOOKS, bookSlug } from "@/lib/data/catalog";
import { getRealPublishedBookById } from "@/lib/data/real-books-adapter";

/**
 * The old id-based book URL — kept working for any already-shared
 * links, but now just redirects straight to the real, canonical
 * slug-based URL (thegoodchildbookstore.com/{title-slug}) rather than
 * rendering the page twice under two different URLs, which would be
 * duplicate content from a search engine's point of view. Every new
 * link anywhere on the site points at the slug URL directly; this
 * exists only to catch old links still pointing here.
 */
export default async function BookDetailRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const real = await getRealPublishedBookById(id);
  if (real) redirect(`/${bookSlug(real)}`);
  const demo = BOOKS.find((b) => b.id === id);
  if (demo) redirect(`/${bookSlug(demo)}`);
  notFound();
}
