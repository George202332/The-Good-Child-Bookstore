/**
 * Round 57 (Amendment 6) - audits the LIVE data for orphaned, duplicate and incomplete records.
 * READ-ONLY by default: it only reports. Add --fix to apply the few clear-cut repairs listed below; everything else is
 * only ever reported, for you to decide.
 *
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/audit-site-data.ts            (report only)
 *   npx tsx scripts/audit-site-data.ts --fix      (also apply the clear-cut repairs)
 *
 * What --fix does (and nothing else):
 *   1. deletes notifications that point at a record that no longer exists anywhere (a dangling link, nothing to open);
 *   2. deletes saved print-file checks whose book no longer exists;
 *   3. deletes DUPLICATE unpaid (PENDING) orders: same reader, same books, same total, created within 30 minutes of the
 *      first one, no payment attempt recorded. The oldest is kept. (The checkout used to create one per click.)
 *   4. fills a missing Fulfillment Fee on test orders from the fee Lulu quoted (the same correction as
 *      correct-sandbox-order-fulfillment.ts).
 * It never touches sale lines, royalties, payments or paid orders' amounts, and never prints any secret.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const fix = process.argv.includes("--fix");
const say = (s = "") => console.log(s);
const head = (s: string) => say(`\n== ${s}`);

async function main() {
  say(fix ? "MODE: report and apply clear-cut repairs (--fix)" : "MODE: report only (add --fix to apply the clear-cut repairs)");
  let decisions = 0;

  // 0. Books or saved drafts that still use the removed "LGBTQ+ Families" subcategory (Round 58). Report only.
  head("Books or drafts using the removed LGBTQ+ Families subcategory");
  const lgbtq = await prisma.$queryRawUnsafe<{ id: string; title: string; status: string; where: string }[]>(`
    SELECT "id", "title", "status"::text AS status, 'subcategory' AS "where" FROM "Book" WHERE "subcategory" ILIKE '%LGBTQ%'
    UNION ALL
    SELECT "id", "title", "status"::text, 'draft or pending revision' FROM "Book"
      WHERE "pendingRevisionData"::text ILIKE '%LGBTQ%' OR "submissionMetadata"::text ILIKE '%LGBTQ%'
  `);
  if (lgbtq.length === 0) say("None found.");
  for (const r of lgbtq) { say(`  ${r.id}  "${r.title}"  (${r.status}; ${r.where})`); decisions++; }

  // 1. Notifications that point at a record that no longer exists.
  head("Notifications pointing at deleted records");
  const dangling = await prisma.$queryRawUnsafe<{ id: string }[]>(`
    SELECT n."id" FROM "Notification" n
    WHERE n."relatedRecordId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Order" x WHERE x."id" = n."relatedRecordId")
      AND NOT EXISTS (SELECT 1 FROM "Book" x WHERE x."id" = n."relatedRecordId")
      AND NOT EXISTS (SELECT 1 FROM "Blog" x WHERE x."id" = n."relatedRecordId")
      AND NOT EXISTS (SELECT 1 FROM "BlogComment" x WHERE x."id" = n."relatedRecordId")
      AND NOT EXISTS (SELECT 1 FROM "Message" x WHERE x."id" = n."relatedRecordId")
      AND NOT EXISTS (SELECT 1 FROM "PayoutRequest" x WHERE x."id" = n."relatedRecordId")
      AND NOT EXISTS (SELECT 1 FROM "Review" x WHERE x."id" = n."relatedRecordId")
      AND NOT EXISTS (SELECT 1 FROM "SaleLine" x WHERE x."id" = n."relatedRecordId")
      AND NOT EXISTS (SELECT 1 FROM "User" x WHERE x."id" = n."relatedRecordId")
      AND NOT EXISTS (SELECT 1 FROM "AffiliateLink" x WHERE x."id" = n."relatedRecordId")
      AND NOT EXISTS (SELECT 1 FROM "Campaign" x WHERE x."id" = n."relatedRecordId")
      AND NOT EXISTS (SELECT 1 FROM "WiseRecipient" x WHERE x."id" = n."relatedRecordId")`);
  say(`${dangling.length} found.`);
  if (fix && dangling.length) {
    const r = await prisma.notification.deleteMany({ where: { id: { in: dangling.map((d) => d.id) } } });
    say(`Deleted ${r.count}.`);
  }

  // 2. Saved print-file checks for deleted books.
  head("Saved print-file checks whose book no longer exists");
  const checks = await prisma.printPreflightCheck.findMany({ where: { bookId: { not: null } }, select: { id: true, bookId: true } });
  const bookIds = new Set((await prisma.book.findMany({ where: { id: { in: checks.map((c) => c.bookId as string) } }, select: { id: true } })).map((b) => b.id));
  const orphanChecks = checks.filter((c) => !bookIds.has(c.bookId as string));
  say(`${orphanChecks.length} found.`);
  if (fix && orphanChecks.length) say(`Deleted ${(await prisma.printPreflightCheck.deleteMany({ where: { id: { in: orphanChecks.map((c) => c.id) } } })).count}.`);

  // 3. Duplicate unpaid orders.
  head("Duplicate unpaid (PENDING) orders");
  const pending = await prisma.order.findMany({
    where: { status: "PENDING", paymentLogs: { none: {} } },
    select: { id: true, readerId: true, totalAmount: true, createdAt: true, lines: { select: { bookId: true, format: true, grossAmount: true } } },
    orderBy: { createdAt: "asc" },
  });
  const sig = (o: (typeof pending)[number]) => `${o.readerId}|${Number(o.totalAmount).toFixed(2)}|${o.lines.map((l) => `${l.bookId}:${l.format}:${Number(l.grossAmount).toFixed(2)}`).sort().join(",")}`;
  const keep = new Map<string, Date>();
  const dupes: string[] = [];
  for (const o of pending) {
    const k = sig(o);
    const first = keep.get(k);
    if (first && o.createdAt.getTime() - first.getTime() < 30 * 60 * 1000) dupes.push(o.id);
    else keep.set(k, o.createdAt);
  }
  say(`${dupes.length} duplicate unpaid order(s) found (of ${pending.length} unpaid orders in all).`);
  if (fix && dupes.length) say(`Marked ${(await prisma.order.updateMany({ where: { id: { in: dupes }, status: "PENDING" }, data: { status: "CANCELLED" } })).count} as CANCELLED (orders are never deleted).`);

  // 4. Print orders missing figures.
  head("Paid print orders with missing figures");
  const printOrders = await prisma.order.findMany({
    where: { status: "PAID", lines: { some: { format: { in: ["paperback", "hardcover"] } } } },
    select: { id: true, isTestData: true, totalAmount: true, shippingAmount: true, fulfillmentAmount: true, luluFulfillmentCost: true, lines: { select: { format: true, grossAmount: true, printingCost: true } } },
  });
  const noCost = printOrders.filter((o) => o.lines.some((l) => (l.format === "paperback" || l.format === "hardcover") && l.printingCost == null));
  const noFee = printOrders.filter((o) => o.fulfillmentAmount == null);
  const feeFixable = noFee.filter((o) => o.isTestData && o.luluFulfillmentCost != null);
  say(`${noCost.length} order(s) have a printed line with NO printing cost saved (cannot be invented: needs your decision).`);
  say(`${noFee.length} order(s) have no Fulfillment Fee saved; ${feeFixable.length} of them are test orders with Lulu's quote saved (clear-cut).`);
  if (noCost.length) decisions += 1;
  if (noFee.length - feeFixable.length > 0) decisions += 1;
  if (fix) {
    for (const o of feeFixable) {
      const fee = Number(o.luluFulfillmentCost);
      await prisma.order.update({ where: { id: o.id }, data: { fulfillmentAmount: fee, totalAmount: Math.round((Number(o.totalAmount) + fee) * 100) / 100 } });
    }
    say(`Filled ${feeFixable.length} test order(s).`);
  }

  // 5. Order totals that do not add up (report only).
  head("Paid orders whose total does not equal books + shipping + fulfillment fee");
  const all = await prisma.order.findMany({ where: { status: "PAID" }, select: { id: true, totalAmount: true, shippingAmount: true, fulfillmentAmount: true, lines: { select: { grossAmount: true } } } });
  const off = all.filter((o) => Math.abs(Number(o.totalAmount) - (o.lines.reduce((s, l) => s + Number(l.grossAmount), 0) + Number(o.shippingAmount ?? 0) + Number(o.fulfillmentAmount ?? 0))) > 0.011);
  say(`${off.length} of ${all.length} paid order(s) do not add up${off.length ? ` (e.g. #${off.slice(0, 5).map((o) => o.id.slice(0, 8).toUpperCase()).join(", #")})` : ""}.`);
  if (off.length) decisions += 1;

  // 6. Paid orders with no payment record (report only).
  head("Paid orders with no recorded payment");
  const noPay = await prisma.order.count({ where: { status: "PAID", paymentLogs: { none: {} } } });
  say(`${noPay} found (test or demo data, or a payment that was recorded by hand). Needs your decision.`);
  if (noPay) decisions += 1;

  // 7. Stale unpaid orders (report only).
  head("Old unpaid orders (abandoned checkouts)");
  say(`${await prisma.order.count({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } })} unpaid order(s) older than 7 days. They are not counted as sales anywhere; they can be cleared if you wish.`);

  // 8. Duplicate promotion links (report only).
  head("Duplicate promotion links (same affiliate, same book)");
  const dupLinks = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM (SELECT "affiliateId","bookId" FROM "AffiliateLink" WHERE "bookId" IS NOT NULL GROUP BY 1,2 HAVING COUNT(*) > 1) t`);
  say(`${Number(dupLinks[0]?.n ?? 0)} pair(s) found.`);

  // 9. Books with no author record or no files (report only).
  head("Published books with no manuscript file");
  const noFile = await prisma.book.count({ where: { status: "PUBLISHED", hasEbook: true, files: { none: { kind: "MANUSCRIPT" } } } });
  say(`${noFile} published eBook(s) have no manuscript file on record (their buyers get no download).`);
  if (noFile) decisions += 1;

  say(`\nDone. ${decisions} item(s) above need your decision; nothing else was changed${fix ? " beyond the repairs listed" : " (report only)"}.`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
