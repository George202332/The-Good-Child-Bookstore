/**
 * READ-ONLY report: how many orders are marked PAID without any recorded,
 * verified payment confirmation?
 *
 * It changes NOTHING. It only counts and lists order numbers so you can decide
 * what, if anything, to do about history.
 *
 * Usage (PowerShell, from the bookstore folder). Point it at the database you
 * want to look at by setting DATABASE_URL for this one command, e.g.:
 *
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/report-unconfirmed-paid-orders.ts
 *
 * (The connection string is read from your environment and is never printed.)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function referenceIn(payload: unknown): string | null {
  const p = payload as { reference?: unknown; data?: { reference?: unknown } } | null;
  const ref = p?.data?.reference ?? p?.reference;
  return typeof ref === "string" && ref ? ref : null;
}

async function main() {
  const paid = await prisma.order.findMany({
    where: { status: "PAID" },
    select: {
      id: true,
      totalAmount: true,
      createdAt: true,
      isTestData: true,
      reader: { select: { user: { select: { name: true, email: true } } } },
      lines: { select: { authorShare: true, affiliateShare: true, authorReferralShare: true, book: { select: { title: true } } } },
      paymentLogs: { select: { gateway: true, verified: true, rawPayload: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const confirmed: typeof paid = [];
  const noLog: typeof paid = [];
  const logNoRef: typeof paid = [];

  for (const o of paid) {
    const verifiedLogs = o.paymentLogs.filter((l) => l.verified);
    if (verifiedLogs.length === 0) noLog.push(o);
    else if (verifiedLogs.some((l) => l.gateway === "PAYSTACK") && !verifiedLogs.some((l) => referenceIn(l.rawPayload))) logNoRef.push(o);
    else confirmed.push(o);
  }

  const sum = (rows: typeof paid) => rows.reduce((t, r) => t + Number(r.totalAmount), 0).toFixed(2);
  const show = (title: string, rows: typeof paid) => {
    console.log(`\n${title}: ${rows.length} order(s), $${sum(rows)} in total`);
    console.log(`  of which test-data orders: ${rows.filter((r) => r.isTestData).length}`);
    for (const r of rows) {
      const owed = r.lines.reduce((t, l) => t + Number(l.authorShare) + Number(l.affiliateShare) + Number(l.authorReferralShare), 0);
      console.log(`  #${r.id.slice(0, 8).toUpperCase()} (full id ${r.id})  ${r.createdAt.toISOString().slice(0, 10)}  $${Number(r.totalAmount).toFixed(2)}${r.isTestData ? "  (test data)" : ""}`);
      console.log(`      customer: ${r.reader.user.name} <${r.reader.user.email}>`);
      console.log(`      items: ${r.lines.map((l) => l.book.title).join("; ") || "(none)"}`);
      console.log(`      author/affiliate earnings credited from this order: $${owed.toFixed(2)}`);
    }
  };

  console.log(`Orders marked PAID: ${paid.length}`);
  console.log(`With a verified payment record: ${confirmed.length}`);
  show("A) PAID but NO verified payment record at all (never confirmed by a gateway)", noLog);
  show("B) PAID with a Paystack record that has no Paystack reference", logNoRef);
  const earningsAtRisk = [...noLog, ...logNoRef].reduce(
    (t, o) => t + o.lines.reduce((x, l) => x + Number(l.authorShare) + Number(l.affiliateShare) + Number(l.authorReferralShare), 0),
    0,
  );
  console.log(`\nTotal author + affiliate earnings credited from these orders: $${earningsAtRisk.toFixed(2)}`);

  const pending = await prisma.order.count({ where: { status: "PENDING" } });
  console.log(`Orders still PENDING (checkout started, never paid): ${pending}. These are not counted as sales.`);
  console.log("\nNothing was changed.");
}

main()
  .catch((e) => {
    console.error("Report failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
