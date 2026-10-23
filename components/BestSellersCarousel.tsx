import type { Book } from "@/lib/data/catalog";
import { BookCard } from "./BookCard";

/**
 * Best Sellers: a plain grid of the (up to) 12 books chosen by
 * lib/home-books.ts pickBestSellers — ranked by confirmed paid sales and topped
 * up with other published books so the two rows of six are always full. The
 * choice is made on the server; this just draws it. No rotation, no scrolling.
 */
export function BestSellersCarousel({ books }: { books: Book[] }) {
  return (
    <div className="book-grid-12">
      {books.map((b) => (
        <BookCard key={b.id} book={b} />
      ))}
    </div>
  );
}
