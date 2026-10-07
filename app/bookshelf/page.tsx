import { Suspense } from "react";
import { ShopPageClient } from "@/components/ShopPageClient";
import { getRealPublishedBooks } from "@/lib/data/real-books-adapter";
import { BOOKS } from "@/lib/data/catalog";
import { getVisitorCountries } from "@/lib/visitor-country";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  // Books restricted in the visitor's country are hidden from the shelf (and
  // therefore from the client-side search over this list). This route was
  // already force-dynamic, so reading the request adds no cacheability cost.
  const realBooks = await getRealPublishedBooks(await getVisitorCountries());
  // Real, published books first, then the demo catalog fills out the
  // rest of the shelf — see lib/data/real-books-adapter.ts.
  const books = [...realBooks, ...BOOKS];

  return (
    <Suspense fallback={null}>
      <ShopPageClient books={books} />
    </Suspense>
  );
}
