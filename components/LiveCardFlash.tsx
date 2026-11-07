"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Makes a dashboard card flash the moment its own number changes, without a page refresh.
 *
 * The pages re-fetch their figures in the background (LiveRefresher), so a new sale or payout changes the numbers
 * already on screen. This watches every stat card on the page: when a card's figure changes while its heading is
 * the same, that card (and only that card) flashes for ten seconds. Because a sale adds to BOTH the current-month
 * card and the all-time card, both change and both flash. A month card that now shows a different month, or a card
 * whose number did not move, does not flash. It only adds and removes a CSS class; it never changes what a card says.
 */
export const CARD_FLASH_MS = 10_000;

export function LiveCardFlash() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector("main.dashboard-content") ?? document.body;
    const seen = new Map<number, { label: string; value: string }>();
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();

    function scan(first: boolean) {
      root.querySelectorAll<HTMLElement>(".stat-card").forEach((card, i) => {
        const label = (card.querySelector(".stat-label")?.textContent ?? "").replace(/\s+/g, " ").trim();
        const value = (card.querySelector(".stat-value")?.textContent ?? "").replace(/\s+/g, " ").trim();
        const before = seen.get(i);
        seen.set(i, { label, value });
        if (first || !before || before.label !== label || before.value === value) return;
        card.classList.add("stat-card-blink");
        const old = timers.get(card);
        if (old) clearTimeout(old);
        timers.set(card, setTimeout(() => { card.classList.remove("stat-card-blink"); timers.delete(card); }, CARD_FLASH_MS));
      });
    }

    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => scan(false));
    });
    // Take the starting figures a moment after the page appears, then watch for changes.
    const start = setTimeout(() => { scan(true); observer.observe(root, { childList: true, characterData: true, subtree: true }); }, 300);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(frame);
      observer.disconnect();
      timers.forEach((t, el) => { clearTimeout(t); el.classList.remove("stat-card-blink"); });
    };
  }, [pathname]);

  return null;
}
