/**
 * Round 56 - READ-ONLY. Asks Lulu's cost calculator for the printing price of a book, for ONE copy and for THREE copies,
 * to the delivery address you give, and prints exactly what Lulu answered (or exactly why it did not answer). Use it to:
 *   1. find the exact reason checkout shows "We couldn't get Lulu's printing price" (it prints Lulu's own reason), and
 *   2. check whether the fulfillment fee is charged once per order (same for 1 and 3 copies) or per copy.
 * It saves NOTHING, changes NOTHING and creates no print job or order. It uses the Lulu keys already saved on the
 * site and never prints any key.
 *
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/check-lulu-quote.ts --book="part of the title" --country=US --state=NY --city="New York" --postcode=10118 --street="350 5th Ave" --phone=2125550100
 *
 * --book      the book's title (part of it is enough) or its id (a print edition is used)
 * --country   two-letter country code (default US); --state, --city, --postcode, --street, --phone as needed
 * --level     shipping method (default MAIL; others: PRIORITY_MAIL, GROUND, EXPEDITED, EXPRESS)
 * --format    paperback or hardcover (default: both)
 */
import { PrismaClient } from "@prisma/client";
import type { LuluAddress, LuluShippingLevel } from "../lib/lulu-order";
import { quoteLuluCosts } from "../lib/payments/lulu";

const prisma = new PrismaClient();
const arg = (name: string, fallback = "") => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const money = (n: number | null | undefined) => (n == null ? "n/a" : `$${n.toFixed(2)}`);

async function main() {
  const which = arg("book");
  if (!which) { console.log('Tell me which book: --book="part of the title" (or the book id).'); return; }
  const book = (await prisma.book.findMany({
    where: { OR: [{ id: which }, { title: { contains: which, mode: "insensitive" } }], hasPrint: true },
    select: { id: true, title: true, submissionMetadata: true },
  }))[0];
  if (!book) { console.log("No print book matched that."); return; }
  const address: LuluAddress = {
    name: "Quote Check", street1: arg("street", "350 5th Ave"), city: arg("city", "New York"), state_code: arg("state", "NY") || undefined,
    postcode: arg("postcode", "10118"), country_code: arg("country", "US").toUpperCase(), phone_number: arg("phone", "2125550100"), email: "quote@example.com",
  };
  const level = arg("level", "MAIL") as LuluShippingLevel;
  const formats = arg("format") ? [arg("format") as "paperback" | "hardcover"] : (["paperback", "hardcover"] as const);
  console.log(`Book: "${book.title}"  (${book.id})\nTo: ${address.city}, ${address.state_code ?? ""} ${address.postcode}, ${address.country_code}   Method: ${level}\n`);

  for (const format of formats) {
    console.log(format.toUpperCase());
    const fees: number[] = [];
    for (const quantity of [1, 3]) {
      const q = await quoteLuluCosts([{ title: book.title, format, quantity, submissionMetadata: book.submissionMetadata }], address, level);
      if (!q.ok) {
        console.log(`  ${quantity} copy/copies: NO PRICE. Reason kind: ${q.failure.kind}   HTTP status: ${q.failure.status ?? "none"}\n     Lulu said: ${q.failure.detail || "(nothing)"}\n     Customer would see: ${q.failure.customerMessage}`);
        continue;
      }
      fees.push(q.quote.fulfillmentCost);
      console.log(`  ${quantity} copy/copies: printing ${money(q.quote.lineCosts.reduce((a, b) => a + b, 0))}   shipping ${money(q.quote.shippingCost)}   fulfillment fee ${money(q.quote.fulfillmentCost)}`);
    }
    if (fees.length === 2) {
      console.log(Math.abs(fees[0] - fees[1]) < 0.005
        ? "  -> The fulfillment fee is the SAME for 1 and 3 copies: it is charged once per order."
        : "  -> The fulfillment fee DIFFERS between 1 and 3 copies: it may be charged per copy. TELL ME BEFORE GO-LIVE.");
    }
    console.log("");
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
