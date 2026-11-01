/**
 * Round 56 - corrects EXISTING sandbox (test) print orders so their totals include Lulu's fulfillment fee, the way new
 * orders now do. Shows what it would change first; nothing is written unless you add --apply.
 *
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/correct-sandbox-order-fulfillment.ts            (preview only)
 *   npx tsx scripts/correct-sandbox-order-fulfillment.ts --apply    (write the correction)
 *
 * Only PAID orders that are marked as test data, have printed copies, have a saved Lulu fulfillment quote and have not
 * been corrected yet are touched. For each: fulfillmentAmount is set to the quoted fee and totalAmount goes up by the
 * same fee. Sale lines, royalties, author and affiliate accounts are NEVER touched (the fee is a pass-through).
 * Real (non-test) orders are never touched. Safe to run twice: a corrected order is skipped.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      status: "PAID", isTestData: true, fulfillmentAmount: null, luluFulfillmentCost: { not: null },
      lines: { some: { format: { in: ["paperback", "hardcover"] } } },
    },
    select: { id: true, totalAmount: true, luluFulfillmentCost: true },
    orderBy: { createdAt: "asc" },
  });
  if (orders.length === 0) { console.log("No sandbox print orders need correcting."); return; }
  console.log(`${orders.length} sandbox print order(s) ${apply ? "being corrected" : "would be corrected (preview only; add --apply to write)"}:`);
  for (const o of orders) {
    const fee = Number(o.luluFulfillmentCost);
    const before = Number(o.totalAmount);
    const after = Math.round((before + fee) * 100) / 100;
    console.log(`  #${o.id.slice(0, 8).toUpperCase()}  total $${before.toFixed(2)} -> $${after.toFixed(2)}  (fulfillment fee $${fee.toFixed(2)})`);
    if (apply) {
      await prisma.order.update({ where: { id: o.id }, data: { fulfillmentAmount: fee, totalAmount: after } });
    }
  }
  console.log(apply ? "\nDone." : "\nNothing was changed.");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
