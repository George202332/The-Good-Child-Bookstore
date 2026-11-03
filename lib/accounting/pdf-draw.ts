import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Scene } from "@/lib/accounting/charts";

/** Shared pdf-lib helpers for the accounting PDFs: fonts, text that never throws, scene drawing, simple tables. */

export const PLUM = rgb(0.20, 0.03, 0.26);
export const INK = rgb(0.13, 0.12, 0.18);
export const SOFT = rgb(0.40, 0.38, 0.46);
export const RULE = rgb(0.85, 0.83, 0.90);
export const TINT = rgb(0.96, 0.94, 0.98);
export const WHITE = rgb(1, 1, 1);

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

export async function newDoc(): Promise<{ doc: PDFDocument; fonts: Fonts }> {
  const doc = await PDFDocument.create();
  const fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  return { doc, fonts };
}

/** Standard PDF fonts only hold Latin-1, so anything else is replaced rather than throwing. */
export function safe(s: string): string {
  return s.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7E -ÿ]/g, "?");
}

export function clip(font: PDFFont, s: string, size: number, maxWidth: number): string {
  let t = safe(s);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) t = t.slice(0, -1);
  return `${t}...`;
}

export function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function polyPath(pts: [number, number][], k: number): string {
  return `M ${pts.map((p) => `${(p[0] * k).toFixed(2)} ${(p[1] * k).toFixed(2)}`).join(" L ")} Z`;
}

/** Draws a chart scene with its top-left at (x, yTop) (PDF coordinates, y up), scaled to `width`. */
export function drawScene(page: PDFPage, fonts: Fonts, scene: Scene, x: number, yTop: number, width: number): number {
  const k = width / scene.width;
  for (const s of scene.shapes) {
    if (s.t === "poly") {
      page.drawSvgPath(polyPath(s.pts, k), { x, y: yTop, color: hexToRgb(s.fill), borderColor: s.stroke ? hexToRgb(s.stroke) : undefined, borderWidth: s.stroke ? 0.4 : 0 });
    } else if (s.t === "path") {
      page.drawSvgPath(scalePath(s.d, k), { x, y: yTop, color: hexToRgb(s.fill), borderColor: s.stroke ? hexToRgb(s.stroke) : undefined, borderWidth: s.stroke ? 0.4 : 0 });
    } else if (s.t === "line") {
      page.drawLine({ start: { x: x + s.x1 * k, y: yTop - s.y1 * k }, end: { x: x + s.x2 * k, y: yTop - s.y2 * k }, thickness: Math.max(0.3, s.w * k), color: s.stroke.length >= 7 ? hexToRgb(s.stroke) : SOFT });
    } else if (s.t === "rect") {
      page.drawRectangle({ x: x + s.x * k, y: yTop - (s.y + s.h) * k, width: s.w * k, height: s.h * k, color: hexToRgb(s.fill) });
    } else {
      const font = s.bold ? fonts.bold : fonts.regular;
      const size = s.size * k;
      const text = safe(s.s);
      const w = font.widthOfTextAtSize(text, size);
      const tx = s.anchor === "start" ? s.x * k : s.anchor === "middle" ? s.x * k - w / 2 : s.x * k - w;
      page.drawText(text, { x: x + tx, y: yTop - s.y * k, size, font, color: s.tone === "ink" ? INK : SOFT });
    }
  }
  return scene.height * k;
}

/** Scales every coordinate in an SVG path made only of M, L, A and Z commands (the only ones the charts use). */
export function scalePath(d: string, k: number): string {
  const tokens = d.trim().split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "M" || t === "L" || t === "Z") {
      out.push(t);
      if (t !== "Z") {
        out.push((Number(tokens[++i]) * k).toFixed(2), (Number(tokens[++i]) * k).toFixed(2));
      }
    } else if (t === "A") {
      out.push("A", (Number(tokens[++i]) * k).toFixed(2), (Number(tokens[++i]) * k).toFixed(2), tokens[++i], tokens[++i], tokens[++i], (Number(tokens[++i]) * k).toFixed(2), (Number(tokens[++i]) * k).toFixed(2));
    } else {
      out.push(t);
    }
  }
  return out.join(" ");
}

export interface Col {
  label: string;
  w: number; // share of the table width
  align?: "left" | "right";
}

/** A simple paginating table. Returns the new y. `onNewPage` must add a page and return its top y. */
export function drawTable(opts: {
  fonts: Fonts;
  getPage: () => PDFPage;
  onNewPage: () => number;
  x: number;
  y: number;
  width: number;
  cols: Col[];
  rows: string[][];
  size?: number;
  rowHeight?: number;
  bottom: number;
  boldLast?: boolean;
}): number {
  const { fonts, x, width, cols, rows, bottom } = opts;
  const size = opts.size ?? 8;
  const rh = opts.rowHeight ?? size + 7;
  let y = opts.y;
  const widths = cols.map((c) => c.w * width);
  const xs = widths.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? x : acc[i - 1] + widths[i - 1]], []);
  const header = () => {
    const page = opts.getPage();
    page.drawRectangle({ x, y: y - rh + 2, width, height: rh, color: PLUM });
    cols.forEach((c, i) => {
      const label = clip(fonts.bold, c.label.toUpperCase(), size - 1.5, widths[i] - 6);
      const tx = c.align === "right" ? xs[i] + widths[i] - 3 - fonts.bold.widthOfTextAtSize(label, size - 1.5) : xs[i] + 3;
      page.drawText(label, { x: tx, y: y - rh + 2 + (rh - (size - 1.5)) / 2 + 0.5, size: size - 1.5, font: fonts.bold, color: WHITE });
    });
    y -= rh;
  };
  header();
  rows.forEach((row, ri) => {
    if (y - rh < bottom) {
      y = opts.onNewPage();
      header();
    }
    const page = opts.getPage();
    const last = opts.boldLast && ri === rows.length - 1;
    if (ri % 2 === 1 || last) page.drawRectangle({ x, y: y - rh + 2, width, height: rh, color: TINT });
    row.forEach((cell, i) => {
      const font = last ? fonts.bold : fonts.regular;
      const text = clip(font, cell, size, widths[i] - 6);
      const tx = cols[i].align === "right" ? xs[i] + widths[i] - 3 - font.widthOfTextAtSize(text, size) : xs[i] + 3;
      page.drawText(text, { x: tx, y: y - rh + 2 + (rh - size) / 2 + 0.5, size, font, color: INK });
    });
    y -= rh;
  });
  return y;
}
