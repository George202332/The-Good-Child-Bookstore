"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fiveStarBooks, type Book } from "@/lib/data/catalog";

/**
 * Converted from heroShelfSvg() / bookCoverSvg() / shelfBooksForThisHour()
 * (the-good-child-bookstore_54_1.html:1957-2049). Four overlapping flat
 * book covers, upright (no spine/3D), each showing its real title/author/
 * rating, drawn only from real 5-star books, rotating on the hour.
 */

function currentHourBucket(): number {
  return Math.floor(Date.now() / 3600000);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = (seed >>> 0) || 1;
  function rnd() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shelfBooksForThisHour(count: number): Book[] {
  const pool = fiveStarBooks();
  if (!pool.length) return [];
  const shuffled = seededShuffle(pool, currentHourBucket());
  const picked: Book[] = [];
  for (let i = 0; i < count; i++) picked.push(shuffled[i % shuffled.length]);
  return picked;
}

function wrapTitleLines(title: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = title.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
    if (test.length > maxCharsPerLine && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > maxCharsPerLine - 1 ? last.slice(0, maxCharsPerLine - 1) + "…" : last + "…";
  }
  return lines;
}

function BookCover({ bw, bh, textW, book }: { bw: number; bh: number; textW: number; book: Book }) {
  const [fill, edge] = book.palette;
  const fontSize = 14.5;
  const pad = 10;
  const maxCharsPerLine = Math.max(6, Math.floor((textW - pad * 2) / (fontSize * 0.52)));
  const lines = wrapTitleLines(book.title, maxCharsPerLine, 5);
  const lineHeight = fontSize + 5;
  const titleBlockH = lines.length * lineHeight;
  const titleStartY = bh * 0.44 - titleBlockH / 2 + fontSize * 0.8;
  const authorMax = Math.max(6, Math.floor((textW - pad * 2) / (11 * 0.52)));
  const author = book.author.length > authorMax ? book.author.slice(0, authorMax - 1) + "…" : book.author;
  const tx = pad;

  return (
    <>
      <rect x={0} y={0} width={bw} height={bh} rx={8} fill={fill} stroke={edge} strokeWidth={2} />
      <rect x={6} y={6} width={bw - 12} height={bh - 12} rx={5} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      <rect x={0} y={0} width={bw} height={bh * 0.16} rx={8} fill="rgba(255,255,255,0.22)" />
      <text x={tx} y={titleStartY} textAnchor="start" fontFamily="Georgia,'Times New Roman',serif" fontWeight={700} fontSize={fontSize} fill="#3B2E2E">
        {lines.map((l, i) => (
          <tspan key={i} x={tx} dy={i === 0 ? 0 : lineHeight}>
            {l}
          </tspan>
        ))}
      </text>
      <text x={tx} y={titleStartY + titleBlockH + 14} textAnchor="start" fontFamily="Georgia,'Times New Roman',serif" fontStyle="italic" fontSize={11} fill="rgba(59,46,46,0.75)">
        {author}
      </text>
      <text x={tx} y={bh - 16} textAnchor="start" fontSize={12.5} fill="#3B2E2E" letterSpacing={1.5}>
        {"★".repeat(Math.round(parseFloat(book.rating)))}
      </text>
    </>
  );
}

export function HeroShelf() {
  const [hourBucket, setHourBucket] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHourBucket(currentHourBucket());
    const interval = setInterval(() => {
      const now = currentHourBucket();
      setHourBucket((prev) => (prev !== now ? now : prev));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Render nothing on the server / before mount rather than guessing the
  // hour bucket, to avoid a hydration mismatch.
  if (hourBucket === null) return <div style={{ width: 680, height: 360 }} />;

  const books = shelfBooksForThisHour(4);
  const W = 680, H = 360, bw = 190, bh = 320, startX = 20, startY = 20, stepX = 150;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Four 5-star rated children's books, covers fanned out">
      {books.map((b, i) => {
        const cx = startX + i * stepX;
        const textW = i === books.length - 1 ? bw : stepX;
        return (
          <Link key={b.id} href={`/book/${b.id}`} className="hero-book" style={{ "--book-order": i } as React.CSSProperties}>
            <title>{b.title} — {b.rating}★</title>
            <g transform={`translate(${cx},${startY})`}>
              <BookCover bw={bw} bh={bh} textW={textW} book={b} />
            </g>
          </Link>
        );
      })}
    </svg>
  );
}
