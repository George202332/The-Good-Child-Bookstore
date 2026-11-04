/**
 * READ-ONLY report for the one-time PRODUCTION test-data cleanup (step 1). It changes NOTHING: everything runs inside a
 * database transaction that is set to READ ONLY, so the database itself refuses any change. It has no delete code.
 * Start it with scripts\report-cleanup.ps1 (which asks for the production address safely). It prints no names, emails or keys.
 *
 * Options:  --live-since=YYYY-MM-DD   the day production switched to live keys (anything created on/after it is listed as possibly real)
 */
import { prisma } from "../lib/prisma";
import { describeDatabase } from "../lib/runtime-env";

const liveArg = process.argv.find((a) => a.startsWith("--live-since="))?.slice(13);
const liveSince = liveArg && !Number.isNaN(Date.parse(liveArg)) ? new Date(liveArg) : null;

/** [table name in the database, plain-words label, group]. Only these are ever listed for clearing. */
const CLEAR: [string, string, string][] = [
  ["Order", "Orders", "Orders and payments"],
  ["SaleLine", "Order items (sales lines: also hold earnings, commissions, referral commissions, affiliate and author shares)", "Orders and payments"],
  ["PaymentLog", "Payments and payment records", "Orders and payments"],
  ["Refund", "Refunds", "Orders and payments"],
  ["OrderLoginToken", "Guest order sign-in links", "Orders and payments"],
  ["Invoice", "Invoices (older table, still in the database; follows its order)", "Orders and payments"],
  ["SaleLineRoyaltyLog", "Royalty recalculation log", "Earnings and payouts"],
  ["PayoutRequest", "Payouts and payout requests", "Earnings and payouts"],
  ["PayoutAdjustment", "Payout adjustments / reversals", "Earnings and payouts"],
  ["AccountingExpense", "Accounting: expenses", "Accounting"],
  ["AccountingMonth", "Accounting: closed/open month records", "Accounting"],
  ["AccountingChangeLog", "Accounting: change log", "Accounting"],
  ["AccountingReceipt", "Accounting: receipts", "Accounting"],
  ["AccountingReport", "Accounting: saved reports", "Accounting"],
  ["RecordChangeLog", "Permanent record change log", "Logs tied to the above"],
  ["AffiliateClick", "Affiliate link clicks (tracking rows)", "Possible extras (your decision)"],
  ["AnalyticsEvent", "Analytics events (visits, checkout steps)", "Possible extras (your decision)"],
  ["PrintPreflightCheck", "Print file check records", "Possible extras (your decision)"],
  ["Review", "Reviews (not linked to orders: cannot be told apart as 'from test orders')", "Possible extras (your decision)"],
  ["Rating", "Star ratings (not linked to orders)", "Possible extras (your decision)"],
  ["ServiceCheck", "Site Health history: checks (optional)", "Optional"],
  ["ServiceIncident", "Site Health history: incidents (optional)", "Optional"],
  ["SystemErrorLog", "System error log (optional)", "Optional"],
];
const KEEP = ["User", "AuthorProfile", "AffiliateProfile", "ReaderProfile", "Book", "BookFile", "Category", "Genre", "UploadedImage", "UploadedFile", "Setting", "Settings", "IdSequence", "AffiliateLink", "Campaign", "Address", "WiseRecipient", "SavedPaymentMethod", "Blog", "Message", "AuditLog", "SeoEntry", "Redirect"];

const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "-");
const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
const q = (t: string) => `"${t.replace(/"/g, "")}"`;

async function main() {
  const db = describeDatabase(process.env.DATABASE_URL, process.env.DATABASE_LABEL);
  console.log(`Database being read: ${db ? `${db.endpoint} / ${db.database}` : "(DATABASE_URL not set)"}`);
  console.log("This report is READ ONLY. Nothing is changed or deleted.");
  console.log(`Live-keys day used: ${liveSince ? liveSince.toISOString().slice(0, 10) : "(not given: run with --live-since=YYYY-MM-DD)"}\n`);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const exists = new Set((await tx.$queryRawUnsafe<{ t: string }[]>(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public'`)).map((r) => r.t));
    const cols = async (t: string) => (await tx.$queryRawUnsafe<{ c: string }[]>(`SELECT column_name AS c FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}'`)).map((r) => r.c);

    // ------------------------------------------------------------------ 1. counts and dates
    console.log("1. WHAT WOULD BE CLEARED: rows per table, with oldest and newest record");
    let group = "";
    const counts: Record<string, number> = {};
    for (const [t, label, g] of CLEAR) {
      if (g !== group) { group = g; console.log(`\n  ${g}`); }
      if (!exists.has(t)) { console.log(`    ${pad(label, 62)} (table not present)`); continue; }
      const c = await cols(t);
      const dateCol = ["createdAt", "requestedAt", "enteredAt", "expenseDate", "checkedAt", "startedAt", "closedAt", "updatedAt", "issuedAt", "date"].find((x) => c.includes(x)) ?? null;
      const r = await tx.$queryRawUnsafe<{ n: bigint; a: Date | null; b: Date | null }[]>(
        dateCol ? `SELECT COUNT(*)::bigint n, MIN(${q(dateCol)}) a, MAX(${q(dateCol)}) b FROM ${q(t)}` : `SELECT COUNT(*)::bigint n, NULL::timestamp a, NULL::timestamp b FROM ${q(t)}`);
      counts[t] = Number(r[0].n);
      console.log(`    ${pad(label, 62)} ${String(counts[t]).padStart(6)}   ${fmt(r[0].a)}  to  ${fmt(r[0].b)}`);
    }
    // notifications created from orders / sales / payouts
    const nn = await tx.$queryRawUnsafe<{ n: bigint; a: Date | null; b: Date | null }[]>(`
      SELECT COUNT(*)::bigint n, MIN("createdAt") a, MAX("createdAt") b FROM "Notification"
      WHERE "relatedRecordId" IN (SELECT "id" FROM "Order" UNION SELECT "id" FROM "SaleLine" UNION SELECT "id" FROM "PayoutRequest")`);
    const nAll = await tx.notification.count();
    console.log("\n  Notices");
    console.log(`    ${pad("Notifications created from orders, sales or payouts", 62)} ${String(Number(nn[0].n)).padStart(6)}   ${fmt(nn[0].a)}  to  ${fmt(nn[0].b)}`);
    console.log(`    (all notifications on the site: ${nAll}; the others, such as messages and moderation notices, would be kept)`);
    console.log("    Sent-email log: the site keeps no copy of sent emails, so there is nothing to clear.");
    console.log("    Carts: the shopping cart lives in the customer's browser, not in the database, so there is nothing to clear.");
    const lulu = await tx.order.count({ where: { OR: [{ luluStatus: { not: null } }, { printJobId: { not: null } }, { printJobStatus: { not: null } }, { luluShippingCost: { not: null } }] } });
    console.log(`    Lulu order records, print job records and saved shipping quotes are columns on the Order row itself (${lulu} orders have some), so they go with the orders.`);

    // ------------------------------------------------------------------ 2. real-looking
    console.log("\n2. DOES ANYTHING LOOK REAL? (these would be left OUT of the delete list)");
    const logs = await tx.paymentLog.findMany({ select: { orderId: true, verified: true, rawPayload: true, createdAt: true } });
    const live = new Set<string>(), unknown = new Set<string>();
    for (const l of logs) {
      if (!l.verified) continue;
      const m = (l.rawPayload as { siteGatewayMode?: unknown } | null)?.siteGatewayMode;
      const dom = (l.rawPayload as { data?: { domain?: unknown } } | null)?.data?.domain;
      if (m === "live" || dom === "live") live.add(l.orderId);
      else if (m !== "test" && dom !== "test") unknown.add(l.orderId);
    }
    const after = liveSince ? await tx.order.findMany({ where: { createdAt: { gte: liveSince } }, select: { id: true } }) : [];
    const sent = await tx.order.findMany({ where: { printJobStatus: "SUBMITTED" }, select: { id: true } });
    const realEmail = await tx.$queryRawUnsafe<{ id: string }[]>(`
      SELECT o."id" FROM "Order" o JOIN "ReaderProfile" r ON r."id"=o."readerId" JOIN "User" u ON u."id"=r."userId"
      WHERE u."email" !~* '(@example\\.|^test|\\+test|@test\\.|@mailinator|@yopmail|otieno29@gmail\\.com)'`);
    console.log(`    Paid through a LIVE key: ${live.size}   |   paid, mode not recorded: ${unknown.size}   |   created on/after the live day: ${after.length}`);
    console.log(`    Sent to Lulu as real print jobs: ${sent.length}   |   placed by an account whose email does not look like a test address: ${realEmail.length}`);
    const suspect = new Set<string>([...live, ...unknown, ...after.map((o) => o.id), ...sent.map((o) => o.id), ...realEmail.map((o) => o.id)]);
    if (suspect.size === 0) console.log("    RESULT: no order looks real. All of them look like sandbox-period test orders.");
    else {
      console.log(`    RESULT: ${suspect.size} order(s) look possibly real. They are listed here and would NOT be deleted (id, date, amount, status only):`);
      const rows = await tx.order.findMany({ where: { id: { in: [...suspect] } }, select: { id: true, createdAt: true, totalAmount: true, status: true }, orderBy: { createdAt: "asc" }, take: 50 });
      for (const o of rows) console.log(`      ${o.id}  ${fmt(o.createdAt)}  ${o.totalAmount}  ${o.status}  [${[live.has(o.id) && "live key", unknown.has(o.id) && "mode unknown", after.some((a) => a.id === o.id) && "after live day", sent.some((s) => s.id === o.id) && "sent to Lulu", realEmail.some((s) => s.id === o.id) && "non-test email"].filter(Boolean).join(", ")}]`);
      console.log("      Other rows tied to those orders (their items, payments, refunds) would also be kept.");
    }

    // ------------------------------------------------------------------ 3. counters on kept records
    console.log("\n3. COUNTERS ON KEPT RECORDS THAT WOULD NEED RESETTING");
    const hits: string[] = [];
    for (const t of ["Book", "AuthorProfile", "AffiliateProfile", "ReaderProfile", "User", "AffiliateLink", "Campaign"]) {
      if (!exists.has(t)) continue;
      const c = (await tx.$queryRawUnsafe<{ c: string; d: string }[]>(`SELECT column_name AS c, data_type AS d FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}'`))
        .filter((x) => /sold|sales|balance|earn|count|rating|review|total|views|downloads|clicks|used/i.test(x.c) && /int|numeric|double|real/.test(x.d));
      for (const x of c) {
        const r = await tx.$queryRawUnsafe<{ nz: bigint }[]>(`SELECT COUNT(*) FILTER (WHERE ${q(x.c)} IS NOT NULL AND ${q(x.c)} <> 0)::bigint nz FROM ${q(t)}`);
        hits.push(`${t}.${x.c}: ${Number(r[0].nz)} row(s) not zero`);
      }
    }
    if (hits.length) { console.log("    Stored number columns on kept tables that look like counters:"); hits.forEach((h) => console.log("      " + h)); console.log("    Plan: set each of these to 0 in the same transaction (only for columns you confirm).") }
    else console.log("    No stored sales, earnings-balance, rating or review-count columns exist on books, authors, affiliates or accounts.");
    console.log("    Units sold, earnings balances, affiliate earnings, rating averages and review counts are CALCULATED from the sales, payout, rating and review rows,");
    console.log("    so they return to zero by themselves once those rows are cleared. Nothing needs a manual reset, unless you want the reviews/ratings kept (below).");
    const settings = await tx.setting.findMany({ select: { key: true } });
    const counterish = settings.map((s) => s.key).filter((k) => /count|used|usage|sold|sales|order|earn|stat|quote_log|book_flags/i.test(k));
    console.log(`    Site settings (${settings.length} rows, all kept). Ones that may hold counters or history: ${counterish.join(", ") || "none"}`);
    console.log("      (lulu_quote_log is Site Health history for shipping-price requests: harmless; can be cleared with the optional Site Health rows.)");
    console.log("    Account numbers (IdSequence) and book SN numbers/ISBNs are kept as they are.");
    console.log("    Discounts: no discount or referral use-count column exists in the database; referral links (AffiliateLink) are kept, their clicks are counted from the click rows.");

    // ------------------------------------------------------------------ 4. links to kept records, and the lock
    console.log("\n4. LINKS FROM KEPT TABLES, AND THE 'NEVER DELETED' LOCK");
    const clearNames = CLEAR.map((c) => c[0]);
    const fks = await tx.$queryRawUnsafe<{ child: string; parent: string; rule: string }[]>(`
      SELECT c.relname AS child, p.relname AS parent,
             CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' ELSE 'SET DEFAULT' END AS rule
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_class p ON p.oid=con.confrelid
      JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE con.contype='f' AND ns.nspname='public'`);
    const blocking = fks.filter((f) => clearNames.includes(f.parent) && !clearNames.includes(f.child));
    if (blocking.length === 0) console.log("    No KEPT table points at a table to be cleared. Nothing else would be blocked or cascaded.");
    else blocking.forEach((f) => console.log(`    KEPT table ${f.child} points at ${f.parent} (${f.rule})${f.rule === "CASCADE" ? "  <-- its rows would be deleted too" : f.rule === "SET NULL" ? "  (link would be emptied, row kept)" : "  <-- would block unless that row is cleared first"}`));
    const cascades = fks.filter((f) => clearNames.includes(f.parent) && clearNames.includes(f.child) && f.rule === "CASCADE");
    console.log(`    Among the cleared tables themselves: ${cascades.length} cascade link(s), so the delete order is: payouts adjustments, refunds, royalty log, payments, sale lines, order tokens, orders, payouts, accounting, change log.`);
    const trg = await tx.$queryRawUnsafe<{ t: string }[]>(`
      SELECT c.relname AS t FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid WHERE tg.tgname='gcb_no_delete' AND NOT tg.tgisinternal ORDER BY 1`);
    console.log(`    The lock (trigger gcb_no_delete) is on: ${trg.map((x) => x.t).join(", ") || "NOTHING: the migration may not be applied"}`);
    const unlocked = CLEAR.map((c) => c[0]).filter((t) => exists.has(t) && !trg.some((x) => x.t === t));
    console.log(`    Cleared tables that have NO lock (can be deleted normally): ${unlocked.join(", ")}`);

    // ------------------------------------------------------------------ 5. kept counts
    console.log("\n5. WHAT STAYS (counts, to compare after the cleanup)");
    for (const t of KEEP) {
      if (!exists.has(t)) continue;
      const r = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint n FROM ${q(t)}`);
      console.log(`    ${pad(t, 22)} ${String(Number(r[0].n)).padStart(6)}`);
    }
    const company = await tx.user.findUnique({ where: { accountNumber: "30000064" }, select: { id: true } });
    console.log(company ? `    Books under company author 30000064: ${await tx.book.count({ where: { author: { userId: company.id } } })} (kept)` : "    Company author 30000064: NOT FOUND (check before any cleanup)");
    console.log("\nEnd of report. Nothing was changed.");
  }, { timeout: 120000 });
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
