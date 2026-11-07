/**
 * The writing on the back cover of a print book: the book's description, justified (both edges straight), filling the safe
 * area from the left margin to the right margin, never past it. One layout is used by the print cover PDF sent to Lulu, the
 * on-screen cover preview and the 3D mockups, so all three show the same thing.
 *
 * Pure: works in whatever unit the caller uses and measures text with the function it is given.
 */

/** The back cover comfortably holds about this many words. */
export const BACK_DESCRIPTION_MAX_WORDS = 170;
/** Text size, in inches (10% larger than the earlier 0.115 in). */
export const BACK_TEXT_SIZE_IN = 0.1265;
/** The text may shrink only slightly (to 88%) to make a long description fit. */
export const BACK_TEXT_MIN_FACTOR = 0.88;

export function backWords(text: string | undefined | null): string[] {
  return (text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

export function backWordCount(text: string | undefined | null): number {
  return backWords(text).length;
}

/** Words beyond what the back cover holds (0 when it fits). */
export function backWordsOver(text: string | undefined | null): number {
  return Math.max(0, backWordCount(text) - BACK_DESCRIPTION_MAX_WORDS);
}

export interface BackLine { words: { text: string; x: number }[]; /** Distance of this line's baseline from the top of the box. */ baseline: number }
export interface BackLayout { size: number; lineHeight: number; lines: BackLine[]; wordCount: number; over: number; truncated: boolean }

export function layoutBackDescription(opts: {
  text: string;
  boxW: number;
  boxH: number;
  unitsPerInch: number;
  /** Width of the text at that size, in the caller's unit. */
  width: (text: string, size: number) => number;
}): BackLayout {
  const words = backWords(opts.text);
  const base = BACK_TEXT_SIZE_IN * opts.unitsPerInch;
  const min = base * BACK_TEXT_MIN_FACTOR;
  const wordCount = words.length;
  const over = Math.max(0, wordCount - BACK_DESCRIPTION_MAX_WORDS);

  const wrapAt = (size: number): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    for (const w of words) {
      const next = [...row, w];
      if (row.length > 0 && opts.width(next.join(" "), size) > opts.boxW) { rows.push(row); row = [w]; } else row = next;
    }
    if (row.length) rows.push(row);
    return rows;
  };

  let size = base;
  let rows = wrapAt(size);
  const fits = (r: string[][], s: number) => r.length * s * 1.3 <= opts.boxH;
  while (!fits(rows, size) && size > min) {
    size = Math.max(min, size - base * 0.02);
    rows = wrapAt(size);
  }
  const lineHeight = size * 1.3;
  const maxRows = Math.max(1, Math.floor(opts.boxH / lineHeight));
  let truncated = false;
  if (rows.length > maxRows) {
    rows = rows.slice(0, maxRows);
    const last = rows[rows.length - 1];
    last[last.length - 1] = last[last.length - 1].replace(/[\s.,;:!?-]*$/, "") + "…";
    truncated = true;
  }

  const lines: BackLine[] = rows.map((row, i) => {
    const natural = row.reduce((s, w) => s + opts.width(w, size), 0);
    const justify = i < rows.length - 1 && row.length > 1;
    const gap = justify ? Math.max(0, (opts.boxW - natural) / (row.length - 1)) : opts.width(" ", size);
    let x = 0;
    const placed = row.map((w) => {
      const p = { text: w, x };
      x += opts.width(w, size) + gap;
      return p;
    });
    return { words: placed, baseline: size + i * lineHeight };
  });
  return { size, lineHeight, lines, wordCount, over, truncated };
}
