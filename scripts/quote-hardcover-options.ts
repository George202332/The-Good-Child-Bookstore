/**
 * Round 54 (Amendment 2) - READ-ONLY. Asks Lulu's cost calculator what ONE copy of a book would cost to print, for
 * the book's exact specifications and for the same book with its hardcover options changed one at a time, so you
 * can see which option makes the Hardcover cost more than three times the Paperback. It saves NOTHING, changes
 * NOTHING and creates no print job or order. It uses the Lulu keys already saved on the site and never prints any key.
 *
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/quote-hardcover-options.ts --book="Harper and the Crystal World Beyond"
 *   npx tsx scripts/quote-hardcover-options.ts --book=<book id> --shown=18.34
 *
 * --book   the book's title (part of it is enough) or its id. A print edition is used when there are several.
 * --shown  the Hardcover printing cost the Pricing section shows, to be compared with Lulu's quote (optional).
 *
 * Each quote is asked the way the Pricing section asks (quotePrintingCostPerCopy) and, for the book's own
 * settings, ALSO the way a real order asks (quoteLuluCosts), so any difference between the two shows up.
 */
import { PrismaClient } from "@prisma/client";
import { buildPodPackageId } from "../lib/lulu-config";
import { toLuluPodPackageId, type LuluAddress } from "../lib/lulu-order";
import { podPackageForBook, quoteLuluCosts, quotePrintingCostPerCopy } from "../lib/payments/lulu";
import { printOptionsSummary } from "../lib/print-options-summary";

const prisma = new PrismaClient();
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const money = (n: number | null | undefined) => (n == null ? "n/a" : `$${n.toFixed(2)}`);

type Meta = { pages?: number; trimSizeCode?: string; interiorColor?: string; printQuality?: string; binding?: string; paperType?: string; coverFinish?: string; linenColor?: string; foilColor?: string };

const US: LuluAddress = { name: "Cost Quote", street1: "1 Quote Street", city: "New York", state_code: "NY", postcode: "10118", country_code: "US", phone_number: "2125550100", email: "quote@example.com" };

async function main() {
  const which = arg("book");
  if (!which) { console.log('Tell me which book: --book="part of the title" (or the book id).'); return; }
  const books = await prisma.book.findMany({
    where: { OR: [{ id: which }, { title: { contains: which, mode: "insensitive" } }], hasPrint: true },
    select: { id: true, title: true, submissionMetadata: true },
  });
  if (books.length === 0) { console.log("No print book matched that."); return; }
  const book = books[0];
  const m = (book.submissionMetadata ?? {}) as Meta;
  const pages = Number(m.pages) || 0;
  const trim = m.trimSizeCode || "";
  if (!pages || !trim) { console.log(`"${book.title}" has no page count or trim size saved, so a quote cannot be asked.`); return; }

  const color = m.interiorColor || "BW", quality = m.printQuality || "STD", paper = m.paperType || "060UW444", finish = m.coverFinish || "M";
  const linen = m.linenColor || "X", foil = m.foilColor || "X";
  const id = (binding: string, l: string, f: string) => toLuluPodPackageId(buildPodPackageId({ trimCode: trim, colorCode: color, qualityCode: quality, bindingCode: binding, paperCode: paper, finishCode: finish, linenCode: l, foilCode: f }));

  console.log(`Book: "${book.title}"  (${book.id})${books.length > 1 ? `  [${books.length} matches, using the first]` : ""}`);
  console.log(`Settings: ${printOptionsSummary({ format: "hardcover", pageCount: pages, trimCode: trim, binding: "LW", paperCode: paper, colorCode: color, qualityCode: quality, finishCode: finish, linenCode: linen, foilCode: foil }).join(" · ")}\n`);

  type Row = { label: string; pkg: string; cost: number | null; note: string };
  const rows: Row[] = [];
  const ask = async (label: string, pkg: string) => {
    const q = await quotePrintingCostPerCopy(pkg, pages);
    rows.push({ label, pkg, cost: q.ok ? q.cost : null, note: q.ok ? "" : q.rejected ? "Lulu does not offer this combination" : q.error });
  };
  await ask("Paperback, the book's settings", id(m.binding || "PB", "X", "X"));
  await ask("Hardcover, the book's settings (what the Pricing section asks)", id("LW", linen, foil));
  await ask("Hardcover, same linen colour, NO foil stamp", id("LW", linen, "X"));
  await ask("Hardcover, NO linen colour and NO foil", id("LW", "X", "X"));
  await ask("Hardcover, case wrap (CW), no linen, no foil (for comparison; the site does not offer this)", id("CW", "X", "X"));

  console.log("Lulu's printing cost for ONE copy (shipping and fulfilment are never included):");
  for (const r of rows) console.log(`  ${money(r.cost).padEnd(9)} ${r.label}${r.note ? `   <- ${r.note}` : ""}\n            ${r.pkg}`);

  const base = rows[1].cost;
  if (base != null) {
    console.log("\nWhat each option adds to the Hardcover, compared with the book's own settings:");
    if (rows[2].cost != null) console.log(`  Foil stamp:  ${money(base - rows[2].cost)}`);
    if (rows[3].cost != null) console.log(`  Foil + linen colour:  ${money(base - rows[3].cost)}`);
    if (rows[4].cost != null) console.log(`  Linen wrap versus a case wrap:  ${money(base - rows[4].cost)}`);
  }

  // The same figure the way a real order asks for it: they must match.
  const orderQuote = async (format: "paperback" | "hardcover") => {
    const q = await quoteLuluCosts([{ title: book.title, format, quantity: 1, submissionMetadata: m }], US, "MAIL");
    return q.ok ? q.quote.lineCosts[0] : null;
  };
  const pbOrder = await orderQuote("paperback"), hcOrder = await orderQuote("hardcover");
  console.log(`\nThe way a real order asks:  Paperback ${money(pbOrder)}   Hardcover ${money(hcOrder)}`);
  const mismatches: string[] = [];
  if (rows[0].cost != null && pbOrder != null && Math.abs(rows[0].cost - pbOrder) > 0.01) mismatches.push(`Paperback: Pricing ${money(rows[0].cost)} vs order ${money(pbOrder)}`);
  if (rows[1].cost != null && hcOrder != null && Math.abs(rows[1].cost - hcOrder) > 0.01) mismatches.push(`Hardcover: Pricing ${money(rows[1].cost)} vs order ${money(hcOrder)}`);
  const shown = Number(arg("shown"));
  if (shown && rows[1].cost != null && Math.abs(rows[1].cost - shown) > 0.01) mismatches.push(`Hardcover: the site shows ${money(shown)} but Lulu quotes ${money(rows[1].cost)}`);
  // Confirms the package the order path builds is the one the Pricing section builds.
  const orderPkg = await podPackageForBook(m as never, "hardcover", trim);
  if (orderPkg !== rows[1].pkg) mismatches.push(`The Pricing section and a real order build DIFFERENT Hardcover package codes: ${rows[1].pkg} vs ${orderPkg}`);

  console.log(mismatches.length ? `\nMISMATCHES (nothing was changed; tell me which to fix):\n  - ${mismatches.join("\n  - ")}` : "\nNo mismatch: the Pricing section, a real order and Lulu's own quote agree.");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
