import type { Metadata } from "next";
import { BOOKS } from "@/lib/data/catalog";
import { BookDetailClient } from "./BookDetailClient";

/**
 * Dynamic per-book metadata — part of the brief's SEO requirement
 * ("dynamic metadata", "Open Graph", "canonical URLs"). Split into a
 * server component (this file, for generateMetadata) + a client
 * component (BookDetailClient, for the interactive buybox/reviews/
 * wishlist/cart behavior) since generateMetadata isn't available in a
 * "use client" file.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const book = BOOKS.find((b) => b.id === id);
  if (!book) return { title: "Book not found | The Good Child Bookstore" };

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
  return <BookDetailClient id={id} />;
}
