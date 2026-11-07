import { createHash } from "crypto";

/** Everything the picture depends on. If none of this changes, the saved mockup is still correct. */
export interface MockupSpec {
  format: "paperback" | "hardcover";
  title: string;
  author: string;
  description: string;
  /** Lulu trim code such as "0550X0850". */
  trimCode: string;
  pages: number;
  /** Lulu paper code such as "060UW444"; its last three digits are the pages per inch. */
  paperCode: string;
  /** "M" matte or "G" gloss. */
  finish: string;
  /** Linen code (N, G, R, B, T, F or X for none). Hardcover only. */
  linenColor: string;
  /** Foil code (G gold, B black, W white, X none). Hardcover only. */
  foilColor: string;
  foilTitle: string;
  foilAuthor: string;
  /** The author's own full-wrap cover PDF (a stored file id) when they uploaded one; the mockup is made from it. */
  wrapFileId: string | null;
}

export const LINEN_COLORS: Record<string, { name: string; hex: string }> = {
  N: { name: "Navy", hex: "#22345f" },
  G: { name: "Gray", hex: "#80848d" },
  R: { name: "Red", hex: "#9c2230" },
  B: { name: "Black", hex: "#1b1b1f" },
  T: { name: "Tan", hex: "#c9ab7f" },
  F: { name: "Forest", hex: "#214f39" },
};

export function trimInches(trimCode: string): { w: number; h: number } {
  const w = parseInt(trimCode.slice(0, 4), 10) / 100;
  const h = parseInt(trimCode.slice(5, 9), 10) / 100;
  return { w: Number.isFinite(w) && w > 0 ? w : 5.5, h: Number.isFinite(h) && h > 0 ? h : 8.5 };
}

export function pagesPerInch(paperCode: string): number {
  const m = (paperCode || "").match(/(\d{3})$/);
  const n = m ? parseInt(m[1], 10) : 444;
  return n >= 200 && n <= 900 ? n : 444;
}

/** Real size of the book in inches. The hardcover has two boards, so it is thicker and a little larger than the paperback. */
export function bookDimensions(spec: Pick<MockupSpec, "format" | "trimCode" | "pages" | "paperCode">): { w: number; h: number; t: number } {
  const trim = trimInches(spec.trimCode);
  const block = Math.max(8, spec.pages || 32) / pagesPerInch(spec.paperCode);
  if (spec.format === "hardcover") return { w: trim.w + 0.13, h: trim.h + 0.26, t: Math.max(0.3, block + 0.3) };
  return { w: trim.w, h: trim.h, t: Math.max(0.12, block + 0.03) };
}

/** A short code for the settings this picture was made from, so only a changed picture is made again. */
export function mockupHash(spec: MockupSpec, coverKey: string): string {
  return createHash("sha1").update(JSON.stringify({ v: 9, spec, coverKey })).digest("hex").slice(0, 20);
}
