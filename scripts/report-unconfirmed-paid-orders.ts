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
    for (const r of rows.slice(0, 40)) {
      console.log(`  #${r.id.slice(0, 8).toUpperCase()}  ${r.createdAt.toISOString().slice(0, 10)}  $${Number(r.totalAmount).toFixed(2)}${r.isTestData ? "  (test data)" : ""}`);
    }
    if (rows.length > 40) console.log(`  ...and ${rows.length - 40} more`);
  };

  console.log(`Orders marked PAID: ${paid.length}`);
  console.log(`With a verified payment record: ${confirmed.length}`);
  show("A) PAID but NO verified payment record at all (never confirmed by a gateway)", noLog);
  show("B) PAID with a Paystack record that has no Paystack reference", logNoRef);
  console.log("\nNothing was changed.");
}

main()
  .catch((e) => {
    console.error("Report failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
