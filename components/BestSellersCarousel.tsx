"use client";

import { useRef, useState } from "react";
import { BOOKS, type Book } from "@/lib/data/catalog";
import { BookCard } from "./BookCard";

type TabKey = "weekly" | "monthly" | "editors" | "new";

const TABS: { key: TabKey; label: string }[] = [
  { key: "weekly", label: "Weekly best sellers" },
  { key: "monthly", label: "Monthly best sellers" },
  { key: "editors", label: "Editor's picks" },
  { key: "new", label: "New releases" },
];

/** Ported from the `bySeller` object built in homeHTML()
 * (the-good-child-bookstore_54_1.html:3664-3669) — four differently-sorted
 * views of the same catalog, not separate data. */
function booksForTab(tab: TabKey): Book[] {
  switch (tab) {
    case "weekly":
      return BOOKS.slice().sort((a, b) => b.reviews - a.reviews).slice(0, 12);
    case "monthly":
      return BOOKS.slice()
        .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating) || b.reviews - a.reviews)
        .slice(0, 12);
    case "editors":
      return BOOKS.filter((b) => b.featured).slice(0, 12);
    case "new":
      return BOOKS.slice()
        .sort((a, b) => parseInt(b.pubDate.split(" ")[1], 10) - parseInt(a.pubDate.split(" ")[1], 10))
        .slice(0, 12);
  }
}

/** Converted from the "Best sellers & new arrivals" section + switchHomeCarousel()/
 * scrollHomeCarousel() (the-good-child-bookstore_54_1.html:3735-3754). */
export function BestSellersCarousel() {
  const [tab, setTab] = useState<TabKey>("weekly");
  const trackRef = useRef<HTMLDivElement>(null);
  const books = booksForTab(tab);

  function scroll(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

  return (
    <>
      <div className="carousel-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`carousel-tab ${tab === t.key ? "active" : ""}`}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="carousel-track-wrap">
        <button type="button" className="carousel-nav prev" aria-label="Scroll left" onClick={() => scroll(-1)}>
          ‹
        </button>
        <div className="carousel-track" id="home-carousel-track" ref={trackRef}>
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
        <button type="button" className="carousel-nav next" aria-label="Scroll right" onClick={() => scroll(1)}>
          ›
        </button>
      </div>
    </>
  );
}
