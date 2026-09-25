import { Suspense } from "react";
import { ShopPageClient } from "@/components/ShopPageClient";
import { getRealPublishedBooks } from "@/lib/data/real-books-adapter";
import { BOOKS } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const realBooks = await getRealPublishedBooks();
  // Real, published books first, then the demo catalog fills out the
  // rest of the shelf — see lib/data/real-books-adapter.ts.
  const books = [...realBooks, ...BOOKS];

  return (
    <Suspense fallback={null}>
      <ShopPageClient books={books} />
    </Suspense>
  );
}
