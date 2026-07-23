/** Ported from hashStr() (the-good-child-bookstore_54_1.html:2606). Simple
 * deterministic string hash used for seeded/derived demo values (discounts,
 * palette picks, etc.) so the same input always produces the same output. */
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}
