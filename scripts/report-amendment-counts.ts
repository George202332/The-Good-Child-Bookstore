/**
 * READ-ONLY report for the amendment batch. It changes NOTHING: everything runs inside a transaction set to READ ONLY, so the
 * database itself refuses any change. It prints no emails, no passwords, no keys, no bank or phone details.
 *
 *  1. How many users still have PayPal or M-Pesa payout details and no Bank Transfer details
 *     (these users are asked to choose Bank Transfer; their old details stay untouched).
 *  2. How many books still carry an old category, by book status, and which books they are
 *     (these are NOT changed; you decide).
 * Start it with scripts\report-amendment-counts.ps1
 */
import { prisma } from "../lib/prisma";
import { describeDatabase } from "../lib/runtime-env";
import { CATEGORIES, LEGACY_CATEGORY_NAMES, categoryOfSubcategory } from "../lib/taxonomy";

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));

async function main() {
  const db = describeDatabase(process.env.DATABASE_URL, process.env.DATABASE_LABEL);
  console.log(`Database being read: ${db ? `${db.endpoint} / ${db.database}` : "(DATABASE_URL not set)"}`);
  console.log("This report is READ ONLY. Nothing is changed or deleted.\n");

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");

    // ---------------------------------------------------------------- 1. payout methods
    console.log("1. PAYOUT METHODS (who is affected by Bank Transfer becoming the only method)");
    const byType = await tx.$queryRawUnsafe<{ type: string; users: bigint; active: bigint }[]>(
      `SELECT "type", COUNT(DISTINCT "userId")::bigint AS users, COUNT(*) FILTER (WHERE "isDefault")::bigint AS active FROM "WiseRecipient" GROUP BY "type" ORDER BY 2 DESC`
    );
    for (const r of byType) console.log(`   Type "${r.type}": ${Number(r.users)} user(s) have it saved, ${Number(r.active)} have it as their ACTIVE method`);
    const affected = await tx.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(DISTINCT "userId")::bigint AS n FROM "WiseRecipient" w WHERE w."type" IN ('email','mpesa') AND NOT EXISTS (SELECT 1 FROM "WiseRecipient" b WHERE b."userId" = w."userId" AND b."type" = 'bank')`
    );
    const pp = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(DISTINCT "userId")::bigint AS n FROM "WiseRecipient" WHERE "type" = 'email'`);
    const mp = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(DISTINCT "userId")::bigint AS n FROM "WiseRecipient" WHERE "type" = 'mpesa'`);
    const both = await tx.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(DISTINCT w1."userId")::bigint AS n FROM "WiseRecipient" w1 JOIN "WiseRecipient" w2 ON w1."userId" = w2."userId" WHERE w1."type" = 'email' AND w2."type" = 'mpesa'`
    );
    const pending = await tx.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*)::bigint AS n FROM "PayoutRequest" p JOIN "WiseRecipient" w ON w.id = p."recipientId" WHERE w."type" IN ('email','mpesa') AND p."status" IN ('REQUESTED','APPROVED','PROCESSING')`
    );
    console.log(`\n   Users with PayPal details saved        : ${Number(pp[0].n)}`);
    console.log(`   Users with M-Pesa details saved        : ${Number(mp[0].n)}`);
    console.log(`   Users with both                        : ${Number(both[0].n)}`);
    console.log(`   USERS ASKED TO CHOOSE BANK TRANSFER    : ${Number(affected[0].n)}   (PayPal or M-Pesa saved, no bank details yet)`);
    console.log(`   Open payouts still pointing at PayPal/M-Pesa details: ${Number(pending[0].n)}  (need a look before the next payout run)\n`);

    // ---------------------------------------------------------------- 2. old categories on books
    console.log("2. BOOKS AND OLD CATEGORIES (nothing is changed)");
    const current = new Set<string>(CATEGORIES);
    const legacy = new Set<string>(Object.keys(LEGACY_CATEGORY_NAMES));
    const books = await tx.$queryRawUnsafe<{ id: string; title: string; status: string; category: string | null; subcategory: string | null }[]>(
      `SELECT id, title, "status"::text AS status, "category", "subcategory" FROM "Book"`
    );
    type Bucket = "current" | "oldSeriesName" | "empty" | "other";
    const rows = books.map((b) => {
      const c = (b.category ?? "").trim();
      const bucket: Bucket = !c ? "empty" : current.has(c) ? "current" : legacy.has(c) ? "oldSeriesName" : "other";
      const fromSub = categoryOfSubcategory(b.subcategory?.trim()) ?? null;
      return { ...b, bucket, fromSub };
    });
    const statuses = Array.from(new Set(rows.map((r) => r.status))).sort();
    console.log(`   ${pad("Status", 18)}${pad("Total", 8)}${pad("Current", 9)}${pad("Old \"Series\" name", 20)}${pad("Empty", 8)}Other value`);
    for (const st of [...statuses, "ALL"]) {
      const set = st === "ALL" ? rows : rows.filter((r) => r.status === st);
      const n = (b: Bucket) => set.filter((r) => r.bucket === b).length;
      console.log(`   ${pad(st, 18)}${pad(String(set.length), 8)}${pad(String(n("current")), 9)}${pad(String(n("oldSeriesName")), 20)}${pad(String(n("empty")), 8)}${n("other")}`);
    }
    console.log("\n   What the screens show for these books:");
    console.log("   - Old \"Series\" name stored: shown under its CURRENT name everywhere (book is NOT changed in the database).");
    console.log("   - Empty but the subcategory identifies a current category: shown under that category.");
    console.log("   - Empty and nothing to go on, or an unknown value: My Books and Analytics show \"Not Set\"; the book is left out of every category page and filter.\n");
    const needs = rows.filter((r) => r.bucket !== "current");
    console.log(`   Books that are not on a current category value: ${needs.length}`);
    for (const r of needs.slice(0, 60)) {
      console.log(`   - ${pad(r.title, 40)} ${pad(r.status, 16)} stored: ${pad(r.category ?? "(empty)", 28)} subcategory: ${r.subcategory ?? "(none)"}${r.fromSub ? `  -> would map to ${r.fromSub}` : ""}  [${r.id}]`);
    }
    if (needs.length > 60) console.log(`   ... and ${needs.length - 60} more.`);
  });
}

main().catch((e) => { console.error("The report could not finish:", e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
