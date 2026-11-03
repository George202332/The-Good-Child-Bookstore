/**
 * EAN-13 barcode (the barcode an ISBN-13 is printed as). Pure: turns the digits into the list of black bars.
 * Used for the back cover of the print mockups.
 */

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** The 13 digits of an ISBN (an ISBN-10 is converted by adding 978), or null when it is not a valid ISBN. */
export function isbnDigits13(raw: string | null | undefined): string | null {
  const s = (raw ?? "").replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(s)) return ean13CheckOk(s) ? s : null;
  if (/^\d{9}[\dX]$/.test(s)) {
    const body = "978" + s.slice(0, 9);
    return body + String(ean13Check(body));
  }
  return null;
}

export function ean13Check(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

function ean13CheckOk(d13: string): boolean {
  return ean13Check(d13.slice(0, 12)) === Number(d13[12]);
}

/** The 95 modules of an EAN-13 as a string of 0/1 (1 = black). */
export function ean13Modules(d13: string): string {
  if (!/^\d{13}$/.test(d13)) throw new Error("EAN-13 needs 13 digits");
  const parity = PARITY[Number(d13[0])];
  let out = "101";
  for (let i = 0; i < 6; i++) out += (parity[i] === "L" ? L : G)[Number(d13[i + 1])];
  out += "01010";
  for (let i = 0; i < 6; i++) out += R[Number(d13[i + 7])];
  return out + "101";
}

/** Runs of black modules as { x, w } in module units, ready to draw as rectangles. */
export function ean13Bars(d13: string): { x: number; w: number }[] {
  const m = ean13Modules(d13);
  const bars: { x: number; w: number }[] = [];
  let i = 0;
  while (i < m.length) {
    if (m[i] === "1") {
      let j = i;
      while (j < m.length && m[j] === "1") j++;
      bars.push({ x: i, w: j - i });
      i = j;
    } else i++;
  }
  return bars;
}
