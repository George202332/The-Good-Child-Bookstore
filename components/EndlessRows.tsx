"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ENDLESS_BATCH, hasMore, visibleCount } from "@/lib/endless";

/**
 * Endless scrolling for a table body: shows 10 rows, then 10 more each time the author scrolls the page to the
 * end of the table. No buttons, no inner scrollbar. The footer row keeps a fixed height so the page below
 * (the site footer) does not jump while rows come in.
 *
 * `rows` are ready-made <tr> elements (they may be rendered on the server and passed in).
 * `resetKey` restarts from 10 rows when a filter changes.
 */
export function EndlessTbody({ rows, colSpan, endLabel = "No More Books", resetKey = "" }: { rows: ReactNode[]; colSpan: number; endLabel?: string; resetKey?: string }) {
  const [state, setState] = useState({ key: resetKey, loads: 0, loading: false });
  const loads = state.key === resetKey ? state.loads : 0;
  const shown = visibleCount(rows.length, loads);
  const more = hasMore(rows.length, shown);
  const sentinel = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      io.disconnect();
      setState((s) => ({ key: resetKey, loads: (s.key === resetKey ? s.loads : 0), loading: true }));
      // A short beat so the "Loading" line is seen, then the next batch appears.
      setTimeout(() => setState((s) => ({ key: resetKey, loads: (s.key === resetKey ? s.loads : 0) + 1, loading: false })), 250);
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, shown, resetKey]);

  return (
    <>
      {rows.slice(0, shown)}
      <tr ref={sentinel} aria-live="polite">
        <td colSpan={colSpan} style={{ height: 44, textAlign: "center", color: "var(--ink-faint)", fontSize: 12.5 }}>
          {more ? (state.loading ? "Loading…" : "") : rows.length > ENDLESS_BATCH ? endLabel : ""}
        </td>
      </tr>
    </>
  );
}
