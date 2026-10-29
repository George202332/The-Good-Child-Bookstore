/**
 * Round 48 - READ-ONLY REPORT. It changes NOTHING in the database and makes no calls to Lulu.
 *
 * From this release, every NEW paperback / hardcover sale saves Lulu's production printing cost
 * on its sale line, and the author / affiliate / company shares are worked out AFTER that cost.
 * Print sales recorded BEFORE this release have no saved printing cost and keep the shares they
 * were recorded with. This report shows exactly which records those are, so you can decide
 * whether anything should be corrected:
 *
 *   PART 1 - paid print sale lines with NO saved printing cost: how many, which authors and
 *            affiliates, and the shares they currently hold.
 *   PART 2 - what would change IF you chose to correct them using an assumed printing cost per
 *            copy (default 4.00 per sale line, change it with --cost=5.25). This is only an illustration; the
 *            real figure per book would come from Lulu. Nothing is saved.
 *
 * Usage (PowerShell, from the bookstore folder):
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/report-print-royalties.ts
 *   npx tsx scripts/report-print-royalties.ts --cost=5.25
 */
import { PrismaClient } from "@prisma/client";
import { calculateSplits } from "../lib/revenue";

const prisma = new PrismaClient();
const money = (n: number) => `$${n.toFixed(2)}`;
const costArg = process.argv.find((a) => a.startsWith("--cost="));
const assumedCost = costArg ? Number(costArg.split("=")[1]) : 4;

async function main() {
  const lines = await prisma.saleLine.findMany({
    where: { order: { status: "PAID" }, format: { in: ["paperback", "hardcover"] }, printingCost: null },
    select: {
      id: true, grossAmount: true, saleType: true, authorShare: true, affiliateShare: true, companyShare: true,
      book: { select: { title: true, author: { select: { penName: true, user: { select: { email: true, name: true } } } } } },
      affiliateLink: { select: { affiliate: { select: { user: { select: { email: true, name: true } } } } } },
    },
  });

  console.log(`PART 1 - paid print sale lines with no saved printing cost: ${lines.length}\n`);
  if (lines.length === 0) { console.log("Nothing to correct. All paid print sales already carry a saved printing cost (or there are none)."); return; }

  type Acc = { lines: number; gross: number; author: number; affiliate: number; company: number; newAuthor: number; newAffiliate: number; newCompany: number };
  const empty = (): Acc => ({ lines: 0, gross: 0, author: 0, affiliate: 0, company: 0, newAuthor: 0, newAffiliate: 0, newCompany: 0 });
  const authors = new Map<string, Acc>();
  const affiliates = new Map<string, Acc>();
  const total = empty();

  for (const l of lines) {
    const gross = Number(l.grossAmount);
    const now = { author: Number(l.authorShare), affiliate: Number(l.affiliateShare), company: Number(l.companyShare) };
    const next = calculateSplits(gross, l.saleType === "AFFILIATE", undefined, assumedCost);
    const a = l.book.author;
    const authorKey = `${a?.penName || a?.user?.name || "(unknown)"} <${a?.user?.email ?? "?"}>`;
    const affU = l.affiliateLink?.affiliate?.user;
    const affKey = affU ? `${affU.name ?? "(unknown)"} <${affU.email}>` : null;
    const add = (acc: Acc) => {
      acc.lines += 1; acc.gross += gross;
      acc.author += now.author; acc.affiliate += now.affiliate; acc.company += now.company;
      acc.newAuthor += next.authorShare; acc.newAffiliate += next.affiliateShare; acc.newCompany += next.companyShare;
    };
    add(total);
    add(authors.get(authorKey) ?? authors.set(authorKey, empty()).get(authorKey)!);
    if (affKey) add(affiliates.get(affKey) ?? affiliates.set(affKey, empty()).get(affKey)!);
  }

  console.log("Authors:");
  for (const [k, v] of authors) console.log(`  ${k}  lines=${v.lines}  gross=${money(v.gross)}  author share now=${money(v.author)}`);
  console.log("\nAffiliates:");
  if (affiliates.size === 0) console.log("  (none)");
  for (const [k, v] of affiliates) console.log(`  ${k}  lines=${v.lines}  commission now=${money(v.affiliate)}`);
  console.log(`\nTotal: lines=${total.lines}  gross=${money(total.gross)}  author=${money(total.author)}  affiliate=${money(total.affiliate)}  company=${money(total.company)}`);

  console.log(`\nPART 2 - ILLUSTRATION ONLY, assuming a printing cost of ${money(assumedCost)} per sale line (nothing is saved):`);
  for (const [k, v] of authors) console.log(`  ${k}: author share ${money(v.author)} -> ${money(v.newAuthor)}  (change ${money(v.newAuthor - v.author)})`);
  for (const [k, v] of affiliates) console.log(`  ${k}: commission ${money(v.affiliate)} -> ${money(v.newAffiliate)}  (change ${money(v.newAffiliate - v.affiliate)})`);
  console.log(`  Company: ${money(total.company)} -> ${money(total.newCompany)}  (change ${money(total.newCompany - total.company)})`);
  console.log("\nNo record has been changed. Tell me whether to leave these as they are (test data) or correct them.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
