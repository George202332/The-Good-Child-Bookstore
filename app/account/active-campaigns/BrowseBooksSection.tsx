"use client";

import { useMemo, useState } from "react";
import { GetLinkButton } from "./GetLinkButton";

export interface BrowsableBook {
  id: string;
  title: string;
  author: string;
  price: number;
  category: string;
  genre: string;
  pubDate: string;
}

type SortMode = "latest" | "category" | "genre";

const ROW_HEIGHT = 52;
const VISIBLE_ROWS = 10;

/** Only books not already on promotion are ever passed in here — once
 * an affiliate generates a link for one (see GetLinkButton), the parent
 * page's router.refresh() re-fetches and that book naturally moves out
 * of this list and into the "Books on Promotion" table instead. */
export function BrowseBooksSection({ books }: { books: BrowsableBook[] }) {
  const [sortMode, setSortMode] = useState<SortMode>("latest");

  const sorted = useMemo(() => {
    const copy = [...books];
    if (sortMode === "latest") copy.sort((a, b) => (a.pubDate < b.pubDate ? 1 : -1));
    else if (sortMode === "category") copy.sort((a, b) => a.category.localeCompare(b.category));
    else copy.sort((a, b) => a.genre.localeCompare(b.genre));
    return copy;
  }, [books, sortMode]);

  return (
    <div className="map-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>Browse all books</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className={`view-tab ${sortMode === "category" ? "active" : ""}`} onClick={() => setSortMode("category")}>Category</button>
          <button type="button" className={`view-tab ${sortMode === "genre" ? "active" : ""}`} onClick={() => setSortMode("genre")}>Genre</button>
          <button type="button" className={`view-tab ${sortMode === "latest" ? "active" : ""}`} onClick={() => setSortMode("latest")}>Latest Published</button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          Every promotable book already has your link — check Books on Promotion below.
        </div>
      ) : (
        <div
          className="no-scrollbar"
          style={{ maxHeight: ROW_HEIGHT * VISIBLE_ROWS, overflowY: "auto" }}
        >
          {sorted.map((b) => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: ROW_HEIGHT, borderBottom: "1px solid var(--line)", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  by {b.author} · {b.category} · {b.genre} · ${b.price.toFixed(2)}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <GetLinkButton bookId={b.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
