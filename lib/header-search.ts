/**
 * Which collection the header search bar searches, decided purely by
 * the current page:
 *
 *  - On the Blog listing page itself ("/blog") it searches blog posts.
 *  - Everywhere else — including an individual blog post ("/blog/<slug>")
 *    — it searches books and authors, exactly as before.
 */
export type HeaderSearchTarget = "blog" | "books";

export function headerSearchTarget(pathname: string | null | undefined): HeaderSearchTarget {
  const path = (pathname ?? "").split("?")[0].replace(/\/+$/, "");
  return path === "/blog" ? "blog" : "books";
}

export const HEADER_SEARCH_PLACEHOLDER: Record<HeaderSearchTarget, string> = {
  books: "Search titles or authors",
  blog: "Search blog posts or authors",
};

/** Where typing in the search box navigates to, keeping any other query
 * parameters that belong to the same page (but always restarting from
 * page 1, since the result set just changed). */
export function headerSearchUrl(target: HeaderSearchTarget, value: string, currentParams: string): string {
  const base = target === "blog" ? "/blog" : "/bookshelf";
  const params = new URLSearchParams(currentParams);
  if (value) params.set("q", value);
  else params.delete("q");
  params.delete("page");
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
