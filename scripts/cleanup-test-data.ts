/**
 * ONE-TIME production test-data cleanup (step 3). Start it with scripts\cleanup-test-data.ps1, never by hand.
 *
 * What it does, in ONE database transaction (if anything fails or any check is not met, NOTHING is changed):
 *   1. prints exactly what it will delete (counts) and what it will keep, and waits for you to type DELETE TEST DATA
 *   2. switches off the "records are never deleted" lock for THIS transaction only (SET LOCAL: it cannot outlive the transaction)
 *   3. deletes in the right order, only the tables listed below
 *   4. checks the result: every cleared table is empty, and users, books, files and settings counts are exactly as before
 *   5. writes one audit-log entry (counts, time) and one permanent change-log entry
 *
 * It NEVER touches: users, author/affiliate/reader profiles, books, book files, covers, prices, editions, mockups, ISBNs,
 * SN numbers, affiliate links, uploaded files/images, site settings (apart from the two history markers named below).
 * It uses only DELETE of rows. No reset, no db push, no dropping of tables.
 */
import * as readline from "node:readline/promises";
import { prisma } from "../lib/prisma";
import { describeDatabase } from "../lib/runtime-env";

const PHRASE = "DELETE TEST DATA";
const STAGING_ENDPOINT = "ep-royal-unit-ax5doypv";

/** Delete order: children before parents. Tables missing from the database are skipped. */
const CLEAR_ORDER = [
  "PayoutAdjustment", "Refund", "SaleLineRoyaltyLog", "Invoice", "PaymentLog", "OrderLoginToken", "SaleLine", "Order",
  "PayoutRequest",
  "AccountingExpense", "AccountingReceipt", "AccountingReport", "AccountingChangeLog", "AccountingMonth",
  "AffiliateClick", "AnalyticsEvent", "PrintPreflightCheck", "Review", "Rating",
  "ServiceCheck", "ServiceIncident", "SystemErrorLog",
  "RecordChangeLog",
];
/** Site-setting rows that are only test/history markers. Every other setting is kept. */
const CLEAR_SETTINGS = ["accounting_test_archive", "lulu_quote_log", "lulu_book_flags"];
/** Must be exactly the same before and after. */
const KEEP = ["User", "AuthorProfile", "AffiliateProfile", "ReaderProfile", "Book", "BookFile", "UploadedImage", "UploadedFile", "AffiliateLink", "Campaign", "Category", "Genre", "Blog", "Address", "WiseRecipient", "IdSequence", "Setting", "Message", "AuditLog"];

const q = (t: string) => `"${t.replace(/"/g, "")}"`;
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function count(tx: Tx, t: string): Promise<number> {
  const r = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint n FROM ${q(t)}`);
  return Number(r[0].n);
}

async function main() {
  const db = describeDatabase(process.env.DATABASE_URL, process.env.DATABASE_LABEL);
  if (!db || db.endpoint === "(unreadable address)") throw new Error("DATABASE_URL is not set or cannot be read.");
  if (db.endpoint === STAGING_ENDPOINT) throw new Error("That is the STAGING database. Refusing.");
  console.log(`Database to clean: ${db.endpoint} / ${db.database}\n`);

  // ---- read-only look first (separate, read-only transaction) --------------------------------------------------------
  const before: Record<string, number> = {};
  const keepBefore: Record<string, number> = {};
  let notices = 0;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const exists = new Set((await tx.$queryRawUnsafe<{ t: string }[]>(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public'`)).map((r) => r.t));
    for (const t of CLEAR_ORDER) if (exists.has(t)) before[t] = await count(tx, t);
    for (const t of KEEP) if (exists.has(t)) keepBefore[t] = await count(tx, t);
    const n = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint n FROM "Notification" WHERE "relatedRecordId" IN (SELECT "id" FROM "Order" UNION SELECT "id" FROM "SaleLine" UNION SELECT "id" FROM "PayoutRequest")`);
    notices = Number(n[0].n);
    keepBefore["Notification (all)"] = await count(tx, "Notification");
  });

  console.log("WILL BE DELETED:");
  for (const t of CLEAR_ORDER) if (t in before) console.log(`   ${t.padEnd(24)} ${String(before[t]).padStart(7)}`);
  console.log(`   ${"Notifications from orders/sales/payouts".padEnd(40)} ${String(notices).padStart(7)}`);
  console.log(`   Site-setting history markers (${CLEAR_SETTINGS.join(", ")}): removed if present`);
  console.log("\nWILL BE KEPT (must be identical afterwards):");
  for (const t of Object.keys(keepBefore)) console.log(`   ${t.padEnd(24)} ${String(keepBefore[t]).padStart(7)}`);
  console.log("\nEverything above is deleted in ONE transaction. If any check fails, nothing is changed.");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const typed = (await rl.question(`\nType ${PHRASE} (capital letters) to continue, anything else to stop: `)).trim();
  rl.close();
  if (typed !== PHRASE) { console.log("You did not type the phrase. Nothing was changed."); await prisma.$disconnect(); return; }

  // ---- the cleanup: one transaction -------------------------------------------------------------------------------
  const deleted: Record<string, number> = {};
  let removedNotices = 0;
  await prisma.$transaction(async (tx) => {
    // Lasts only until this transaction ends. The lock stays in force for every other session, now and later.
    await tx.$executeRawUnsafe("SET LOCAL app.allow_record_delete = 'on'");
    const exists = new Set((await tx.$queryRawUnsafe<{ t: string }[]>(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public'`)).map((r) => r.t));

    removedNotices = await tx.$executeRawUnsafe(`DELETE FROM "Notification" WHERE "relatedRecordId" IN (SELECT "id" FROM "Order" UNION SELECT "id" FROM "SaleLine" UNION SELECT "id" FROM "PayoutRequest")`);
    for (const t of CLEAR_ORDER) {
      if (!exists.has(t)) continue;
      deleted[t] = await tx.$executeRawUnsafe(`DELETE FROM ${q(t)}`);
    }
    const s = await tx.$executeRawUnsafe(`DELETE FROM "Setting" WHERE "key" IN (${CLEAR_SETTINGS.map((k) => `'${k}'`).join(",")})`);
    const settingsRemoved = Number(s);

    // checks: anything wrong rolls everything back
    for (const t of CLEAR_ORDER) {
      if (!exists.has(t)) continue;
      const left = await count(tx, t);
      if (left !== 0) throw new Error(`${t} still has ${left} rows after the cleanup. Rolling back: nothing was changed.`);
      if (deleted[t] !== before[t]) throw new Error(`${t}: deleted ${deleted[t]} but expected ${before[t]}. Rolling back: nothing was changed.`);
    }
    for (const t of Object.keys(keepBefore)) {
      if (t === "Notification (all)" || t === "Setting" || t === "AuditLog") continue;
      const now = await count(tx, t);
      if (now !== keepBefore[t]) throw new Error(`${t} changed from ${keepBefore[t]} to ${now}. Rolling back: nothing was changed.`);
    }
    const setNow = await count(tx, "Setting");
    if (setNow !== keepBefore["Setting"] - settingsRemoved) throw new Error("Site settings changed unexpectedly. Rolling back: nothing was changed.");

    const admin = await tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "User" WHERE "role"::text = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1`);
    if (!admin[0]) throw new Error("No admin account found to record the audit entry. Rolling back: nothing was changed.");
    const summary = { ...deleted, notifications: removedNotices, settingMarkersRemoved: settingsRemoved };
    const at = new Date().toISOString();
    await tx.$executeRawUnsafe(`INSERT INTO "AuditLog" ("id","actorId","action","metadata","createdAt") VALUES ($1,$2,'ONE_TIME_TEST_DATA_CLEANUP',$3::jsonb,NOW())`,
      `cleanup_${Date.now()}`, admin[0].id, JSON.stringify({ at, note: "One-time approved clearing of sandbox-period test data before launch.", cleared: summary }));
    await tx.$executeRawUnsafe(`INSERT INTO "RecordChangeLog" ("id","entityType","entityId","action","summary","after","actorName","createdAt") VALUES ($1,'SYSTEM','test-data-cleanup','ONE_TIME_CLEANUP',$2,$3::jsonb,'Approved one-time cleanup',NOW())`,
      `cleanup_${Date.now()}`, "One-time approved clearing of sandbox-period test data before launch.", JSON.stringify({ at, cleared: summary }));
  }, { timeout: 300000, maxWait: 20000 });

  console.log("\nDONE. Everything below was deleted in one transaction and the checks passed:");
  for (const t of Object.keys(deleted)) console.log(`   ${t.padEnd(24)} ${String(deleted[t]).padStart(7)}`);
  console.log(`   ${"Notifications".padEnd(24)} ${String(removedNotices).padStart(7)}`);
  console.log("Users, books and files were not touched. Now run the report again to see the zeros.");
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error("\nSTOPPED: " + (e instanceof Error ? e.message : String(e))); console.error("Nothing was changed."); await prisma.$disconnect().catch(() => {}); process.exit(1); });
