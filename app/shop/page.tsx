import { redirect } from "next/navigation";

/**
 * The old /shop URL — kept working for any already-shared links, but
 * now just redirects straight to the real, canonical /bookshelf URL,
 * preserving any filter query params (category, search, page, etc.)
 * rather than losing them.
 */
export default async function ShopRedirectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
  }
  const qs = query.toString();
  redirect(`/bookshelf${qs ? `?${qs}` : ""}`);
}
