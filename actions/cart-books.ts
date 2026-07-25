"use server";

import { getBooksByIds } from "@/lib/data/real-books-adapter";
import type { Book } from "@/lib/data/catalog";

/** Thin server-action wrapper so client components (cart, checkout) can
 * resolve real book data for whatever's actually in the cart. */
export async function resolveCartBooks(ids: string[]): Promise<Book[]> {
  return getBooksByIds(ids);
}
