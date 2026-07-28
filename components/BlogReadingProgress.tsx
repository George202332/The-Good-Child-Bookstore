"use client";

import { useEffect, useState } from "react";

/** Ported from initBlogReadingProgress() (the-good-child-bookstore_54_1
 * .html:6034-6050) — a real scroll-tracked reading progress bar fixed to
 * the top of the viewport, plus a sticky mini-header (showing the post
 * title) that fades in once the reader scrolls past the hero cover. */
export function BlogReadingProgress({ title }: { title: string }) {
  const [progress, setProgress] = useState(0);
  const [showMini, setShowMini] = useState(false);

  useEffect(() => {
    function handleScroll() {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const height = doc.scrollHeight - doc.clientHeight;
      setProgress(height > 0 ? Math.min(100, Math.max(0, (scrollTop / height) * 100)) : 0);
      // Roughly "past the hero cover" — the cover is sized via CSS
      // (clamp(320px, 42vw, 480px)), so 380px is a reasonable universal
      // threshold without needing a fragile ref-measured marker element.
      setShowMini(scrollTop > 380);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <div className="blog-progress-bar" style={{ width: `${progress}%` }} />
      <div className={`blog-mini-header ${showMini ? "visible" : ""}`}>
        <div className="wrap blog-mini-header-inner">
          <span className="blog-mini-title">{title}</span>
          <div className="blog-mini-progress-track"><div className="blog-mini-progress-fill" style={{ width: `${progress}%` }} /></div>
        </div>
      </div>
    </>
  );
}
