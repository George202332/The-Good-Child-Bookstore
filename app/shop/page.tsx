import { Suspense } from "react";
import { ShopPageClient } from "@/components/ShopPageClient";
import { getPagesContent } from "@/actions/page-content";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const { shop } = await getPagesContent();
  return (
    <Suspense fallback={null}>
      <ShopPageClient eyebrow={shop.eyebrow} heading={shop.heading} introText={shop.introText} />
    </Suspense>
  );
}
