"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A slim bar across the top that starts the moment any link inside the account area is clicked and finishes when the next
 * page has arrived, so nobody wonders whether the click registered. It only listens to clicks; it changes nothing.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const last = useRef(pathname);

  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      stop();
      setVisible(true);
      setWidth(12);
      // Creeps forward quickly, then slows, and never reaches the end until the page really arrives.
      timer.current = setInterval(() => setWidth((w) => (w < 85 ? w + (90 - w) * 0.12 : w)), 120);
    }
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); stop(); };
  }, []);

  useEffect(() => {
    if (pathname === last.current) return;
    last.current = pathname;
    stop();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- finishing the bar when the new page arrives
    setWidth(100);
    const t = setTimeout(() => { setVisible(false); setWidth(0); }, 260);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div className="nav-progress" aria-hidden="true" style={{ opacity: visible ? 1 : 0 }}>
      <i style={{ width: `${width}%` }} />
    </div>
  );
}
