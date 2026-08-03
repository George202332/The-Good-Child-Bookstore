"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GetLinkButton } from "./GetLinkButton";

export interface BrowsableBook {
  id: string;
  sn: string;
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
const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid var(--line)" };

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
        <div className="no-scrollbar" style={{ maxHeight: ROW_HEIGHT * VISIBLE_ROWS, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: "var(--paper)", zIndex: 1 }}>
              <tr>
                <th style={TABLE_HEAD_STYLE}>SN</th>
                <th style={TABLE_HEAD_STYLE}>Title</th>
                <th style={TABLE_HEAD_STYLE}>Author</th>
                <th style={TABLE_HEAD_STYLE}>Category</th>
                <th style={TABLE_HEAD_STYLE}>Genre</th>
                <th style={TABLE_HEAD_STYLE}>Price</th>
                <th style={TABLE_HEAD_STYLE}>View</th>
                <th style={TABLE_HEAD_STYLE}>Get Link</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => (
                <tr key={b.id}>
                  <td style={TABLE_CELL_STYLE}>{b.sn}</td>
                  <td style={TABLE_CELL_STYLE}><strong>{b.title}</strong></td>
                  <td style={TABLE_CELL_STYLE}>{b.author}</td>
                  <td style={TABLE_CELL_STYLE}>{b.category}</td>
                  <td style={TABLE_CELL_STYLE}>{b.genre}</td>
                  <td style={TABLE_CELL_STYLE}>${b.price.toFixed(2)}</td>
                  <td style={TABLE_CELL_STYLE}><Link href={`/book/${b.id}`} target="_blank" className="btn btn-ghost btn-small">View</Link></td>
                  <td style={TABLE_CELL_STYLE}><GetLinkButton bookId={b.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
