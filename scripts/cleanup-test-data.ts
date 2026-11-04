/**
 * ONE-TIME production test-data cleanup (step 3). Start it with scripts\cleanup-test-data.ps1, never by hand.
 *
 * What it does:
 *   1. reads the counts (plain read-only queries, no transaction) and prints exactly what it will delete and what it keeps
 *   2. waits for you to type DELETE TEST DATA
 *   3. runs ONE SQL statement (see cleanup-sql.ts) that deletes everything, checks every count, writes the audit entries,
 *      and rolls EVERYTHING back by itself if any check fails. One statement means one round trip: it cannot be cut off
 *      half-way by a Neon / pooled-connection "Transaction not found" error the way a long step-by-step transaction can.
 *   4. reads the counts again and prints them
 *
 * It NEVER touches: users, author/affiliate/reader profiles, books, book files, covers, prices, editions, mockups, ISBNs,
 * SN numbers, affiliate links, uploaded files/images, site settings (apart from the three history markers named in cleanup-sql.ts).
 * It uses only DELETE of rows; it never resets the database or removes any table.
 */
import * as readline from "node:readline/promises";
import { prisma } from "../lib/prisma";
import { describeDatabase } from "../lib/runtime-env";
import { CLEAR_ORDER, CLEAR_SETTINGS, KEEP, NOTICE_COUNT_QUERY, buildCleanupSql, countsQuery, type Expected } from "./cleanup-sql";

const PHRASE = "DELETE TEST DATA";
const STAGING_ENDPOINT = "ep-royal-unit-ax5doypv";

async function counts(tables: string[]): Promise<Record<string, number>> {
  const rows = await prisma.$queryRawUnsafe<{ t: string; n: bigint }[]>(countsQuery(tables));
  return Object.fromEntries(rows.map((r) => [r.t, Number(r.n)]));
}

async function look(): Promise<Expected & { extra: Record<string, number> }> {
  const present = new Set((await prisma.$queryRawUnsafe<{ t: string }[]>(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public'`)).map((r) => r.t));
  const clear = await counts(CLEAR_ORDER.filter((t) => present.has(t)));
  const keep = await counts(KEEP.filter((t) => present.has(t)));
  const extra = await prisma.$queryRawUnsafe<{ t: string; n: bigint }[]>(NOTICE_COUNT_QUERY).then((r) => Object.fromEntries(r.map((x) => [x.t, Number(x.n)])));
  return { clear, keep, notices: extra.notices, settingsAll: extra.settings_all, settingMarkers: extra.settings_markers, extra };
}

async function main() {
  const db = describeDatabase(process.env.DATABASE_URL, process.env.DATABASE_LABEL);
  if (!db || db.endpoint === "(unreadable address)") throw new Error("DATABASE_URL is not set or cannot be read.");
  if (db.endpoint === STAGING_ENDPOINT) throw new Error("That is the STAGING database. Refusing.");
  console.log(`Database to clean: ${db.endpoint} / ${db.database}`);
  console.log("Reading the current counts (read only)...\n");

  const e = await look();
  console.log("WILL BE DELETED:");
  for (const t of CLEAR_ORDER) if (t in e.clear) console.log(`   ${t.padEnd(40)} ${String(e.clear[t]).padStart(7)}`);
  console.log(`   ${"Notifications from orders/sales/payouts".padEnd(40)} ${String(e.notices).padStart(7)}`);
  console.log(`   ${("Site-setting history markers (" + CLEAR_SETTINGS.length + " possible)").padEnd(40)} ${String(e.settingMarkers).padStart(7)}`);
  console.log("\nWILL BE KEPT (must be identical afterwards):");
  for (const t of Object.keys(e.keep)) console.log(`   ${t.padEnd(40)} ${String(e.keep[t]).padStart(7)}`);
  console.log(`   ${"Other notifications".padEnd(40)} ${String(e.extra.notifications_all - e.notices).padStart(7)}`);
  console.log(`   ${"Other site settings".padEnd(40)} ${String(e.settingsAll - e.settingMarkers).padStart(7)}`);
  console.log("\nEverything above is deleted by ONE database statement. If any check inside it fails, the database undoes everything.");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const typed = (await rl.question(`\nType ${PHRASE} (capital letters) to continue, anything else to stop: `)).trim();
  rl.close();
  if (typed !== PHRASE) { console.log("You did not type the phrase. Nothing was changed."); await prisma.$disconnect(); return; }

  console.log("\nDeleting (one statement)...");
  const stamp = `${Date.now()}`;
  await prisma.$executeRawUnsafe(buildCleanupSql(e, `cleanup_audit_${stamp}`, `cleanup_log_${stamp}`));

  console.log("\nDONE. The statement finished, every check passed, and the audit entries were written. Deleted:");
  for (const t of CLEAR_ORDER) if (t in e.clear) console.log(`   ${t.padEnd(40)} ${String(e.clear[t]).padStart(7)}`);
  console.log(`   ${"Notifications".padEnd(40)} ${String(e.notices).padStart(7)}`);

  const after = await look();
  const zero = CLEAR_ORDER.filter((t) => t in after.clear && t !== "RecordChangeLog" && after.clear[t] !== 0);
  const changed = Object.keys(e.keep).filter((t) => after.keep[t] !== e.keep[t]);
  console.log(zero.length === 0 && changed.length === 0
    ? "\nChecked again: every cleared table is empty (RecordChangeLog holds only the one cleanup entry) and users, books and files are unchanged."
    : `\nWARNING on the second look: not empty: ${zero.join(", ") || "none"}; changed: ${changed.join(", ") || "none"}. Send me this screen.`);
  await prisma.$disconnect();
}
main().catch(async (err) => {
  console.error("\nSTOPPED: " + (err instanceof Error ? err.message : String(err)));
  console.error("Nothing was changed (the delete is one statement: it either completes fully or not at all).");
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
