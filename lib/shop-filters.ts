import { BOOKS, PRICE_RANGES, type Book } from "@/lib/data/catalog";

/**
 * Converted from filters/filteredSortedBooks() (the-good-child-bookstore_54_1.html:
 * 2269, 4019-4047). The original kept a single mutable module-level `filters`
 * object; here the URL's own search params ARE the filter state (?cat=,
 * ?genre=, ?age=, ?price=, ?format=, ?rating=, ?q=, ?sort=, ?page=), which is
 * the idiomatic Next.js equivalent — shareable/bookmarkable links, no
 * client-only mutable state to keep in sync. Same filtering/sorting rules,
 * same result set.
 */
export interface ShopFilters {
  cats: Set<string>;
  genres: Set<string>;
  ages: Set<string>;
  priceRanges: Set<string>;
  formats: Set<string>;
  minRatings: Set<string>;
  search: string;
  sort: string;
  page: number;
}

export function parseShopFilters(params: URLSearchParams): ShopFilters {
  return {
    cats: new Set(params.getAll("cat")),
    genres: new Set(params.getAll("genre")),
    ages: new Set(params.getAll("age")),
    priceRanges: new Set(params.getAll("price")),
    formats: new Set(params.getAll("format")),
    minRatings: new Set(params.getAll("rating")),
    search: params.get("q")?.trim() ?? "",
    sort: params.get("sort") ?? "featured",
    page: Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1),
  };
}

export function filteredSortedBooks(filters: ShopFilters): Book[] {
  let list = BOOKS.filter((b) => {
    if (filters.cats.size && !filters.cats.has(b.category)) return false;
    if (filters.genres.size && !filters.genres.has(b.genre)) return false;
    if (filters.ages.size && !filters.ages.has(b.age)) return false;
    if (filters.formats.size && !filters.formats.has(b.format)) return false;
    if (filters.minRatings.size) {
      const minReq = Math.max(...Array.from(filters.minRatings).map(Number));
      if (parseFloat(b.rating) < minReq) return false;
    }
    if (filters.priceRanges.size) {
      const inRange = Array.from(filters.priceRanges).some((id) => {
        const r = PRICE_RANGES.find((x) => x.id === id);
        return r && b.price >= r.min && b.price <= r.max;
      });
      if (!inRange) return false;
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!b.title.toLowerCase().includes(s) && !b.author.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  list = list.slice();
  if (filters.sort === "price-asc") list.sort((a, b) => a.price - b.price);
  else if (filters.sort === "price-desc") list.sort((a, b) => b.price - a.price);
  else if (filters.sort === "title") list.sort((a, b) => a.title.localeCompare(b.title));
  else list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

  return list;
}

export const SHOP_PAGE_SIZE = 25;
