"use client";

import { useEffect, useRef, useState } from "react";
import type { PlatformStats } from "@/lib/platform-stats";

/** Converted from the animated stat-counter IntersectionObserver logic in
 * initHomePageEnhancements() (the-good-child-bookstore_54_1.html:3621-3645).
 *
 * Takes the real, live platform totals as props (see
 * lib/platform-stats.ts) instead of deriving them from the static demo
 * catalog — this band is only ever rendered at all once every launch
 * threshold has actually been met (see app/page.tsx). The page re-fetches
 * these numbers on an interval (see LiveRefresher in app/page.tsx), so
 * `stats` can change under this component while it's mounted: the count-
 * up animation only plays once, the first time the band scrolls into
 * view; after that, a fresh `stats` prop just updates the numbers shown
 * directly, so the band stays live without replaying the animation. */
export function StatsBand({ stats }: { stats: PlatformStats }) {
  const bandRef = useRef<HTMLDivElement>(null);
  const items = [
    { id: "stat-books", target: stats.books, label: "Books published" },
    { id: "stat-authors", target: stats.authors, label: "Authors" },
    { id: "stat-readers", target: stats.readers, label: "Readers" },
    { id: "stat-countries", target: stats.countries, label: "Countries served" },
  ];
  const targets = items.map((s) => s.target);
  const [values, setValues] = useState<number[]>(targets.map(() => 0));
  const animated = useRef(false);

  // One-time reveal animation, the first time the band scrolls into view.
  useEffect(() => {
    const band = bandRef.current;
    if (!band || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !animated.current) {
            animated.current = true;
            const duration = 1200;
            const start = performance.now();
            function tick(now: number) {
              const t = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - t, 3);
              setValues(targets.map((target) => Math.round(target * eased)));
              if (t < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
            io.unobserve(band);
          }
        });
      },
      { threshold: 0.3 }
    );
    io.observe(band);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately mount-only: this sets up the one-time reveal observer, not a per-render effect.
  }, []);

  // Once already revealed, a later live refresh just snaps the shown
  // values to the new real totals — no need to replay the count-up.
  useEffect(() => {
    if (animated.current) setValues(targets);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `targets` is a new array every render; comparing by its primitive values below keeps this from looping.
  }, [stats.books, stats.authors, stats.readers, stats.countries]);

  return (
    <div className="stats-band" id="home-stats-band" ref={bandRef}>
      {items.map((s, i) => (
        <div key={s.id}>
          <div className="stat-num" id={s.id}>
            {values[i].toLocaleString()}
          </div>
          <div className="stat-lbl">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
