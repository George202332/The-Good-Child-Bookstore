/**
 * Builds the ONE SQL statement the cleanup runs. Pure (no database code) so it can be tested.
 *
 * Why one statement: Neon (and any pooled connection) can drop a long, many-step Prisma transaction ("Transaction not found").
 * A single DO block is atomic by itself, takes one round trip, and its SET (via set_config(..., true)) lasts only until that
 * statement ends. If any check fails inside it, the database rolls EVERYTHING back.
 */
export const CLEAR_ORDER = [
  "PayoutAdjustment", "Refund", "SaleLineRoyaltyLog", "Invoice", "PaymentLog", "OrderLoginToken", "SaleLine", "Order",
  "PayoutRequest",
  "AccountingExpense", "AccountingReceipt", "AccountingReport", "AccountingChangeLog", "AccountingMonth",
  "AffiliateClick", "AnalyticsEvent", "PrintPreflightCheck", "Review", "Rating",
  "ServiceCheck", "ServiceIncident", "SystemErrorLog",
  "RecordChangeLog",
];
/** Site-setting rows that are only test/history markers. Every other setting is kept. */
export const CLEAR_SETTINGS = ["accounting_test_archive", "lulu_quote_log", "lulu_book_flags"];
/** Must be exactly the same before and after (Setting and Notification are checked separately). */
export const KEEP = ["User", "AuthorProfile", "AffiliateProfile", "ReaderProfile", "Book", "BookFile", "UploadedImage", "UploadedFile", "AffiliateLink", "Campaign", "Category", "Genre", "Blog", "Address", "WiseRecipient", "IdSequence", "Message"];

const ident = (t: string) => `"${t.replace(/[^A-Za-z0-9_]/g, "")}"`;
const num = (n: number) => String(Math.max(0, Math.floor(Number(n) || 0)));
const NOTICE_WHERE = `"relatedRecordId" IN (SELECT "id" FROM "Order" UNION SELECT "id" FROM "SaleLine" UNION SELECT "id" FROM "PayoutRequest")`;

/** One query that returns [table, count] for each given table. */
export function countsQuery(tables: string[]): string {
  return tables.map((t) => `SELECT '${t.replace(/[^A-Za-z0-9_ ()]/g, "")}' AS t, COUNT(*)::bigint AS n FROM ${ident(t)}`).join(" UNION ALL ");
}
export const NOTICE_COUNT_QUERY = `SELECT 'notices' AS t, COUNT(*)::bigint AS n FROM "Notification" WHERE ${NOTICE_WHERE} UNION ALL SELECT 'notifications_all', COUNT(*)::bigint FROM "Notification" UNION ALL SELECT 'settings_all', COUNT(*)::bigint FROM "Setting" UNION ALL SELECT 'settings_markers', COUNT(*)::bigint FROM "Setting" WHERE "key" IN (${CLEAR_SETTINGS.map((k) => `'${k}'`).join(",")})`;

export interface Expected {
  clear: Record<string, number>;
  keep: Record<string, number>;
  notices: number;
  settingsAll: number;
  settingMarkers: number;
}

export function buildCleanupSql(e: Expected, auditId: string, changeLogId: string): string {
  const L: string[] = [];
  L.push("DO $cleanup$");
  L.push("DECLARE n bigint; res jsonb := '{}'::jsonb; admin_id text; at_text text := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"');");
  L.push("BEGIN");
  L.push("  PERFORM set_config('app.allow_record_delete', 'on', true);  -- until the end of THIS statement only");
  L.push(`  DELETE FROM "Notification" WHERE ${NOTICE_WHERE};`);
  L.push("  GET DIAGNOSTICS n = ROW_COUNT;");
  L.push(`  IF n <> ${num(e.notices)} THEN RAISE EXCEPTION 'Notifications: deleted %, expected ${num(e.notices)}. Rolled back.', n; END IF;`);
  L.push("  res := res || jsonb_build_object('notifications', n);");
  for (const t of CLEAR_ORDER) {
    if (!(t in e.clear)) continue;
    L.push(`  DELETE FROM ${ident(t)};`);
    L.push("  GET DIAGNOSTICS n = ROW_COUNT;");
    L.push(`  IF n <> ${num(e.clear[t])} THEN RAISE EXCEPTION '${t}: deleted %, expected ${num(e.clear[t])}. Rolled back.', n; END IF;`);
    L.push(`  SELECT COUNT(*) INTO n FROM ${ident(t)};`);
    L.push(`  IF n <> 0 THEN RAISE EXCEPTION '${t} still has % rows. Rolled back.', n; END IF;`);
    L.push(`  res := res || jsonb_build_object('${t}', ${num(e.clear[t])});`);
  }
  L.push(`  DELETE FROM "Setting" WHERE "key" IN (${CLEAR_SETTINGS.map((k) => `'${k}'`).join(",")});`);
  L.push("  GET DIAGNOSTICS n = ROW_COUNT;");
  L.push(`  IF n <> ${num(e.settingMarkers)} THEN RAISE EXCEPTION 'Settings: removed %, expected ${num(e.settingMarkers)}. Rolled back.', n; END IF;`);
  L.push(`  SELECT COUNT(*) INTO n FROM "Setting";`);
  L.push(`  IF n <> ${num(e.settingsAll - e.settingMarkers)} THEN RAISE EXCEPTION 'Site settings changed unexpectedly (now %). Rolled back.', n; END IF;`);
  for (const t of KEEP) {
    if (!(t in e.keep)) continue;
    L.push(`  SELECT COUNT(*) INTO n FROM ${ident(t)};`);
    L.push(`  IF n <> ${num(e.keep[t])} THEN RAISE EXCEPTION '${t} changed (now %, was ${num(e.keep[t])}). Rolled back.', n; END IF;`);
  }
  L.push(`  SELECT "id" INTO admin_id FROM "User" WHERE "role"::text = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1;`);
  L.push("  IF admin_id IS NULL THEN RAISE EXCEPTION 'No admin account found to record the audit entry. Rolled back.'; END IF;");
  L.push(`  INSERT INTO "AuditLog" ("id","actorId","action","metadata","createdAt") VALUES ('${auditId.replace(/[^A-Za-z0-9_]/g, "")}', admin_id, 'ONE_TIME_TEST_DATA_CLEANUP', jsonb_build_object('at', at_text, 'note', 'One-time approved clearing of sandbox-period test data before launch.', 'cleared', res), NOW());`);
  L.push(`  INSERT INTO "RecordChangeLog" ("id","entityType","entityId","action","summary","after","actorName","createdAt") VALUES ('${changeLogId.replace(/[^A-Za-z0-9_]/g, "")}', 'SYSTEM', 'test-data-cleanup', 'ONE_TIME_CLEANUP', 'One-time approved clearing of sandbox-period test data before launch.', jsonb_build_object('at', at_text, 'cleared', res), 'Approved one-time cleanup', NOW());`);
  L.push("END");
  L.push("$cleanup$;");
  return L.join("\n");
}
