import { BOOKS, type Book } from "@/lib/data/catalog";
import { BookCard } from "./BookCard";
import { getRotatingBatch } from "@/lib/rotating-batch";

const BATCH_SIZE = 12;
const ROTATE_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Best Sellers — a single plain grid now (no tabs, no carousel/arrows,
 * per explicit instruction), sorted by review count. If there are more
 * candidates than fit in one batch, which batch shows rotates
 * automatically every 20 minutes rather than requiring anyone to
 * scroll — the grid itself never scrolls or exceeds the page's normal
 * margins.
 */
export function BestSellersCarousel({ extraBooks = [] }: { extraBooks?: Book[] }) {
  const allSorted = [...extraBooks, ...BOOKS].sort((a, b) => b.reviews - a.reviews);
  const books = getRotatingBatch(allSorted, BATCH_SIZE, ROTATE_MS);

  return (
    <div className="book-grid-12">
      {books.map((b) => (
        <BookCard key={b.id} book={b} />
      ))}
    </div>
  );
}
