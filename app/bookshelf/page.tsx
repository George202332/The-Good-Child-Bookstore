import { RULES, rateLimitByIp } from "@/lib/rate-limit";
import { parseShopFilters, filteredSortedBooks, SHOP_PAGE_SIZE } from "@/lib/shop-filters";
import { subcategoriesWithBooks } from "@/lib/subcategory-availability";
import { ShopPageClient } from "@/components/ShopPageClient";
import { getRealPublishedBooks } from "@/lib/data/real-books-adapter";
import { BOOKS } from "@/lib/data/catalog";
import { getVisitorCountries } from "@/lib/visitor-country";
import { pageMeta } from "@/lib/seo/page-meta";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  // Search results and filtered shelves are not pages to index; they point at the clean bookshelf address.
  const filtered = Object.keys(sp).length > 0;
  return pageMeta({
    title: "Bookshelf: Children's Books by Age, Genre and Category",
    description: "Browse the whole bookshelf of children's books from independent authors: picture books, bedtime stories, early readers, middle grade and activity books.",
    path: "/bookshelf",
    noindex: filtered,
  });
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The filters in the address bar are read here on the server and handed down,
  // so the shelf is part of the very first page the server sends instead of
  // waiting for the browser to read the address bar and fill in afterwards.
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => query.append(k, x));
    else if (typeof v === "string") query.append(k, v);
  }
  // Books restricted in the visitor's country are hidden from the shelf (and
  // therefore from the client-side search over this list). This route was
  // already force-dynamic, so reading the request adds no cacheability cost.
  // Search is limited per visitor (60 a minute); past that the shelf shows without the search words instead of failing.
  if (query.has("q") && !(await rateLimitByIp(RULES.search)).ok) query.delete("q");
  const realBooks = await getRealPublishedBooks(await getVisitorCountries());
  // Real, published books first, then the demo catalog fills out the
  // rest of the shelf — see lib/data/real-books-adapter.ts.
  const books = [...realBooks, ...BOOKS];

  // Search, filter, sort and page are done here, so a catalog of thousands of books never travels to the browser.
  const filters = parseShopFilters(query);
  const list = filteredSortedBooks(filters, books);
  const totalPages = Math.max(1, Math.ceil(list.length / SHOP_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const pageBooks = list.slice((page - 1) * SHOP_PAGE_SIZE, page * SHOP_PAGE_SIZE);

  return (
    <ShopPageClient pageBooks={pageBooks} total={list.length} availableSubs={subcategoriesWithBooks(books)} query={query.toString()} />
  );
}
