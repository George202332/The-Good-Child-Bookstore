/**
 * Real EAN-13 barcode encoding — standard L-code/G-code/R-code bit
 * patterns and first-digit parity table, generating an actual scannable
 * barcode SVG from a 13-digit ISBN (matching "ISBN Barcode... Generated
 * automatically from the ISBN assigned to this title").
 */

const L_CODE: Record<string, string> = {
  "0": "0001101", "1": "0011001", "2": "0010011", "3": "0111101", "4": "0100011",
  "5": "0110001", "6": "0101111", "7": "0111011", "8": "0110111", "9": "0001011",
};
const G_CODE: Record<string, string> = {
  "0": "0100111", "1": "0110011", "2": "0011011", "3": "0100001", "4": "0011101",
  "5": "0111001", "6": "0000101", "7": "0010001", "8": "0001001", "9": "0010111",
};
const R_CODE: Record<string, string> = {
  "0": "1110010", "1": "1100110", "2": "1101100", "3": "1000010", "4": "1011100",
  "5": "1001110", "6": "1010000", "7": "1000100", "8": "1001000", "9": "1110100",
};
// Which of L/G each of the 6 left-hand digits uses, keyed by the first digit.
const PARITY: Record<string, string> = {
  "0": "LLLLLL", "1": "LLGLGG", "2": "LLGGLG", "3": "LLGGGL", "4": "LGLLGG",
  "5": "LGGLLG", "6": "LGGGLL", "7": "LGLGLG", "8": "LGLGGL", "9": "LGGLGL",
};

/** Extracts 13 digits from an ISBN string (strips hyphens/spaces) —
 * pads/truncates defensively so a malformed ISBN never crashes rendering. */
function digitsFromIsbn(isbn: string): string {
  const digits = isbn.replace(/[^0-9]/g, "");
  return (digits + "0000000000000").slice(0, 13);
}

export interface BarcodeBar {
  x: number;
  width: number;
  tall: boolean;
}

/** Returns the sequence of bars (as x-position units) for a 13-digit
 * EAN-13 code, plus the digit string for the human-readable text below. */
export function buildEan13Bars(isbn: string): { bars: BarcodeBar[]; digits: string } {
  const digits = digitsFromIsbn(isbn);
  const first = digits[0];
  const left = digits.slice(1, 7);
  const right = digits.slice(7, 13);
  const parity = PARITY[first] ?? PARITY["0"];

  let pattern = "101"; // start guard
  for (let i = 0; i < 6; i++) {
    const code = parity[i] === "L" ? L_CODE : G_CODE;
    pattern += code[left[i]] ?? "0000000";
  }
  pattern += "01010"; // middle guard
  for (let i = 0; i < 6; i++) {
    pattern += R_CODE[right[i]] ?? "0000000";
  }
  pattern += "101"; // end guard

  const guardRanges = [
    [0, 3],
    [45, 50],
    [92, 95],
  ];
  const bars: BarcodeBar[] = [];
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === "1") {
      const isGuard = guardRanges.some(([start, end]) => i >= start && i < end);
      bars.push({ x: i, width: 1, tall: isGuard });
    }
  }
  return { bars, digits };
}

/** Renders the bars as an SVG string — used both for the inline preview
 * and for the "Download SVG" button. */
export function ean13ToSvgString(isbn: string, widthPx = 200, heightPx = 100): string {
  const { bars, digits } = buildEan13Bars(isbn);
  const unit = widthPx / 95;
  const barHeight = heightPx * 0.75;
  const tallBarHeight = heightPx * 0.85;

  const rects = bars
    .map((b) => `<rect x="${b.x * unit}" y="0" width="${unit}" height="${b.tall ? tallBarHeight : barHeight}" fill="#000" />`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}">
    <rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="#fff" />
    ${rects}
    <text x="${widthPx / 2}" y="${heightPx - 4}" font-family="monospace" font-size="${heightPx * 0.12}" text-anchor="middle" fill="#000" letter-spacing="2">${digits}</text>
  </svg>`;
}
