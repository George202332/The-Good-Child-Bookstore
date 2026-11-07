/**
 * READ-ONLY report for Amendment 2, Stage 2. It changes NOTHING.
 *
 *   1. Published print books whose price is below the new company minimum ($3.00 per Paperback copy, $2.00 per Hardcover copy).
 *      They are only listed: nothing is unpublished or repriced.
 *   2. How many books had the old "Promotional Campaign Eligible" and "Affiliate Eligible" switches saved, and how many
 *      affiliate campaigns/links exist (campaigns never depended on the switch).
 *   3. Print books that still have an ISBN saved (left untouched).
 *
 * Usage (PowerShell, from the bookstore folder), pointing at the database to check:
 *   $env:DATABASE_URL = "<the database connection string>"
 *   npx tsx scripts/report-stage2.ts
 * The printing cost used is the site's own estimate (Lulu is not asked), so it is a close guide, not Lulu's exact quote.
 */
import { PrismaClient } from "@prisma/client";
import { estimatePrintingCost } from "../lib/lulu-pricing";
import { checkPriceFloor } from "../lib/print-specs";

const prisma = new PrismaClient();

async function main() {
  const books = await prisma.book.findMany({
    where: { deletedByAuthorAt: null },
    select: { id: true, title: true, status: true, hasPrint: true, paperbackPrice: true, hardcoverPrice: true, submissionMetadata: true },
  });
  console.log(`Books checked: ${books.length}\n`);

  console.log("PART 1 - published print books below the new company minimum:");
  let below = 0;
  for (const b of books.filter((x) => x.hasPrint && x.status === "PUBLISHED")) {
    const meta = (b.submissionMetadata ?? {}) as { pages?: number; binding?: string };
    const pages = Number(meta.pages) || undefined;
    for (const [format, price, binding] of [["paperback", b.paperbackPrice, meta.binding === "CO" ? "CO" : "PB"], ["hardcover", b.hardcoverPrice, "LW"]] as const) {
      if (price == null) continue;
      const cost = estimatePrintingCost(binding as "PB" | "CO" | "LW", pages);
      const r = checkPriceFloor(Number(price), cost, format);
      if (!r.ok) { below++; console.log(`  ${b.title}  [${format}]  price $${Number(price).toFixed(2)}  minimum about $${r.minimum.toFixed(2)}  id=${b.id}`); }
    }
  }
  console.log(below ? `  ${below} edition(s) below the minimum (left as they are).\n` : "  None.\n");

  console.log("PART 2 - old switches (now ignored; every published book is available to affiliates):");
  const meta = (b: { submissionMetadata: unknown }) => (b.submissionMetadata ?? {}) as Record<string, unknown>;
  console.log(`  Promotional Campaign Eligible saved as ON: ${books.filter((b) => meta(b).includeInPromotions === true || meta(b).promotionalCampaignEligible === true).length}`);
  console.log(`  Affiliate Eligible saved as OFF or missing: ${books.filter((b) => meta(b).affiliateEnabled !== true && meta(b).affiliateEligiblePrint !== true).length}`);
  console.log(`  Affiliate campaigns: ${await prisma.campaign.count()}   Affiliate links: ${await prisma.affiliateLink.count()}\n`);

  console.log("PART 3 - print books with an ISBN saved (kept untouched):");
  console.log(`  ${books.filter((b) => b.hasPrint && String(meta(b).printIsbn ?? "").trim()).length}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
