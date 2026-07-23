"use client";

import Link from "next/link";
import { BOOKS } from "@/lib/data/catalog";
import { BookCard } from "@/components/BookCard";
import { useWishlist } from "@/hooks/useWishlist";

/** The original's wishlist view was folded into the reader dashboard nav
 * (href="#/wishlist" pointed at a dedicated page); this is that page,
 * reading the same localStorage-backed wishlist used across the header
 * badge and book cards. */
export default function WishlistPage() {
  const { ids } = useWishlist();
  const books = BOOKS.filter((b) => ids.includes(b.id));

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <h1 style={{ marginBottom: 24 }}>Your wishlist</h1>
      {books.length === 0 ? (
        <div className="empty-state">
          <h3>Nothing saved yet</h3>
          <p>Tap the heart icon on any book to save it here for later.</p>
          <Link href="/shop" className="btn btn-primary" style={{ marginTop: 16 }}>Browse the bookshelf</Link>
        </div>
      ) : (
        <div className="book-grid" aria-label="Wishlist">
          {books.map((b) => <BookCard key={b.id} book={b} />)}
        </div>
      )}
    </div>
  );
}
