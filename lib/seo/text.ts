/** Small, pure text helpers shared by the page, book and blog SEO code. */

export function squash(text: string | null | undefined): string {
  return (text ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** Cuts at a word boundary and adds an ellipsis only when something was cut. */
export function clip(text: string, max: number): string {
  const t = squash(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

export function wordCount(text: string | null | undefined): number {
  const t = squash(text);
  return t ? t.split(/\s+/).length : 0;
}

export function slugify(text: string): string {
  return squash(text).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
