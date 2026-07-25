import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BOOKS } from "@/lib/data/catalog";
import { getRealPublishedBookById } from "@/lib/data/real-books-adapter";
import { BookDetailClient } from "./BookDetailClient";

export const dynamic = "force-dynamic";

/**
 * Dynamic per-book metadata — part of the brief's SEO requirement
 * ("dynamic metadata", "Open Graph", "canonical URLs"). Split into a
 * server component (this file, for generateMetadata and resolving the
 * real book from the database) + a client component (BookDetailClient,
 * for the interactive buybox/reviews/wishlist/cart behavior) since
 * generateMetadata isn't available in a "use client" file.
 *
 * Checks real, published books (submitted through the actual author
 * flow) first, falling back to the static demo catalog — previously
 * this page only ever read the static catalog, so a real submitted book
 * had no page here at all once approved.
 */
async function resolveBook(id: string) {
  const real = await getRealPublishedBookById(id);
  if (real) return { book: real, isRealBook: true };
  const demo = BOOKS.find((b) => b.id === id);
  if (demo) return { book: demo, isRealBook: false };
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const resolved = await resolveBook(id);
  if (!resolved) return { title: "Book not found | The Good Child Bookstore" };

  const { book } = resolved;
  const title = `${book.title} by ${book.author} | The Good Child Bookstore`;
  const description = book.blurb;

  return {
    title,
    description,
    alternates: { canonical: `https://thegoodchildbookstore.com/book/${book.id}` },
    openGraph: { title, description, type: "book" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolveBook(id);
  if (!resolved) notFound();
  return <BookDetailClient book={resolved.book} isRealBook={resolved.isRealBook} />;
}
