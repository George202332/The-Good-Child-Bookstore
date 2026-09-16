"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Renders nothing — just calls router.refresh() on an interval, which
 * re-runs this page's Server Component data fetching without a full
 * reload or losing scroll position. Used on pages where "live" data
 * (like Recent Activity) matters even if the user just leaves the tab
 * open. */
export function LiveRefresher({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
