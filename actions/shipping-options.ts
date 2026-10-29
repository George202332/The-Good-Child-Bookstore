"use server";

import { prisma } from "@/lib/prisma";
import { getEnabledShippingLevels } from "@/lib/api-keys";
import { countryToIso2 } from "@/lib/user-country";
import { shippingLevelsFor, type LuluShippingLevel } from "@/lib/lulu-order";
import { quoteCartShipping } from "@/lib/payments/cart-shipping";

export interface ShippingOptionRow {
  id: LuluShippingLevel;
  label: string;
  detail: string;
  /** What the customer pays for this method, in US dollars. */
  amount: number;
  /** "lulu" = live quote for this exact order; "estimate" = the store's
   * rate table (shown until a complete address is entered, or if Lulu's
   * quote is unavailable). */
  source: "lulu" | "estimate";
}

export interface ShippingOptionsInput {
  items: { bookId: string; qty: number; format: string }[];
  country: string;
  /** The delivery address in the stored five-line layout (composeShipAddress). */
  address?: string;
  phone?: string;
  name?: string;
}

const cache = new Map<string, { at: number; rows: ShippingOptionRow[] }>();
const CACHE_MS = 5 * 60 * 1000;

/** The shipping methods a customer shipping to this country can choose at
 * checkout (what the store has switched on in Admin → API Management,
 * narrowed to what applies in that country), each with its price for the
 * printed copies in the cart. The customer pays this on top of the books.
 * Public: contains no secrets. */
export async function getShippingOptions(input: ShippingOptionsInput): Promise<ShippingOptionRow[]> {
  const iso = countryToIso2(input.country) ?? "";
  const printItems = (input.items ?? []).filter((i) => i.format === "paperback" || i.format === "hardcover").slice(0, 50);
  const enabled = await getEnabledShippingLevels();
  const levels = shippingLevelsFor(iso, enabled);
  if (printItems.length === 0) return [];

  const key = JSON.stringify([printItems, iso, input.address ?? "", input.phone ?? "", [...levels.map((l) => l.id)]]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;

  const books = await prisma.book.findMany({
    where: { id: { in: printItems.map((i) => i.bookId) } },
    select: { id: true, title: true, submissionMetadata: true, files: { select: { kind: true, url: true } } },
  });
  const lines = printItems.flatMap((i) => {
    const b = books.find((x) => x.id === i.bookId);
    return b ? [{ title: b.title, format: i.format, qty: Math.max(1, Math.min(50, Math.floor(i.qty) || 1)), submissionMetadata: b.submissionMetadata, files: b.files }] : [];
  });

  const quotes = await quoteCartShipping({
    lines, countryIso: iso, rawAddress: input.address, phone: input.phone, name: input.name, levels: levels.map((l) => l.id),
  });
  let rows: ShippingOptionRow[] = levels.map((l) => {
    const q = quotes.find((x) => x.level === l.id);
    return { id: l.id, label: l.label, detail: l.detail, amount: q?.amount ?? 0, source: q?.source ?? "estimate" };
  });
  // Once Lulu has priced this address, only the methods Lulu itself offers are shown, each at
  // Lulu's exact price. A method Lulu does not offer for this address is never shown with the
  // store's estimate (estimates are only shown until the address is complete). The customer
  // is charged exactly what Lulu quotes: no markup, no free-shipping rules.
  if (rows.some((r) => r.source === "lulu")) rows = rows.filter((r) => r.source === "lulu");
  if (cache.size > 200) cache.clear();
  cache.set(key, { at: Date.now(), rows });
  return rows;
}
