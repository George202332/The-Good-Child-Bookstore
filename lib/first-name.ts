/**
 * First whitespace-separated token of a person's name, for author-facing
 * views that must not reveal a referred user's full name. Runs on the
 * server so the full name never reaches the browser. Empty, whitespace-only
 * or missing names fall back to a neutral label.
 */
export function firstNameOnly(name: string | null | undefined, fallback = "Reader"): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || fallback;
}
