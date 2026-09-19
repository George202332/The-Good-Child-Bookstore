"use client";

import { useEffect, useState } from "react";

/** Good Morning / Afternoon / Evening, based on the visitor's own
 * browser clock — this directly reflects their real local time and
 * timezone (their device already knows this), which is more reliable
 * than trying to infer a timezone from an IP address. Renders nothing
 * until mounted client-side, to avoid a server/client render mismatch
 * (the server has no way to know the visitor's local time at all). */
export function TimeBasedGreeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    // Deliberate: the server has no way to know the visitor's local
    // time/timezone, so this can only be computed client-side after
    // mount — matches the same pattern used in hooks/useCart.ts for
    // syncing other browser-only state.
    const hour = new Date().getHours();
    const g = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate, see comment above
    setGreeting(g);
  }, []);

  if (!greeting) return <div style={{ minWidth: 160, minHeight: 19 }} />;
  return (
    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-soft)", minHeight: 19 }}>
      {greeting}, {name}
    </div>
  );
}
