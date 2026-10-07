"use server";

import { getBooksByIds } from "@/lib/data/real-books-adapter";
import { getVisitorCountries } from "@/lib/visitor-country";
import type { Book } from "@/lib/data/catalog";

/** Thin server-action wrapper so client components (cart, checkout) can
 * resolve real book data for whatever's actually in the cart. Books that
 * are restricted for the current visitor (account country or request geo)
 * come back with `restricted: true` so checkout can block payment; the
 * ship-to check for print lines happens in checkout from each book's
 * `restrictedCountries`, and authoritatively in createPendingOrder. */
export async function resolveCartBooks(ids: string[]): Promise<Book[]> {
  return getBooksByIds(ids, await getVisitorCountries());
}
