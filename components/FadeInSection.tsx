"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";

/** Converted from the `.fade-in-section` IntersectionObserver logic in
 * initHomePageEnhancements() (the-good-child-bookstore_54_1.html:3609-3620). */
export function FadeInSection({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

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
      { threshold: 0.1 }
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
