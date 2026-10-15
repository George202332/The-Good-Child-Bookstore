/**
 * Works out a book's Lulu trim size from the page size of its uploaded
 * print-ready interior PDF, so the author never has to pick it by hand and
 * the size sent to Lulu always matches the file. (Lulu rejects an interior
 * whose page size does not match the trim size in the package code: the
 * "printable_normalization → interior → Book Size" error.)
 *
 * A trim code such as 0550X0850 means 5.50 x 8.50 inches. Lulu accepts an
 * interior either at exactly the trim size, or with 0.125 in of bleed on
 * the outside edge (width + 0.125) and 0.125 in at top and bottom
 * (height + 0.25). Both are recognised.
 */

export interface TrimOption { label: string; code: string }

export function trimCodeToInches(code: string): { w: number; h: number } | null {
  const m = code.match(/^(\d{4})X(\d{4})$/);
  return m ? { w: parseInt(m[1], 10) / 100, h: parseInt(m[2], 10) / 100 } : null;
}

export interface DetectedTrim {
  code: string;
  label: string;
  /** True when the pages are the trim size plus bleed. */
  withBleed: boolean;
}

const TOLERANCE_IN = 0.04;
export const BLEED_WIDTH_IN = 0.125;
export const BLEED_HEIGHT_IN = 0.25;

export function detectTrimFromPageSize(widthIn: number, heightIn: number, options: readonly TrimOption[]): DetectedTrim | null {
  if (!Number.isFinite(widthIn) || !Number.isFinite(heightIn) || widthIn <= 0 || heightIn <= 0) return null;
  let best: (DetectedTrim & { dist: number }) | null = null;
  for (const opt of options) {
    const t = trimCodeToInches(opt.code);
    if (!t) continue;
    for (const withBleed of [false, true]) {
      const w = t.w + (withBleed ? BLEED_WIDTH_IN : 0);
      const h = t.h + (withBleed ? BLEED_HEIGHT_IN : 0);
      const dw = Math.abs(widthIn - w);
      const dh = Math.abs(heightIn - h);
      if (dw <= TOLERANCE_IN && dh <= TOLERANCE_IN) {
        const dist = dw + dh;
        if (!best || dist < best.dist) best = { code: opt.code, label: opt.label, withBleed, dist };
      }
    }
  }
  return best ? { code: best.code, label: best.label, withBleed: best.withBleed } : null;
}

export function formatInches(widthIn: number, heightIn: number): string {
  const f = (n: number) => String(Math.round(n * 100) / 100);
  return `${f(widthIn)} x ${f(heightIn)} in`;
}
