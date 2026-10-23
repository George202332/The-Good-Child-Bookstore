import { CATEGORIES, SUBCATEGORIES, canonicalCategory } from "@/lib/taxonomy";

/**
 * For each Category, the subcategories that currently have at least one
 * PUBLISHED book. The Bookshelf's subcategory pop-up lists only these, so an
 * empty subcategory never shows and one appears the moment a book is published
 * in it. `books` is the already-published, visitor-visible catalog (drafts,
 * pending and withdrawn books never reach it).
 */
export function subcategoriesWithBooks(
  books: readonly { series?: string; subcategory?: string }[],
): Record<string, string[]> {
  const present = new Map<string, Set<string>>();
  for (const b of books) {
    const cat = canonicalCategory(b.series);
    const sub = b.subcategory?.trim();
    if (!cat || !sub) continue;
    if (!(SUBCATEGORIES[cat] as readonly string[]).includes(sub)) continue;
    if (!present.has(cat)) present.set(cat, new Set());
    present.get(cat)!.add(sub);
  }
  const out: Record<string, string[]> = {};
  for (const cat of CATEGORIES) {
    const have = present.get(cat);
    // Keep the taxonomy's own order.
    out[cat] = have ? SUBCATEGORIES[cat].filter((s) => have.has(s)) : [];
  }
  return out;
}
