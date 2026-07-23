import { Suspense } from "react";
import { ShopPageClient } from "@/components/ShopPageClient";

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopPageClient />
    </Suspense>
  );
}
