/**
 * Promotions (affiliate links) whose book no longer exists or is no longer live.
 *
 * DEFAULT = READ-ONLY REPORT. It changes NOTHING. It shows:
 *   1. How the database is set to treat a promotion when its book is deleted
 *      (the rule that decides whether orphans can be left behind).
 *   2. "Orphaned" promotions: the book is gone (the link points at no book).
 *   3. Promotions whose book still exists but is withdrawn / suspended / draft /
 *      deleted by its author (not live).
 * grouped by the account (affiliate) that owns them.
 *
 * Usage (PowerShell, from the bookstore folder), pointing at the database to check:
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/report-orphan-promotions.ts
 *
 * ONLY AFTER YOU HAVE APPROVED THE REPORT, to remove the safe ones:
 *   npx tsx scripts/report-orphan-promotions.ts --apply
 * --apply deletes only promotions that are orphaned or not live AND have never
 * earned a commission. Promotions that earned a commission are KEPT (their sale
 * records point at them); they are simply never shown. No orders, sales, books
 * or accounts are touched.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const rule = await prisma.$queryRawUnsafe<{ rule: string }[]>(
    `SELECT CASE c.confdeltype WHEN 'c' THEN 'CASCADE (deleting a book also deletes its promotions)'
                               WHEN 'n' THEN 'SET NULL (deleting a book LEAVES its promotions behind, pointing at nothing)'
                               WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' ELSE c.confdeltype::text END AS rule
     FROM pg_constraint c WHERE c.conname = 'AffiliateLink_bookId_fkey'`,
  );
  console.log(`Database rule when a book is deleted: ${rule[0]?.rule ?? "(not found)"}`);

  const links = await prisma.affiliateLink.findMany({
    select: {
      id: true, code: true, bookId: true, createdAt: true,
      book: { select: { id: true, title: true, status: true, deletedByAuthorAt: true } },
      affiliate: { select: { user: { select: { accountNumber: true, name: true, email: true } } } },
      _count: { select: { saleLines: true, clicks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  type Row = (typeof links)[number];
  const orphans: Row[] = [];
  const notLive: Row[] = [];
  for (const l of links) {
    if (!l.book) orphans.push(l);
    else if (l.book.status !== "PUBLISHED" || l.book.deletedByAuthorAt) notLive.push(l);
  }

  const show = (title: string, rows: Row[]) => {
    console.log(`\n${title}: ${rows.length}`);
    const byUser = new Map<string, Row[]>();
    for (const r of rows) {
      const u = r.affiliate.user;
      const k = `${u.accountNumber}  ${u.name} <${u.email}>`;
      if (!byUser.has(k)) byUser.set(k, []);
      byUser.get(k)!.push(r);
    }
    for (const [who, rs] of byUser) {
      console.log(`  Account ${who}: ${rs.length} promotion(s)`);
      for (const r of rs) {
        const what = r.book ? `"${r.book.title}" [${r.book.status}${r.book.deletedByAuthorAt ? ", deleted by author" : ""}]` : "(book no longer exists)";
        console.log(`     - ${what}  code ${r.code}  clicks ${r._count.clicks}  sales ${r._count.saleLines}${r._count.saleLines > 0 ? "  (earned commission: will be kept)" : ""}`);
      }
    }
  };

  console.log(`\nPromotions in total: ${links.length}`);
  show("A) ORPHANED: the book no longer exists", orphans);
  show("B) The book exists but is not live (withdrawn / suspended / draft / deleted by its author)", notLive);

  const removable = [...orphans, ...notLive].filter((r) => r._count.saleLines === 0);
  console.log(`\nSafe to remove (no commission ever earned): ${removable.length}. Kept as history (hidden): ${orphans.length + notLive.length - removable.length}.`);

  if (!APPLY) {
    console.log("\nNothing was changed. (Run with --apply only after you have approved this report.)");
    return;
  }
  const res = await prisma.affiliateLink.deleteMany({ where: { id: { in: removable.map((r) => r.id) }, saleLines: { none: {} } } });
  console.log(`\nRemoved ${res.count} promotion(s).`);
}

main()
  .catch((e) => {
    console.error("Failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
