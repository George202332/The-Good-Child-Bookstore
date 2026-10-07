import { CATEGORIES, categoryOfSubcategory, isCategory, type BookCategory } from "./taxonomy";

/** The fields of a book that decide which Category series it belongs to. */
export interface CategoryAttributionInput {
  /** Book.category (NEW column; null for books submitted before it existed). */
  category?: string | null;
  /** Book.subcategory (also new; may be set while category is null). */
  subcategory?: string | null;
  /** Name of the legacy Genre join (e.g. "Adventure", "Fable", "Family Life"). */
  legacySubcategory?: string | null;
}

/**
 * The Category series a book belongs to, or undefined when it cannot be
 * mapped. Order: the real Book.category, then Book.subcategory, then the
 * legacy Genre name, each looked up in lib/taxonomy.ts.
 */
export function attributeCategory(book: CategoryAttributionInput): BookCategory | undefined {
  if (isCategory(book.category)) return book.category;
  return categoryOfSubcategory(book.subcategory?.trim()) ?? categoryOfSubcategory(book.legacySubcategory?.trim());
}

/** Number of books per Category series; every category is present (0 when empty).
 * Books that cannot be attributed count under no category. */
export function countBooksByCategory(books: readonly CategoryAttributionInput[]): Record<BookCategory, number> {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<BookCategory, number>;
  for (const b of books) {
    const c = attributeCategory(b);
    if (c) counts[c] += 1;
  }
  return counts;
}

/** "1 book" / "N books". */
export function bookCountLabel(n: number): string {
  return `${n} ${n === 1 ? "book" : "books"}`;
}
