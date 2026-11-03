/**
 * Where the writing goes on a book's spine. One plan, used by the print cover PDF sent to Lulu, by the on-screen cover
 * preview and by the 3D mockups, so all three show the same thing.
 *
 *   - A spine thinner than SPINE_TEXT_MIN_IN (about a third of an inch) carries no writing at all.
 *   - Otherwise the author's name sits at the top and the title below it, both reading top to bottom (the front cover
 *     facing right, the spine on the left).
 *
 * Pure: it works in whatever unit the caller uses (PDF points, SVG units, pixels) and measures text with the function it is given.
 */

export const SPINE_TEXT_MIN_IN = 0.32;

export interface SpineLine { text: string; size: number; /** Distance from the top of the spine to where this line starts, in the caller's unit. */ start: number }
export interface SpinePlan { lines: SpineLine[] }

/** Printable characters only: the PDF fonts and the mockup outlines share one safe set. */
export function spineSafe(text: string | undefined | null): string {
  return (text ?? "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

export function planSpineText(opts: {
  /** Spine thickness and the height of the spine, in the caller's unit. */
  spine: number;
  length: number;
  /** How many of the caller's units make one inch. */
  unitsPerInch: number;
  title: string;
  author?: string;
  /** Width of the text at that size, in the caller's unit. */
  width: (text: string, size: number) => number;
}): SpinePlan | null {
  const upi = opts.unitsPerInch;
  if (!(opts.spine >= SPINE_TEXT_MIN_IN * upi)) return null;
  const titleText = spineSafe(opts.title);
  if (!titleText) return null;
  const authorText = spineSafe(opts.author);

  const size = Math.min(0.2 * upi, opts.spine * 0.5);
  const authorSize = size * 0.8;
  const top = 0.5 * upi;
  const gap = 0.36 * upi;
  const room = opts.length - 2 * top;

  const fit = (text: string, sz: number, max: number): string => {
    if (opts.width(text, sz) <= max) return text;
    let t = text;
    while (t.length > 3 && opts.width(`${t}...`, sz) > max) t = t.slice(0, -1).trimEnd();
    return `${t}...`;
  };

  const lines: SpineLine[] = [];
  let cursor = top;
  if (authorText) {
    const a = fit(authorText, authorSize, room * 0.34);
    lines.push({ text: a, size: authorSize, start: cursor });
    cursor += opts.width(a, authorSize) + gap;
  }
  lines.push({ text: fit(titleText, size, Math.max(room - (cursor - top), room * 0.3)), size, start: cursor });
  return { lines };
}
