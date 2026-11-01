/**
 * Round 55 (Amendment 2) - READ-ONLY. Asks Lulu what ONE copy of a book would cost to print when it is shipped to
 * different countries, and which shipping methods Lulu offers for each (so you can see for yourself whether
 * Priority Mail is offered, and whether the PRINTING cost changes with the destination). It saves NOTHING, changes
 * NOTHING and creates no print job or order. It uses the Lulu keys already saved on the site and never prints any key.
 *
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/compare-printing-cost-by-destination.ts --book="part of the title"
 *
 * --book  the book's title (part of it is enough) or its id. A print edition is used when there are several.
 */
import { PrismaClient } from "@prisma/client";
import type { LuluAddress, LuluShippingLevel } from "../lib/lulu-order";
import { quoteLuluCosts } from "../lib/payments/lulu";

const prisma = new PrismaClient();
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const money = (n: number | null | undefined) => (n == null ? "n/a" : `$${n.toFixed(2)}`);

const base = { name: "Cost Quote", phone_number: "2125550100", email: "quote@example.com" };
const PLACES: { label: string; a: LuluAddress }[] = [
  { label: "United States (New York)", a: { ...base, street1: "1 Quote Street", city: "New York", state_code: "NY", postcode: "10118", country_code: "US" } },
  { label: "United Kingdom (London)", a: { ...base, street1: "1 Quote Street", city: "London", postcode: "SW1A 1AA", country_code: "GB" } },
  { label: "Canada (Toronto)", a: { ...base, street1: "1 Quote Street", city: "Toronto", state_code: "ON", postcode: "M5V 2T6", country_code: "CA" } },
  { label: "Australia (Sydney)", a: { ...base, street1: "1 Quote Street", city: "Sydney", state_code: "NSW", postcode: "2000", country_code: "AU" } },
  { label: "Germany (Berlin)", a: { ...base, street1: "1 Quote Street", city: "Berlin", postcode: "10115", country_code: "DE" } },
  { label: "Kenya (Nairobi)", a: { ...base, street1: "1 Quote Street", city: "Nairobi", postcode: "00100", country_code: "KE" } },
  { label: "Nigeria (Lagos)", a: { ...base, street1: "1 Quote Street", city: "Lagos", postcode: "100001", country_code: "NG" } },
];
const LEVELS: LuluShippingLevel[] = ["MAIL", "PRIORITY_MAIL", "GROUND", "EXPEDITED", "EXPRESS"] as LuluShippingLevel[];

async function main() {
  const which = arg("book");
  if (!which) { console.log('Tell me which book: --book="part of the title" (or the book id).'); return; }
  const book = (await prisma.book.findMany({
    where: { OR: [{ id: which }, { title: { contains: which, mode: "insensitive" } }], hasPrint: true },
    select: { id: true, title: true, submissionMetadata: true },
  }))[0];
  if (!book) { console.log("No print book matched that."); return; }
  console.log(`Book: "${book.title}"  (${book.id})\n`);
  for (const format of ["paperback", "hardcover"] as const) {
    console.log(`${format.toUpperCase()}, one copy. Printing cost is Lulu's line cost; shipping is shown separately and is never part of the royalty.`);
    const lines: string[] = [];
    let first: number | null = null, differs = false;
    for (const p of PLACES) {
      const offered: string[] = [];
      let printing: number | null = null;
      for (const level of LEVELS) {
        const q = await quoteLuluCosts([{ title: book.title, format, quantity: 1, submissionMetadata: book.submissionMetadata }], p.a, level);
        if (!q.ok) continue;
        offered.push(`${level} ${money(q.quote.shippingCost)}`);
        if (printing == null) printing = q.quote.lineCosts[0];
      }
      if (printing != null) { if (first == null) first = printing; else if (Math.abs(printing - first) > 0.005) differs = true; }
      lines.push(`  ${p.label.padEnd(28)} printing ${money(printing).padEnd(8)} ${offered.length ? offered.join(" | ") : "Lulu offered no shipping method (cannot ship here)"}`);
    }
    console.log(lines.join("\n"));
    console.log(differs ? "  -> The PRINTING cost differs by destination." : "  -> The PRINTING cost is the same for every destination that was priced.");
    console.log(`  Priority Mail offered anywhere above: ${lines.some((l) => l.includes("PRIORITY_MAIL")) ? "yes (see the lines containing PRIORITY_MAIL)" : "no"}\n`);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
