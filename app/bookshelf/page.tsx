import { ShopPageClient } from "@/components/ShopPageClient";
import { getRealPublishedBooks } from "@/lib/data/real-books-adapter";
import { BOOKS } from "@/lib/data/catalog";
import { getVisitorCountries } from "@/lib/visitor-country";

export const dynamic = "force-dynamic";

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
  const realBooks = await getRealPublishedBooks(await getVisitorCountries());
  // Real, published books first, then the demo catalog fills out the
  // rest of the shelf — see lib/data/real-books-adapter.ts.
  const books = [...realBooks, ...BOOKS];

  return (
    <ShopPageClient books={books} query={query.toString()} />
  );
}
