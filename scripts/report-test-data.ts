/**
 * READ-ONLY report for the one-time test-data cleanup. It changes NOTHING: every query runs inside a database transaction that
 * is set to READ ONLY, so the database itself refuses any change. It deletes nothing and has no delete code in it.
 *
 * Run it in your own terminal with DATABASE_URL pointing at the database you want to look at (production, when you are ready):
 *   npx tsx scripts/report-test-data.ts
 *   npx tsx scripts/report-test-data.ts --split=2026-11-03     (the day you split staging off into its own Neon branch)
 *
 * It prints: which database it is looking at (endpoint NAME only, never a password), the count per table of what a cleanup
 * WOULD remove, what would be KEPT, whether any real-money (live) sale exists, whether any real Lulu print order was sent, and
 * how the rows are spread before/after the staging split. No names, emails or keys are printed.
 */
import { prisma } from "../lib/prisma";
import { describeDatabase } from "../lib/runtime-env";

const splitArg = process.argv.find((a) => a.startsWith("--split="))?.slice(8);
const split = splitArg && !Number.isNaN(Date.parse(splitArg)) ? new Date(splitArg) : null;
const COMPANY_AUTHOR_ACCOUNT = "30000064";

function row(label: string, n: number | string, note = "") {
  console.log(`  ${label.padEnd(46)} ${String(n).padStart(8)}  ${note}`);
}

async function main() {
  const db = describeDatabase(process.env.DATABASE_URL, process.env.DATABASE_LABEL);
  console.log(`Database being read: ${db ? `${db.endpoint} / ${db.database}` : "(DATABASE_URL not set)"}`);
  console.log("This report is READ ONLY. Nothing is changed or deleted.\n");

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");

    // ---------------------------------------------------------------- what a cleanup would remove
    console.log("A. WOULD BE REMOVED by the one-time cleanup (counts per table)");
    const orders = await tx.order.count();
    const byStatus = await tx.order.groupBy({ by: ["status"], _count: { _all: true } });
    row("Order (orders)", orders, byStatus.map((s) => `${s.status}:${s._count._all}`).join("  "));
    row("  of which flagged isTestData", await tx.order.count({ where: { isTestData: true } }));
    row("SaleLine (sales, earnings, commissions, referrals)", await tx.saleLine.count());
    row("PaymentLog (payments)", await tx.paymentLog.count());
    row("SaleLineRoyaltyLog (royalty recalculation log)", await tx.saleLineRoyaltyLog.count());
    const payByStatus = await tx.payoutRequest.groupBy({ by: ["status"], _count: { _all: true } });
    row("PayoutRequest (payouts)", await tx.payoutRequest.count(), payByStatus.map((s) => `${s.status}:${s._count._all}`).join("  "));
    row("Refund", await tx.refund.count());
    row("PayoutAdjustment", await tx.payoutAdjustment.count());
    row("RecordChangeLog", await tx.recordChangeLog.count());
    row("OrderLoginToken (guest order sign-in links)", await tx.orderLoginToken.count());
    row("Review (reviews)", await tx.review.count());
    row("Rating (star ratings)", await tx.rating.count());
    row("AccountingExpense", await tx.accountingExpense.count());
    row("AccountingMonth (closed/open month records)", await tx.accountingMonth.count());
    row("AccountingChangeLog", await tx.accountingChangeLog.count());
    row("AccountingReceipt", await tx.accountingReceipt.count());
    row("AccountingReport (saved monthly reports)", await tx.accountingReport.count());
    row("Setting 'accounting_test_archive' (marker)", await tx.setting.count({ where: { key: "accounting_test_archive" } }));

    const notifOrders = await tx.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "Notification" n
      WHERE n."relatedRecordId" IN (SELECT "id" FROM "Order")
         OR n."relatedRecordId" IN (SELECT "id" FROM "SaleLine")
         OR n."relatedRecordId" IN (SELECT "id" FROM "PayoutRequest")`;
    row("Notification about orders, sales and payouts", Number(notifOrders[0]?.n ?? 0), "(notices created from those orders)");
    console.log("  Emails: the site does not keep copies of sent emails, so there is nothing to delete for them.");

    // ---------------------------------------------------------------- what stays
    console.log("\nB. WILL BE KEPT (counts, for your comparison before and after)");
    row("User (all accounts)", await tx.user.count());
    row("Book (all books)", await tx.book.count());
    row("BookFile (manuscripts, covers, audio files)", await tx.bookFile.count());
    row("UploadedImage / UploadedFile", `${await tx.uploadedImage.count()} / ${await tx.uploadedFile.count()}`);
    const company = await tx.user.findUnique({ where: { accountNumber: COMPANY_AUTHOR_ACCOUNT }, select: { id: true } });
    if (company) {
      const books = await tx.book.count({ where: { author: { userId: company.id } } });
      row(`Books under company author ${COMPANY_AUTHOR_ACCOUNT}`, books, "(files, covers, prices, mockups untouched)");
    } else {
      row(`Company author ${COMPANY_AUTHOR_ACCOUNT}`, "NOT FOUND", "<-- check this before any cleanup");
    }
    console.log("  Sales counts and rating averages are not stored on the books: they are worked out from the sales and ratings above,");
    console.log("  so they return to zero by themselves when those rows are cleared.");

    // ---------------------------------------------------------------- real money / real Lulu orders
    console.log("\nC. REAL-MONEY AND REAL-PRINT CHECKS (must be zero before any cleanup)");
    const logs = await tx.paymentLog.findMany({ select: { orderId: true, gateway: true, verified: true, rawPayload: true } });
    const liveOrders = new Set<string>();
    const unknownMode = new Set<string>();
    for (const l of logs) {
      if (!l.verified) continue;
      const m = (l.rawPayload as { siteGatewayMode?: unknown } | null)?.siteGatewayMode;
      const domain = (l.rawPayload as { data?: { domain?: unknown } } | null)?.data?.domain;
      if (m === "live" || domain === "live") liveOrders.add(l.orderId);
      else if (m !== "test" && domain !== "test") unknownMode.add(l.orderId);
    }
    row("Paid orders confirmed in LIVE (real-money) mode", liveOrders.size, liveOrders.size ? "<-- STOP: real sales exist" : "");
    row("Paid orders whose mode is not recorded", unknownMode.size, unknownMode.size ? "<-- needs a look" : "");
    const sent = await tx.order.count({ where: { printJobStatus: "SUBMITTED" } });
    row("Orders SENT to Lulu (real print jobs)", sent, sent ? "<-- a real print job exists on your Lulu account; deleting our record will NOT cancel it" : "");
    row("Orders held (HELD_TEST) / failed", `${await tx.order.count({ where: { printJobStatus: "HELD_TEST" } })} / ${await tx.order.count({ where: { printJobStatus: "FAILED" } })}`);
    row("Orders with any Lulu status or job id", await tx.order.count({ where: { OR: [{ luluStatus: { not: null } }, { printJobId: { not: null } }] } }));

    // ---------------------------------------------------------------- staging mixed into production?
    console.log("\nD. IS STAGING TEST DATA MIXED INTO THIS DATABASE?");
    console.log("  Before you gave staging its own Neon branch, staging and production wrote to the SAME database, so any order,");
    console.log("  payment, review or account made on the staging site before that day is in here. The rows do not record which site");
    console.log("  made them, so they are told apart by DATE.");
    if (!split) {
      console.log("  (Run again with --split=YYYY-MM-DD, the day you created the staging branch, to see the before/after counts.)");
    } else {
      const before = { createdAt: { lt: split } };
      const after = { createdAt: { gte: split } };
      console.log(`  Split day used: ${split.toISOString().slice(0, 10)}`);
      row("Orders created BEFORE the split (may be staging or live site)", await tx.order.count({ where: before }));
      row("Orders created ON/AFTER the split (this database only)", await tx.order.count({ where: after }));
      row("Users created BEFORE the split", await tx.user.count({ where: before }));
      row("Users created ON/AFTER the split", await tx.user.count({ where: after }));
      row("Reviews before / after", `${await tx.review.count({ where: before })} / ${await tx.review.count({ where: after })}`);
    }
    const perDay = await tx.$queryRaw<{ d: string; n: bigint }[]>`
      SELECT to_char("createdAt", 'YYYY-MM-DD') AS d, COUNT(*)::bigint AS n FROM "Order" GROUP BY 1 ORDER BY 1 DESC LIMIT 14`;
    console.log("  Orders per day (latest 14 days with orders): " + (perDay.map((p) => `${p.d}:${p.n}`).join("  ") || "none"));
    const hosts = await tx.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "User" WHERE "email" ~* '(@example\\.|^test|\\+test|@test\\.|@mailinator|@yopmail)'`;
    row("Accounts whose email looks like a test address", Number(hosts[0]?.n ?? 0), "(kept: user accounts are not deleted)");

    console.log("\nE. SUMMARY");
    console.log(`  Real-money sales: ${liveOrders.size}.  Real Lulu print jobs sent: ${sent}.`);
    console.log(liveOrders.size === 0 && sent === 0 && unknownMode.size === 0
      ? "  RESULT: nothing here looks like a real sale. Send these counts back; nothing is deleted until you approve them."
      : "  RESULT: STOP. Something here may be real. Send these counts back and do not clean anything up yet.");
  }, { timeout: 120000 });

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
