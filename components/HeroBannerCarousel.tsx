"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface HeroSlide {
  tone: "lavender" | "mint" | "pink";
  icon: React.ReactNode;
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}

const ICONS = {
  welcome: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Z" /></svg>
  ),
  browse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
  ),
  author: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={12} cy={8} r={3.6} /><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" /></svg>
  ),
  affiliate: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 15l6-6" /><path d="M10 6.5h-.5A4.5 4.5 0 0 0 5 11v.5" /><path d="M14 17.5h.5A4.5 4.5 0 0 0 19 13v-.5" /></svg>
  ),
};

export function HeroBannerCarousel({ eyebrow, heading, lede }: { eyebrow: string; heading: string; lede: string }) {
  const slides: HeroSlide[] = [
    { tone: "lavender", icon: ICONS.welcome, title: heading, body: lede, ctaHref: "/shop", ctaLabel: "Browse the bookshelf" },
    { tone: "mint", icon: ICONS.browse, title: "Browse the bookshelf", body: "Picture books, bedtime stories, and middle-grade adventures, curated with parents, teachers, and librarians in mind.", ctaHref: "/shop", ctaLabel: "Browse the bookshelf" },
    { tone: "pink", icon: ICONS.author, title: "Become an author", body: "Publish your own children's book as an eBook, paperback, hardcover, or audiobook — and earn real royalties on every sale.", ctaHref: "/signup/author", ctaLabel: "Become an author" },
    { tone: "lavender", icon: ICONS.affiliate, title: "Become an affiliate", body: "Refer authors, promote books, and earn a lifetime share of the revenue you help bring in — all from one account.", ctaHref: "/signup/author", ctaLabel: "Become an affiliate" },
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  const slide = slides[index];

  return (
    <div style={{ position: "relative" }}>
      {eyebrow && <div className="eyebrow" style={{ marginBottom: 12 }}>{eyebrow}</div>}
      <div className={`promo-banner promo-${slide.tone}`}>
        <div className="promo-banner-text">
          <div className="promo-banner-icon">{slide.icon}</div>
          <div>
            <h3>{slide.title}</h3>
            <p>{slide.body}</p>
          </div>
        </div>
        <Link href={slide.ctaHref} className="btn btn-primary btn-small">
          {slide.ctaLabel}
        </Link>
      </div>

      <button
        type="button"
        aria-label="Previous"
        onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
        style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.7)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => setIndex((i) => (i + 1) % slides.length)}
        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.7)", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 6l6 6-6 6" /></svg>
      </button>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
            style={{ width: 8, height: 8, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", background: i === index ? "var(--coral)" : "var(--line)" }}
          />
        ))}
      </div>
    </div>
  );
}
