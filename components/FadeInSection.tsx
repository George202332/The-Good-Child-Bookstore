"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";

/** Converted from the `.fade-in-section` IntersectionObserver logic in
 * initHomePageEnhancements() (the-good-child-bookstore_54_1.html:3609-3620). */
export function FadeInSection({ children, style, initiallyVisible = false }: { children: ReactNode; style?: CSSProperties; /** For sections near the top of the page: shown in the first paint instead of fading in after the script loads. */ initiallyVisible?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(initiallyVisible);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            io.unobserve(entry.target);
          }
        });
      },
      // Start the fade a little BEFORE the section scrolls into view, so it is already shown on arrival.
      { threshold: 0, rootMargin: "0px 0px 160px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className={`section fade-in-section ${visible ? "visible" : ""}`} style={style}>
      {children}
    </section>
  );
}
