"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-checks the page every few seconds (for up to about two minutes) so a customer who returns from the payment page before the
 * confirmation arrives sees "Confirming your payment" and is then moved to the confirmation without pressing anything. */
export function AutoRefresh({ everyMs = 4000, maxTimes = 30 }: { everyMs?: number; maxTimes?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= maxTimes) clearInterval(id);
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, maxTimes]);
  return null;
}
