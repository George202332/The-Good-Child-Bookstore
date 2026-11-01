/**
 * Round 53 (Amendment 11) - recalculates the royalty on EVERY existing printed-copy sale line (paperback and
 * hardcover) so it is worked out AFTER Lulu's printing cost, with the agreed split: what is left after the cost is
 * divided company 30% / author 70% (or company 30% / affiliate 10% / author 60% for an affiliate sale), and the
 * author-referral carve-out is applied the same way the checkout does.
 *
 *   - A line that already has a recorded printing cost keeps it.
 *   - A line with NO recorded cost (an older order) gets the cost for that book's own specifications times the number
 *     of copies: Lulu's live quote when Lulu can be asked, otherwise the site's labelled estimate. The cost is then
 *     saved on the line, and the line is FLAGGED in the report and in the log.
 *   - Before anything is changed, the previous figures are written to the SaleLineRoyaltyLog table.
 *   - Only printed-copy lines are touched. eBooks and audiobooks are never changed. Gross amounts are never changed.
 *   - Running it twice is safe: a second run finds nothing left to change.
 *
 * Run it on STAGING first, then on production, from the bookstore folder (PowerShell):
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/recalculate-print-royalties.ts            (shows what would change, saves nothing)
 *   npx tsx scripts/recalculate-print-royalties.ts --apply    (saves the changes and writes the log)
 * It never prints any key.
 */
import { PrismaClient } from "@prisma/client";
import { recalcPrintLine, inferQuantity, sharesChanged, type PrintLineResult } from "../lib/royalty-recalc";
import { getCommissionRates, tierForReferralCount } from "../lib/commission-settings";
import { estimatePrintingCost } from "../lib/lulu-pricing";
import { podPackageForBook, quotePrintingCostPerCopy } from "../lib/payments/lulu";
import { resolveFormatPrice } from "../lib/book-visibility";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const money = (n: number) => `$${n.toFixed(2)}`;

type Meta = { pages?: number; trimSizeCode?: string; binding?: string; [k: string]: unknown };

async function main() {
  const rates = await getCommissionRates();
  const lines = await prisma.saleLine.findMany({
    where: { format: { in: ["paperback", "hardcover"] } },
    select: {
      id: true, orderId: true, bookId: true, format: true, saleType: true, grossAmount: true, printingCost: true,
      companyShare: true, authorShare: true, affiliateShare: true, authorReferralShare: true, authorReferralAffiliateId: true,
      book: { select: { id: true, title: true, submissionMetadata: true, price: true, paperbackPrice: true, hardcoverPrice: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const referralRate = new Map<string, number>();
  const rateFor = async (affiliateId: string) => {
    if (!referralRate.has(affiliateId)) {
      const count = await prisma.authorProfile.count({ where: { referredById: affiliateId } });
      referralRate.set(affiliateId, tierForReferralCount(count, rates.tiers).pct);
    }
    return referralRate.get(affiliateId)!;
  };

  // One cost per copy for each distinct set of specs, so Lulu is asked once per spec, not once per sale.
  const perCopyCache = new Map<string, { cost: number; source: "lulu-specs" | "estimate-specs" } | null>();
  async function perCopyCost(meta: Meta | null, format: "paperback" | "hardcover") {
    const pages = Number(meta?.pages) || 0;
    const trim = meta?.trimSizeCode || "";
    if (!pages || !trim) return null;
    const key = JSON.stringify([format, pages, trim, meta?.interiorColor, meta?.printQuality, meta?.binding, meta?.paperType, meta?.coverFinish, meta?.linenColor, meta?.foilColor]);
    if (perCopyCache.has(key)) return perCopyCache.get(key)!;
    let out: { cost: number; source: "lulu-specs" | "estimate-specs" } | null = null;
    try {
      const pod = await podPackageForBook(meta as never, format, trim);
      const q = await quotePrintingCostPerCopy(pod, pages);
      if (q.ok) out = { cost: q.cost, source: "lulu-specs" };
    } catch { /* fall through to the estimate */ }
    if (!out) out = { cost: estimatePrintingCost(format === "hardcover" ? "LW" : ((meta?.binding as "PB" | "CO") || "PB"), pages), source: "estimate-specs" };
    perCopyCache.set(key, out);
    return out;
  }

  let changed = 0, unchanged = 0, flagged = 0, noSpecs = 0, viaLulu = 0, viaEstimate = 0;
  const flaggedRows: string[] = [];
  const plan: { id: string; orderId: string; bookId: string; before: typeof lines[number]; res: PrintLineResult }[] = [];

  for (const l of lines) {
    const gross = Number(l.grossAmount);
    const format = l.format === "hardcover" ? "hardcover" : "paperback";
    const meta = (l.book.submissionMetadata ?? null) as Meta | null;
    let specsCost: { cost: number; source: "lulu-specs" | "estimate-specs" } | null = null;
    if (l.printingCost == null) {
      const per = await perCopyCost(meta, format);
      if (per) {
        const qty = inferQuantity(gross, resolveFormatPrice(l.book as never, format));
        specsCost = { cost: Math.round(per.cost * qty * 100) / 100, source: per.source };
      } else noSpecs++;
    }
    const res = recalcPrintLine({
      grossAmount: gross,
      saleType: l.saleType,
      recordedPrintingCost: l.printingCost != null ? Number(l.printingCost) : null,
      referralPct: l.authorReferralAffiliateId ? await rateFor(l.authorReferralAffiliateId) : null,
      promotionPct: rates.promotionPct,
      specsCost,
    });
    const before = { companyShare: Number(l.companyShare), authorShare: Number(l.authorShare), affiliateShare: Number(l.affiliateShare), authorReferralShare: Number(l.authorReferralShare) };
    const costChanged = l.printingCost == null && res.costSource !== "none";
    if (!sharesChanged(before, res.next) && !costChanged) { unchanged++; continue; }
    changed++;
    if (res.flagged) {
      flagged++;
      if (res.costSource === "lulu-specs") viaLulu++; else if (res.costSource === "estimate-specs") viaEstimate++;
      flaggedRows.push(`  order ${l.orderId}  "${l.book.title}" (${format})  no recorded cost -> ${res.costSource === "none" ? "no specs found, left as is" : `${money(res.printingCost)} from ${res.costSource}`}  author ${money(before.authorShare)} -> ${money(res.next.authorShare)}`);
    }
    plan.push({ id: l.id, orderId: l.orderId, bookId: l.bookId, before: l, res });
  }

  console.log(`Printed-copy sale lines found: ${lines.length}`);
  console.log(`Recalculated${apply ? "" : " (preview, nothing saved)"}: ${changed}`);
  console.log(`Already correct: ${unchanged}`);
  console.log(`Flagged (older orders with no recorded printing cost, the cost for the book's specs was used): ${flagged}  [Lulu quote: ${viaLulu}, site estimate: ${viaEstimate}]`);
  console.log(`Lines whose book has no page count / trim size on file, so no cost could be found: ${noSpecs}`);
  if (flaggedRows.length) { console.log("\nFlagged orders:"); flaggedRows.forEach((r) => console.log(r)); }

  if (!apply) { console.log("\nNothing was saved. Run again with --apply to save the changes and write the log."); return; }

  for (const p of plan) {
    const b = p.before;
    await prisma.$transaction([
      prisma.saleLineRoyaltyLog.create({
        data: {
          saleLineId: p.id, orderId: p.orderId, bookId: p.bookId,
          previousPrintingCost: b.printingCost, previousCompanyShare: b.companyShare, previousAuthorShare: b.authorShare,
          previousAffiliateShare: b.affiliateShare, previousAuthorReferralShare: b.authorReferralShare,
          newPrintingCost: p.res.printingCost, newCompanyShare: p.res.next.companyShare, newAuthorShare: p.res.next.authorShare,
          newAffiliateShare: p.res.next.affiliateShare, newAuthorReferralShare: p.res.next.authorReferralShare,
          costSource: p.res.costSource, flagged: p.res.flagged,
        },
      }),
      prisma.saleLine.update({
        where: { id: p.id },
        data: {
          ...(p.res.costSource !== "none" ? { printingCost: p.res.printingCost } : {}),
          companyShare: p.res.next.companyShare, authorShare: p.res.next.authorShare,
          affiliateShare: p.res.next.affiliateShare, authorReferralShare: p.res.next.authorReferralShare,
        },
      }),
    ]);
  }
  console.log(`\nSaved. ${plan.length} lines recalculated and logged in SaleLineRoyaltyLog.`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
