"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Powers item 4(b)/(c) of the Revenue page's "new since you last
 * looked" behavior — see app/account/revenue/page.tsx, which decides
 * WHAT counts as new (comparing real transaction timestamps against
 * User.lastViewedRevenueAt, see actions/revenue-last-viewed.ts) and
 * passes the result down into this purely presentational layer.
 *
 * Two independent pieces, both driven by the same initial "is there
 * anything new" signal from the server, but each with its own
 * stopping rule:
 *
 *   - BlinkStatCard (4b): blinks for exactly 10 seconds, then stops on
 *     its own via a real timer — not a CSS animation with a fixed
 *     iteration count (which would drift from "seconds" the moment
 *     the animation's own duration ever changed) and not something
 *     that depends on the user doing anything.
 *   - RevenueHighlightProvider + useRevenueHighlightActive (4c): stays
 *     on until the user clicks ANYWHERE on the page (a real
 *     document-level click listener, not a timeout), then turns off
 *     for every highlighted row at once, everywhere on the page, since
 *     they all read the same shared context value.
 *
 * Both start from server-computed state (whether there's anything new
 * at all, per category) rather than client-only guesswork, and both
 * are one-shot for this page view: once a card's 10 seconds are up, or
 * once the page has been clicked once, that's it until the next real
 * visit (which recomputes against the freshly-bumped
 * lastViewedRevenueAt and starts clean).
 */

const RevenueHighlightContext = createContext(false);

export function RevenueHighlightProvider({ hasNew, children }: { hasNew: boolean; children: ReactNode }) {
  const [active, setActive] = useState(hasNew);

  useEffect(() => {
    if (!active) return;
    function onClickAnywhere() {
      setActive(false);
    }
    // Capture phase so this fires even if some inner element stops
    // propagation for its own click handling — the spec is "the FIRST
    // click anywhere on the page," full stop, not "the first click
    // that happens to bubble all the way up."
    document.addEventListener("click", onClickAnywhere, { capture: true });
    return () => document.removeEventListener("click", onClickAnywhere, { capture: true });
  }, [active]);

  return <RevenueHighlightContext.Provider value={active}>{children}</RevenueHighlightContext.Provider>;
}

/** Whether a row this page marked "new" should still render as
 * highlighted right now — false once the page has been clicked once
 * (see RevenueHighlightProvider), or if the page had nothing new to
 * begin with. */
export function useRevenueHighlightActive(): boolean {
  return useContext(RevenueHighlightContext);
}

export function BlinkStatCard({ blink, className, children }: { blink: boolean; className?: string; children: ReactNode }) {
  const [blinking, setBlinking] = useState(blink);

  // Deliberately only depends on the initial `blink` flag, not on
  // anything else — this timer is meant to start once, when the page
  // first decides this card has something new, and run to completion
  // exactly once per visit.
  useEffect(() => {
    if (!blink) return;
    const timer = setTimeout(() => setBlinking(false), 10_000);
    return () => clearTimeout(timer);
  }, [blink]);

  return <div className={`${className ?? ""}${blinking ? " stat-card-blink" : ""}`}>{children}</div>;
}
