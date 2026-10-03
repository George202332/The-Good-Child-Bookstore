"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Re-runs every live check on this page by asking Next.js to
 * re-render the server component — no separate API route needed since
 * every check here is already cheap enough to run on page load. */
export function RefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-ghost btn-small"
      disabled={refreshing}
      onClick={() => {
        setRefreshing(true);
        router.refresh();
        setTimeout(() => setRefreshing(false), 600);
      }}
    >
      {refreshing ? "Refreshing…" : "Refresh checks"}
    </button>
  );
}
