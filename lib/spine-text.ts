/**
 * Where the writing goes on a book's spine. One plan, used by the print cover PDF sent to Lulu, by the on-screen cover
 * preview and by the 3D mockups, so all three show the same thing.
 *
 *   - A book under SPINE_TEXT_MIN_PAGES pages, or a spine thinner than SPINE_TEXT_MIN_IN, carries no writing at all.
 *   - Otherwise the author's name sits at the top end and the title toward the bottom end, reading top to bottom (the front
 *     cover facing right, the spine on the left). Both lines are centred across the WIDTH of the spine.
 *   - The first letter of the author's name is 5 millimetres from the top edge of the spine and the last letter of the title is
 *     5 millimetres from the bottom edge.
 *   - The letter size is fixed (a fifth of an inch, or half the spine width on a slimmer spine). If the two lines do not fit
 *     between the 5 millimetre gaps, both shrink together (down to SPINE_MIN_SHRINK); if that is still not enough the title is
 *     shortened with "..." and `notice` says so, so the author is told. Nothing ever runs past an edge.
 *
 * Pure: it works in whatever unit the caller uses (PDF points, SVG units, pixels) and measures text with the function it is given.
 */

export const SPINE_TEXT_MIN_IN = 0.21;
/**
 * The fewest pages a book may have for any writing on its spine. Lulu's own spine guidance (help.lulu.com, "spine text") says
 * books under 100 pages must have a plain spine, so 100 is the real figure. To allow 80 instead, change this one number.
 */
export const SPINE_TEXT_MIN_PAGES = 100;
/** Gap from the top edge to the first letter, and from the last letter to the bottom edge. */
export const SPINE_EDGE_GAP_MM = 5;
/** The smallest the two lines may shrink to (70% of the normal size) before the title is shortened instead. */
export const SPINE_MIN_SHRINK = 0.7;
/** Half the height of a capital letter in Times New Roman / Tinos (0.662 of the text size, halved): the letters' tops point toward the front cover, so the baseline sits this far BEFORE (toward the back cover from) the middle of the spine and the capitals are centred across it. */
export const SPINE_CENTRE_K = 0.331;
/** The least room kept between the author's name and the title along the spine. */
const MIN_LINE_GAP_IN = 0.15;

export interface SpineLine { text: string; size: number; /** Distance from the top of the spine to where this line starts, in the caller's unit. */ start: number }
export interface SpinePlan {
  lines: SpineLine[];
  /** 1 when the letters are at their normal size, less when they were made smaller to fit. */
  shrink: number;
  /** The title had to be shortened with "..." because even the smallest size did not fit. */
  truncated: boolean;
  /** A plain-words note for the author when anything was shrunk or shortened, otherwise null. */
  notice: string | null;
}

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
  /** The book's page count. Below SPINE_TEXT_MIN_PAGES the spine stays plain. Left out, only the width rule applies. */
  pages?: number;
  /** Width of the text at that size, in the caller's unit. */
  width: (text: string, size: number) => number;
}): SpinePlan | null {
  const upi = opts.unitsPerInch;
  if (opts.pages != null && opts.pages < SPINE_TEXT_MIN_PAGES) return null;
  if (!(opts.spine >= SPINE_TEXT_MIN_IN * upi)) return null;
  const titleText = spineSafe(opts.title);
  if (!titleText) return null;
  const authorText = spineSafe(opts.author);

  const edge = (SPINE_EDGE_GAP_MM / 25.4) * upi;
  const room = opts.length - 2 * edge;
  if (!(room > 0)) return null;
  const lineGap = MIN_LINE_GAP_IN * upi;

  const size0 = Math.min(0.2 * upi, opts.spine * 0.5);
  const authorRatio = 0.8;

  const needAt = (k: number): number =>
    opts.width(titleText, size0 * k) + (authorText ? opts.width(authorText, size0 * authorRatio * k) + lineGap : 0);

  // 1. Shrink both lines together, a little at a time, until they fit between the two gaps (never below the minimum).
  let k = 1;
  while (needAt(k) > room && k > SPINE_MIN_SHRINK) k = Math.max(SPINE_MIN_SHRINK, k - 0.02);

  let title = titleText;
  let author = authorText;
  let truncated = false;
  const cut = (text: string, size: number, max: number): string => {
    if (opts.width(text, size) <= max) return text;
    let t = text;
    while (t.length > 1 && opts.width(`${t}...`, size) > max) t = t.slice(0, -1).trimEnd();
    return `${t}...`;
  };

  // 2. Still too long at the smallest size: keep the author's name (up to a third of the spine) and shorten the title.
  if (needAt(k) > room) {
    if (author) author = cut(author, size0 * authorRatio * k, room * 0.34);
    const used = author ? opts.width(author, size0 * authorRatio * k) + lineGap : 0;
    title = cut(titleText, size0 * k, Math.max(room - used, room * 0.3));
    truncated = title !== titleText;
  }

  const titleSize = size0 * k;
  const authorSize = size0 * authorRatio * k;
  const lines: SpineLine[] = [];
  if (author) lines.push({ text: author, size: authorSize, start: edge });
  // The title's last letter ends exactly one gap above the bottom edge.
  lines.push({ text: title, size: titleSize, start: opts.length - edge - opts.width(title, titleSize) });

  const shrunk = k < 0.999;
  const notice = truncated
    ? "Your title is too long for this spine, even at the smallest size, so it is shortened with ... on the spine. A shorter title or a thicker book (more pages) fits better."
    : shrunk
      ? `Your title and author name are ${Math.round((1 - k) * 100)}% smaller on the spine so that they fit.`
      : null;
  return { lines, shrink: k, truncated, notice };
}
