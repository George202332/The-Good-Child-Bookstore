import { Suspense } from "react";
import { ShopPageClient } from "@/components/ShopPageClient";
import { getPagesContent } from "@/actions/page-content";
import { getRealPublishedBooks } from "@/lib/data/real-books-adapter";
import { BOOKS } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const [{ shop }, realBooks] = await Promise.all([getPagesContent(), getRealPublishedBooks()]);
  // Real, published books first, then the demo catalog fills out the
  // rest of the shelf — see lib/data/real-books-adapter.ts.
  const books = [...realBooks, ...BOOKS];

  return (
    <Suspense fallback={null}>
      <ShopPageClient eyebrow={shop.eyebrow} heading={shop.heading} introText={shop.introText} books={books} />
    </Suspense>
  );
}
