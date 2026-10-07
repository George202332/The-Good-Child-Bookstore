/** Standard trim sizes, in the stored "W x H in" format. */
export const DIMENSION_OPTIONS: readonly string[] = [
  "5 x 8 in",
  "5.25 x 8 in",
  "5.5 x 8.5 in",
  "5.83 x 8.27 in",
  "6 x 9 in",
  "6.14 x 9.21 in",
  "7 x 10 in",
  "8 x 8 in",
  "8 x 10 in",
  "8.5 x 8.5 in",
  "8.5 x 11 in",
  "8.27 x 11.69 in",
];

export const DEFAULT_DIMENSION = "5.5 x 8.5 in";

export function isKnownDimension(v: string | null | undefined): boolean {
  return !!v && DIMENSION_OPTIONS.includes(v.trim());
}

function parse(v: string): [number, number] | null {
  const m = v.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}

/** The option matching a detected PDF size (within 0.1in on both sides),
 * or undefined when none is close enough. The closest option wins. */
export function nearestDimensionOption(detected: string | undefined | null): string | undefined {
  if (!detected) return undefined;
  const d = parse(detected);
  if (!d) return undefined;
  let best: string | undefined;
  let bestDist = Infinity;
  for (const opt of DIMENSION_OPTIONS) {
    const o = parse(opt);
    if (!o) continue;
    const dw = Math.abs(o[0] - d[0]);
    const dh = Math.abs(o[1] - d[1]);
    if (dw <= 0.1 && dh <= 0.1 && dw + dh < bestDist) {
      best = opt;
      bestDist = dw + dh;
    }
  }
  return best;
}
