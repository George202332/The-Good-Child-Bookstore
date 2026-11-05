/**
 * The blog's keyword fields live in the existing "seoKeywords" text (no database change): a comma-separated list where the FIRST
 * word or phrase is the focus keyword and the rest are related keywords. Older posts that already hold a plain list keep working:
 * their first entry simply becomes the focus keyword.
 */
export function parseKeywords(raw: string | null | undefined): { focus: string; related: string[] } {
  const parts = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return { focus: parts[0] ?? "", related: parts.slice(1, 6) };
}

export function serializeKeywords(focus: string, related: string[]): string {
  const clean = (s: string) => s.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of [focus, ...related].map(clean).filter(Boolean)) {
    const key = k.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(k); }
  }
  return out.slice(0, 6).join(", ");
}

export function normalizeKeyword(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
