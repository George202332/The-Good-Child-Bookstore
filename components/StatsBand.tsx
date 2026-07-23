"use client";

import { useEffect, useRef, useState } from "react";
import { BOOKS } from "@/lib/data/catalog";

const STATS = [
  { id: "stat-books", target: BOOKS.length, label: "Books published" },
  { id: "stat-authors", target: new Set(BOOKS.map((b) => b.author)).size, label: "Authors" },
  { id: "stat-readers", target: 24000, label: "Readers" },
  { id: "stat-countries", target: 31, label: "Countries served" },
];

/** Converted from the animated stat-counter IntersectionObserver logic in
 * initHomePageEnhancements() (the-good-child-bookstore_54_1.html:3621-3645). */
export function StatsBand() {
  const bandRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<number[]>(STATS.map(() => 0));
  const animated = useRef(false);

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
              setValues(STATS.map((s) => Math.round(s.target * eased)));
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
  }, []);

  return (
    <div className="stats-band" id="home-stats-band" ref={bandRef}>
      {STATS.map((s, i) => (
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
